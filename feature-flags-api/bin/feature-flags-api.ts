#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FeatureFlagsApiStack } from '../lib/feature-flags-api-stack';

const app = new cdk.App();
new FeatureFlagsApiStack(app, 'FeatureFlagsApiStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
});