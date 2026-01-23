const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  const TABLE_NAME = process.env.TABLE_NAME;

  switch (event.httpMethod) {
    case 'GET':
      return await getFeatureFlags(TABLE_NAME);
    case 'POST':
      return await addFeatureFlag(TABLE_NAME, JSON.parse(event.body));
    case 'DELETE':
      const id = event.pathParameters?.id;
      return await deleteFeatureFlag(TABLE_NAME, id);
    default:
      return {
        statusCode: 400,
        body: JSON.stringify('Unsupported HTTP method'),
      };
  }
};

async function getFeatureFlags(tableName) {
  try {
    const command = new ScanCommand({
      TableName: tableName,
    });
    const result = await dynamodb.send(command);
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
    const command = new PutCommand({
      TableName: tableName,
      Item: {
        id: nextId,
        value: featureFlag.value,
        type: featureFlag.type,
      },
    });
    await dynamodb.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Feature flag added successfully', id: nextId }),
    };
  } catch (error) {
    console.error('Error adding feature flag:', error);
    return {
      statusCode: 500,
      body: JSON.stringify(`Error adding feature flag: ${error.message}`),
    };
  }
}

async function deleteFeatureFlag(tableName, id) {
  if (!id) {
    console.error('No ID provided for deletion');
    return {
      statusCode: 400,
      body: JSON.stringify('Error: No ID provided for deletion'),
    };
  }
  
  try {
    const command = new DeleteCommand({
      TableName: tableName,
      Key: { id },
    });
    await dynamodb.send(command);
    return {
      statusCode: 200,
      body: JSON.stringify(`Feature flag with ID ${id} deleted successfully`),
    };
  } catch (error) {
    console.error(`Error deleting feature flag with ID ${id}:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify(`Error deleting feature flag with ID ${id}`),
    };
  }
}

async function getNextId(tableName) {
  try {
    const command = new ScanCommand({
      TableName: tableName,
      ProjectionExpression: 'id',
      ScanIndexForward: false,
      Limit: 1,
    });
    const result = await dynamodb.send(command);
    console.log('Scan result:', JSON.stringify(result));
    if (result.Items && result.Items.length > 0) {
      const lastId = result.Items[0].id;
      console.log('Last ID:', lastId);
      const lastNumber = parseInt(lastId.slice(3), 10);
      const nextId = `cbx${(lastNumber + 1).toString().padStart(2, '0')}`;
      console.log('Next ID:', nextId);
      return nextId;
    } else {
      console.log('No existing items, starting with cbx01');
      return 'cbx01';
    }
  } catch (error) {
    console.error('Error in getNextId:', error);
    throw error;
  }
}
