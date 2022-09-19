import { Stage, StageProps } from "aws-cdk-lib";
import { ApiAppConfig, SampleBackendAPIStack } from "./sample-backend-api-stack";
import { DBConfig, SampleBackendDBStack } from "./sample-backend-db-stack";
import { ApiDocConfig, APIDocStack } from "./apidoc-stack";
import { Construct } from 'constructs';

export interface ApiAppStageProps extends StageProps {
  appConfig: ApiAppConfig
}

export interface DBStageProps extends StageProps {
  appConfig: DBConfig
}

export interface ApiDocStageProps extends StageProps {
  appConfig: ApiDocConfig
}

export class ApiAppStage extends Stage {
  // public readonly appUrlOutput: CfnOutput;
  constructor(scope: Construct, id: string, props: ApiAppStageProps) {
    super(scope, id, props);
    new SampleBackendAPIStack(this, `sample-backend-api-${props.appConfig.appEnv}-infrastack`, props);
  }
}

export class DBStage extends Stage {
  constructor(scope: Construct, id: string, props: DBStageProps) {
    super(scope, id);
    new SampleBackendDBStack(this, `sample-backend-db-infrastack`, props);
  }
}

export class ApiDocStage extends Stage {
  constructor(scope: Construct, id: string, props: ApiDocStageProps) {
    super(scope, id);
    new APIDocStack(this, `sample-backend-apidoc-infrastack`, props);  
  }
}
