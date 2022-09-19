// import * as chatbot from '@aws-cdk/aws-chatbot';
import * as cdk from 'aws-cdk-lib';
import { ApiAppConfig } from "./sample-backend-api-stack";
import { DBConfig } from './sample-backend-db-stack';
import { ApiDocConfig } from './apidoc-stack';
import { CodePipeline, ShellStep, CodePipelineSource, ManualApprovalStep } from "aws-cdk-lib/pipelines";
import * as codecommit from "aws-cdk-lib/aws-codecommit";
import * as chatbot from 'aws-cdk-lib/aws-chatbot';
import * as notifications from 'aws-cdk-lib/aws-codestarnotifications';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { ApiAppStage, DBStage, ApiDocStage } from "./appStage";
import { Construct } from 'constructs';

const app = new cdk.App();

export type ApiAppDeployConfig  = {
  env: {
    account: string;
    region: string;
  },
  stackName?: string;
  appConfig: ApiAppConfig
}

export type DBAppDeployConfig = {
  env: {
    account: string;
    region: string;
  },
  stackName?: string;
  appConfig: DBConfig  
}

export type APIDocAppDeployConfig = {
  env: {
    account: string;
    region: string;
  },
  stackName?: string;
  appConfig: ApiDocConfig    
}

export interface PipelineStackProps extends cdk.StackProps {
  stagingAPIDeployConfig: ApiAppDeployConfig,
  stagingDBDeployConfig: DBAppDeployConfig,
  stagingAPIDocDeployConfig: APIDocAppDeployConfig,
  productionAPIDeployConfig: ApiAppDeployConfig,
  productionDBDeployConfig: DBAppDeployConfig,
  productionAPIDocDeployConfig: APIDocAppDeployConfig,
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    if (!props) {
      throw new Error('props required');
    }
  
    /**
     * CodeCommitの場合のコード
     */
    const repositoryName = '';
    const repository = codecommit.Repository.fromRepositoryName(
      this, 'Repository', repositoryName
    );

    // リリース完了処理でリポジトリにリリース課題の ID をタグとして設定したいので
    // そのためのポリシーを作る。
    //
    // 1. CodePipeline から承認アクションのコメント（リリース課題の ID を承認時に開発者が設定）
    //    を取ることができるようにパイプラインの実行ログとアクションログの参照権限をあたえるためのもの
    const policyStatementToReadApprovalComment = new PolicyStatement();
    policyStatementToReadApprovalComment.addActions(
      'codepipeline:ListPipelineExecutions',
      'codepipeline:ListActionExecutions',
    );
    policyStatementToReadApprovalComment.addResources('*');
    policyStatementToReadApprovalComment.effect = Effect.ALLOW;

    // 2. CodeCommit 上のリポジトリにタグ付けするためのもの
    const policyStatementToTagRepository = new PolicyStatement();
    policyStatementToTagRepository.addActions(
      'codecommit:GitPush',
    );
    policyStatementToTagRepository.addResources(repository.repositoryArn);
    policyStatementToTagRepository.effect = Effect.ALLOW;    


    const pipelineName = 'SampleBackendPipeline';
    const pipeline = new CodePipeline(this, 'SampleBackendPipeline', {
      pipelineName,
      crossAccountKeys: true,
      synth: new ShellStep("Synth", {
        input: CodePipelineSource.codeCommit(
          repository,
          'master',
          {
            codeBuildCloneOutput: true
          }
        ),
        commands: [
          "cd cdk && yarn install && cd ../api",
          "pip install -r requirements.txt -t python_modules",
          // UT
          "pip install -q -U -r requirements-dev.txt",
          "pytest tests/unit -s -vss -vvv",
          // XXX: flake8の導入
          // API Docのビルド
          "cd ../",
          "yarn add redoc && yarn add redoc-cli",
          "npx redoc-cli bundle ./docs/swagger.yaml -o ./docs/index.html",
          "ls",
          "cd ./cdk",
          "npm ci",
          "npm run build",
          "npx cdk synth -v",
        ],
        primaryOutputDirectory: 'cdk/cdk.out',
      }),
      codeBuildDefaults: {
        rolePolicy: [
          policyStatementToReadApprovalComment,
          policyStatementToTagRepository,
        ],        
      },
    });
    
    // Deploy to Staging
    const stagingDB = new DBStage(
      app, 'StagingDB', props.stagingDBDeployConfig
    );
    pipeline.addStage(stagingDB);

    const staging = new ApiAppStage(
      app, 'StagingAPI', props.stagingAPIDeployConfig
    );
    pipeline.addStage(staging);

    const stagingApiDoc = new ApiDocStage(
      app, 'StagingAPIDoc', props.stagingAPIDocDeployConfig
    );
    pipeline.addStage(stagingApiDoc);

    /*
    // Smoke Test (UAT)
    stagingStage.stackSteps addAction(new ShellStep("StgDeploy", {
      actionName: 'SmokeTest',
      useOutputs: {
        STAGING_APP_URL: pipeline.stackOutput(staging.appUrlOutput),
      },
      commands: [
        'curl -Ssf $STAGING_APP_URL',
      ],
    }));
    */

    // Deploy to Production
    const productionDB = new DBStage(
      app, 'ProductionDB', props.productionDBDeployConfig
    );
    const productionDBStage = pipeline.addStage(productionDB);
    productionDBStage.addPre(new ManualApprovalStep('ReleaseApproval'));

    const production = new ApiAppStage(
      app, 'ProductionAPI', props.productionAPIDeployConfig
    );
    pipeline.addStage(production);

    const productionApiDoc = new ApiDocStage(
      app, 'ProductionAPIDoc', props.productionAPIDocDeployConfig
    );
    pipeline.addStage(productionApiDoc, {
      post: [
        new cdk.pipelines.ShellStep('Tag Script', {
          commands: [`PIPELINE_NAME=${pipelineName} ./scripts/tag_repository.sh`]
        }),
      ]      
    });

    // slack への通知設定
    const topic = new sns.Topic(this, 'MyTopic2');
    const slack = new chatbot.SlackChannelConfiguration(this, 'SlackChannel', {
      slackChannelConfigurationName: '',
      slackWorkspaceId: '',
      // 送付先の public チャネルを指定。private でも可能だが `@aws` をチャネルに `\invite` する必要あり。
      slackChannelId: '',
    });
    pipeline.buildPipeline();
    const rule = new notifications.NotificationRule(this, 'NotificationRule', {
      source: pipeline.pipeline,
      events: [
        'codepipeline-pipeline-pipeline-execution-failed',
        'codepipeline-pipeline-pipeline-execution-canceled',
        'codepipeline-pipeline-pipeline-execution-started',
        'codepipeline-pipeline-pipeline-execution-resumed',
        'codepipeline-pipeline-pipeline-execution-succeeded',
        'codepipeline-pipeline-manual-approval-needed'
      ],
      targets: [topic],
    });
    rule.addTarget(slack);      
  }
}