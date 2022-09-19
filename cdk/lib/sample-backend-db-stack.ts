import { Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { UpdatePolicy } from 'aws-cdk-lib/aws-autoscaling';

export type DBConfig = {
  appEnv: 'stg' | 'prd';
}

export interface ApiDocStackProps extends StackProps {
  appConfig: DBConfig;
}

export class SampleBackendDBStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // meetings table
    const meetingsTable = new dynamodb.Table(this, 'sample-backend-db', {
      tableName: 'sample-table',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    })
    meetingsTable.addGlobalSecondaryIndex({
      indexName: 'GSIId',
      partitionKey: {
        name: 'gsi_id',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });    
  }
}
const app = new cdk.App();
app.synth();