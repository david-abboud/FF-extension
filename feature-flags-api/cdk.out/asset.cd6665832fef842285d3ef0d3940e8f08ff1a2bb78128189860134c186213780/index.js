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
    const nextId = await getNextId(tableName);
    const params = {
      TableName: tableName,
      Item: {
        id: nextId,
        value: featureFlag.value,
        type: featureFlag.type,
      },
    };
    await dynamodb.put(params).promise();
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Feature flag added successfully', id: nextId }),
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

async function getNextId(tableName) {
  const params = {
    TableName: tableName,
    ProjectionExpression: 'id',
    ScanIndexForward: false,
    Limit: 1,
  };

  const result = await dynamodb.scan(params).promise();
  if (result.Items.length > 0) {
    const lastId = result.Items[0].id;
    const lastNumber = parseInt(lastId.slice(3), 10);
    return `cbx${(lastNumber + 1).toString().padStart(2, '0')}`;
  } else {
    return 'cbx01';
  }
}
