import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_apigateway as ApiGateway,
  aws_iam as IAM
} from 'aws-cdk-lib'
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

export type ApiAppConfig = {
  baseDomainName: string;
  hostedZoneId: string;
  domainName: string;
  apidocDomainName: string;
  targetApiUrl: string;
  appEnv: 'stg' | 'prd' | 'dev';
}

export interface AppStackProps extends StackProps {
  appConfig: ApiAppConfig;
}

export class SampleBackendAPIStack extends Stack {
  constructor(scope: Construct, id: string, props?: AppStackProps) {
    super(scope, id, props);

    const env = props?.appConfig.appEnv ? props.appConfig.appEnv : '';
    const baseDomainName = props?.appConfig.baseDomainName ? props.appConfig.baseDomainName : '';
    const hostZoneId = props?.appConfig.hostedZoneId ? props.appConfig.hostedZoneId : '';
    const domainName = props?.appConfig.domainName ? props.appConfig.domainName : '';
    let zone: any = undefined;
    let certificate: any = undefined;

    if (checkDomainEnv(env)) {
      // Route53
      zone = route53.HostedZone.fromHostedZoneAttributes(this, 'NaonaHostZone', {
        hostedZoneId: hostZoneId,
        zoneName: baseDomainName
      });

      // ACM (us-east-1)
      certificate = new acm.DnsValidatedCertificate(this, 'CrossRegionCertificate', {
        domainName: domainName,
        hostedZone: zone,
        region: 'us-east-1',
      });
    }

    // IAM
    // 暫定的なので絞る必要がある
    const lambdaRole = new IAM.Role(this, 'LambdaRole', {
      assumedBy: new IAM.ServicePrincipal('lambda.amazonaws.com'),
    });
    lambdaRole.addToPolicy(new IAM.PolicyStatement({
      resources: ['*'],
      actions: ['dynamodb:*'],
    }));
    lambdaRole.addToPolicy(new IAM.PolicyStatement({
      resources: ['*'],
      actions: ['chime:*']
    }))
    lambdaRole.addToPolicy(new IAM.PolicyStatement({
      resources: ['*'],
      actions: ['logs:*']
    }))

    // Meeting Lambda
    const meetingHandler = new lambda.Function(this, 'SampleHandler', {
      functionName: env + '-sample-backend-python',
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset('../api'),
      handler: 'lambda_handler.event_handler',
      environment: {
        TARGET_API_URL: props?.appConfig.targetApiUrl ? props.appConfig.targetApiUrl : '',
      },
      timeout: Duration.seconds(30),
      role: lambdaRole,
      tracing: lambda.Tracing.ACTIVE,
    });

    // API Gateway
    const apigateway = new ApiGateway.RestApi(this, 'sampleBackendApi',{
      restApiName: env + '-sample-backend-api',
      deployOptions: {
        stageName: 'v1',
        tracingEnabled: true
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ApiGateway.Cors.ALL_ORIGINS,
        allowMethods: ApiGateway.Cors.ALL_METHODS,
        allowHeaders: ApiGateway.Cors.DEFAULT_HEADERS,
        statusCode: 200,
      },
    });

    // '${BASE_URL}/meetings
    const meetingsResource = apigateway.root.addResource('meetings');
    meetingsResource.addMethod('POST', new ApiGateway.LambdaIntegration(meetingHandler));
    // '${BASE_URL}/meetings/{meeting_id}
    const meetingResource = meetingsResource.addResource('{meeting_id}');
    meetingResource.addMethod('DELETE', new ApiGateway.LambdaIntegration(meetingHandler));

    // '${BASE_URL}/pre_meetings
    const preMeetingsResource = apigateway.root.addResource('pre_meetings');
    preMeetingsResource.addMethod('POST', new ApiGateway.LambdaIntegration(meetingHandler));

    // '${BASE_URL}/breakout_rooms
    const breakout_roomsResource = apigateway.root.addResource('breakout_rooms');
    breakout_roomsResource.addMethod('POST', new ApiGateway.LambdaIntegration(meetingHandler));
    // '${BASE_URL}/breakout_rooms/{task_meta_info_id}
    const breakout_roomResource = breakout_roomsResource.addResource('{task_meta_info_id}');
    breakout_roomResource.addMethod('POST', new ApiGateway.LambdaIntegration(meetingHandler));
    breakout_roomResource.addMethod('GET', new ApiGateway.LambdaIntegration(meetingHandler));

    if (checkDomainEnv(env)) {
      // カスタムドメイン
      apigateway.addDomainName('addDomainName', {
        domainName: domainName,
        certificate: certificate,
        endpointType: ApiGateway.EndpointType.EDGE
      });
      new route53.ARecord(this, "ARecord", {
        zone: zone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(
            new route53Targets.ApiGateway(apigateway),
        )
      });
    }
  }
}

function checkDomainEnv(env: string){
  return (env == 'dev' || env == 'stg' || env == 'prd')
}

const app = new cdk.App();
app.synth();
