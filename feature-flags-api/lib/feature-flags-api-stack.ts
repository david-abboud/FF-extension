import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class FeatureFlagsApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'FeatureFlagsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for auto-incrementing id
    table.addGlobalSecondaryIndex({
      indexName: 'TypeIndex',
      partitionKey: { name: 'type', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    });

    const featureFlagsFunction = new lambda.Function(this, 'FeatureFlagsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    table.grantReadWriteData(featureFlagsFunction);

    const api = new apigateway.RestApi(this, 'FeatureFlagsApi', {
      restApiName: 'Feature Flags Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token', 'X-Amz-User-Agent'],
        allowCredentials: true,
      }
    });

    const apiKey = api.addApiKey('FeatureFlagsApiKey');

    const plan = api.addUsagePlan('FeatureFlagsUsagePlan', {
      name: 'Feature Flags Usage Plan',
    });

    plan.addApiStage({
      stage: api.deploymentStage
    });

    plan.addApiKey(apiKey);

    const featureFlags = api.root.addResource('feature-flags');
    
    // Add new resources for specific feature flag types
    const localFlags = featureFlags.addResource('local');
    const proj05Flags = featureFlags.addResource('proj05');
    
    // Main GET endpoint (keeps backward compatibility)
    featureFlags.addMethod('GET', new apigateway.LambdaIntegration(featureFlagsFunction), {
      apiKeyRequired: true
    });
    
    localFlags.addMethod('GET', new apigateway.LambdaIntegration(featureFlagsFunction), {
      apiKeyRequired: true
    });
    
    proj05Flags.addMethod('GET', new apigateway.LambdaIntegration(featureFlagsFunction), {
      apiKeyRequired: true
    });

    featureFlags.addMethod('POST', new apigateway.LambdaIntegration(featureFlagsFunction), {
      apiKeyRequired: true
    });

    const singleFlag = featureFlags.addResource('{id}');
    singleFlag.addMethod('DELETE', new apigateway.LambdaIntegration(featureFlagsFunction), {
      apiKeyRequired: true
    });

    const rateLimitTable = new dynamodb.Table(this, 'RateLimitTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    featureFlagsFunction.addEnvironment('RATE_LIMIT_TABLE', rateLimitTable.tableName);
    rateLimitTable.grantReadWriteData(featureFlagsFunction);

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'ApiKey', {
      value: apiKey.keyId,
      description: 'API Key ID',
    });
  }
}
