import { RemovalPolicy, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { aws_s3,aws_s3_deployment} from 'aws-cdk-lib';
import {aws_cloudfront,aws_cloudfront_origins,Duration} from 'aws-cdk-lib';

export type ApiDocConfig = {
  baseDomainName: string;
  hostedZoneId: string;
  domainName: string;
  apidocDomainName: string;
  appEnv: 'stg' | 'prd';
}

export interface ApiDocStackProps extends StackProps {
  appConfig: ApiDocConfig;
}

export class APIDocStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: ApiDocStackProps) {
    super(scope, id, props);

    // Route53
    const baseDomainName = props?.appConfig.baseDomainName ? props?.appConfig.baseDomainName : '';
    const hostZoneId = props?.appConfig.hostedZoneId ? props?.appConfig.hostedZoneId : '';
    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'MyZone', {
      hostedZoneId: hostZoneId,
      zoneName: baseDomainName
    }); 

    // ACM (us-east-1)
    const apidocDomainName = props?.appConfig.apidocDomainName ? props?.appConfig.apidocDomainName : '';
    const certificate = new acm.DnsValidatedCertificate(this, 'CrossRegionCertificate', {
      domainName: apidocDomainName,
      hostedZone: zone,
      region: 'us-east-1',
    });


    // TODO: バケット名をつける
    const buildBucket = new aws_s3.Bucket(this, "BuildBucket",{
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new aws_cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new aws_cloudfront_origins.S3Origin(buildBucket),
        viewerProtocolPolicy: aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(5),
        },
      ],
      domainNames: [apidocDomainName],
      certificate: certificate,      
    });

    // Route 53 でレコードを追加
    new route53.ARecord(this, 'Alias', {
      zone: zone,
      recordName: apidocDomainName,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });

    // デプロイするフォルダを指定
    new aws_s3_deployment.BucketDeployment(this,'ApiDocDeploy',{
      sources: [aws_s3_deployment.Source.asset('../docs')],
      destinationBucket: buildBucket,
      distribution: distribution
    });    
  }
}
const app = new cdk.App();
app.synth();
