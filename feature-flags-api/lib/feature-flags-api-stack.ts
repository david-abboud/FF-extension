import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class FeatureFlagsApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB table
    const table = new dynamodb.Table(this, 'FeatureFlagsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    });

    // Add GSI for auto-incrementing id
    table.addGlobalSecondaryIndex({
      indexName: 'TypeIndex',
      partitionKey: { name: 'type', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    });

    // Create Lambda function
    const featureFlagsFunction = new lambda.Function(this, 'FeatureFlagsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    // Grant Lambda function read/write permissions to DynamoDB table
    table.grantReadWriteData(featureFlagsFunction);

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'FeatureFlagsApi', {
      restApiName: 'Feature Flags Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });

    // Add API Key
    const apiKey = api.addApiKey('FeatureFlagsApiKey');

    // Create usage plan
    const plan = api.addUsagePlan('FeatureFlagsUsagePlan', {
      name: 'Feature Flags Usage Plan',
    });

    // Add API to usage plan
    plan.addApiStage({
      stage: api.deploymentStage
    });

    // Associate the API key with the usage plan
    plan.addApiKey(apiKey);

    const featureFlags = api.root.addResource('feature-flags');
    
    // GET method
    featureFlags.addMethod('GET', new apigateway.LambdaIntegration(featureFlagsFunction), {
      apiKeyRequired: true
    });
    
    // POST method (Add)
    featureFlags.addMethod('POST', new apigateway.LambdaIntegration(featureFlagsFunction), {
      apiKeyRequired: true
    });

    // DELETE method
    const singleFlag = featureFlags.addResource('{id}');
    singleFlag.addMethod('DELETE', new apigateway.LambdaIntegration(featureFlagsFunction), {
      apiKeyRequired: true
    });

    // Output the API URL and API Key
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
