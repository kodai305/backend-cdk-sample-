#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipelineStack';
import { SampleBackendDBStack } from '../lib/sample-backend-db-stack';
import { SampleBackendAPIStack } from '../lib/sample-backend-api-stack';


const app = new cdk.App();

new PipelineStack(app, `SampleBackendPipelineStack`, {
  env: { account: '', region: 'ap-northeast-1' },
  stagingAPIDeployConfig: {
    env: {
      region: "ap-northeast-1",
      account: ''
    },
    stackName: 'sample-backend-api-stg-stack',
    appConfig: {
      baseDomainName: '',
      hostedZoneId: '',
      domainName: '',
      apidocDomainName: '',
      targetApiUrl: '',
      appEnv: 'stg',
    },
  },
  stagingDBDeployConfig: {
    env: {
      region: "ap-northeast-1",
      account: '383821837167'
    },
    stackName: 'sample-backend-db-stg-stack',
    appConfig: {
      appEnv: 'stg',
    },
  },
  stagingAPIDocDeployConfig: {
    env: {
      region: "ap-northeast-1",
      account: ''
    },
    stackName: 'sample-backend-apidoc-stg-stack',
    appConfig: {
      baseDomainName: '',
      hostedZoneId: '',
      domainName: '',
      apidocDomainName: '',
      appEnv: 'stg',
    },
  },
  productionAPIDeployConfig: {
    env: {
      region: 'ap-northeast-1',
      account: ''
    },
    stackName: 'sample-backend-api-prd-stack',
    appConfig: {
      baseDomainName: '',
      hostedZoneId: '',
      domainName: '',
      apidocDomainName: '',
      targetApiUrl: '',
      appEnv: 'prd',
    },
  },
  productionDBDeployConfig: {
    env: {
      region: 'ap-northeast-1',
      account: ''
    },
    stackName: 'sample-backend-db-prd-stack',
    appConfig: {
      appEnv: 'prd',
    },
  },
  productionAPIDocDeployConfig: {
    env: {
      region: 'ap-northeast-1',
      account: ''
    },
    stackName: 'sample-backend-apidoc-prd-stack',
    appConfig: {
      baseDomainName: '',
      hostedZoneId: '',
      domainName: '',
      apidocDomainName: '',
      appEnv: 'prd',
    },
  },  
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

new SampleBackendDBStack(app, `SampleBackendDBStack`, {
  env: {
    account: '',
    region: 'ap-northeast-1'
  }
});

new SampleBackendAPIStack(app, `SampleBackendAPIStack`, {
  env: {
    account: '',
    region: 'ap-northeast-1'
  },
  appConfig: {
    baseDomainName: '',
    hostedZoneId: '',
    targetApiUrl: '',
    domainName: '',
    apidocDomainName: '',
    appEnv: 'dev'
  }
});
