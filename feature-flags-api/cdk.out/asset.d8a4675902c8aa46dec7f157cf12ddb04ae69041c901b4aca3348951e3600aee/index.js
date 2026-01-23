const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  const TABLE_NAME = process.env.TABLE_NAME;

  switch (event.httpMethod) {
    case 'GET':
      return await getFeatureFlags(TABLE_NAME);
    case 'POST':
      return await addFeatureFlag(TABLE_NAME, JSON.parse(event.body));
    case 'DELETE':
      return await deleteFeatureFlag(TABLE_NAME, event.pathParameters.id);
    default:
      return {
        statusCode: 400,
        body: JSON.stringify('Unsupported HTTP method'),
      };
  }
};

async function getFeatureFlags(tableName) {
  try {
    const params = {
      TableName: tableName,
    };
    const result = await dynamodb.scan(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify(result.Items),
    };
  } catch (error) {
    console.error('Error reading feature flags:', error);
    return {
      statusCode: 500,
      body: JSON.stringify('Error reading feature flags'),
    };
  }
}

async function addFeatureFlag(tableName, featureFlag) {
  try {
    const params = {
      TableName: tableName,
      Item: featureFlag,
    };
    await dynamodb.put(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify('Feature flag added successfully'),
    };
  } catch (error) {
    console.error('Error adding feature flag:', error);
    return {
      statusCode: 500,
      body: JSON.stringify('Error adding feature flag'),
    };
  }
}

async function deleteFeatureFlag(tableName, id) {
  try {
    const params = {
      TableName: tableName,
      Key: {
        id: id,
      },
    };
    await dynamodb.delete(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify('Feature flag deleted successfully'),
    };
  } catch (error) {
    console.error('Error deleting feature flag:', error);
    return {
      statusCode: 500,
      body: JSON.stringify('Error deleting feature flag'),
    };
  }
}
