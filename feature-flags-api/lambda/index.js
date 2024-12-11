const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

const corsHeaders = {
  'Access-Control-Allow-Origin': 'chrome-extension://cgpijpjnpkaolmnmlgbimmjhgfapfjcj',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT,POST,DELETE'
};

// Rate limiting only for POST requests
const RATE_LIMIT = 10;
const TIME_WINDOW = 60000; // 1 minute

async function checkRateLimit(ipAddress) {
  const now = Date.now();
  const windowStart = now - TIME_WINDOW;
  
  try {
    const getCommand = new GetCommand({
      TableName: process.env.RATE_LIMIT_TABLE,
      Key: {
        id: `ratelimit_${ipAddress}`
      }
    });
    
    const result = await dynamodb.send(getCommand);
    const requests = result.Item?.timestamps || [];
    
    // Clean old timestamps and check limit
    const recentRequests = requests.filter(time => time > windowStart);
    if (recentRequests.length >= RATE_LIMIT) {
      return false;
    }
    
    // Update timestamps
    const putCommand = new PutCommand({
      TableName: process.env.RATE_LIMIT_TABLE,
      Item: {
        id: `ratelimit_${ipAddress}`,
        timestamps: [...recentRequests, now],
        ttl: Math.floor((now + TIME_WINDOW) / 1000) // Auto-delete after time window
      }
    });
    
    await dynamodb.send(putCommand);
    return true;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return true; // Fail open to avoid blocking legitimate requests
  }
}

exports.handler = async (event) => {
  const TABLE_NAME = process.env.TABLE_NAME;
  let response;

  try {
    switch (event.httpMethod) {
      case 'GET':
        response = await getFeatureFlags(TABLE_NAME, event.path);
        break;
      case 'POST':
        const ipAddress = event.requestContext.identity.sourceIp;
        const isAllowed = await checkRateLimit(ipAddress);
        
        if (!isAllowed) {
          return {
            statusCode: 429,
            headers: corsHeaders,
            body: JSON.stringify('Too many requests. Please try again later.')
          };
        }
        response = await addFeatureFlag(TABLE_NAME, JSON.parse(event.body));
        break;
      case 'DELETE':
        const id = event.pathParameters?.id;
        response = await deleteFeatureFlag(TABLE_NAME, id);
        break;
      default:
        response = {
          statusCode: 400,
          body: JSON.stringify('Unsupported HTTP method'),
        };
    }
  } catch (error) {
    console.error('Error:', error);
    response = {
      statusCode: 500,
      body: JSON.stringify('Internal server error'),
    };
  }

  return {
    ...response,
    headers: { ...corsHeaders, ...response.headers },
  };
};

async function getFeatureFlags(tableName, path) {
  try {
    let params = {
      TableName: tableName,
    };

    // If path includes type specification, add filter
    if (path) {
      const flagType = path.split('/').pop(); // Gets 'local' or 'proj05' from the path
      if (flagType === 'local' || flagType === 'proj05') {
        params = {
          TableName: tableName,
          FilterExpression: '#type = :typeValue',
          ExpressionAttributeNames: {
            '#type': 'type'
          },
          ExpressionAttributeValues: {
            ':typeValue': flagType
          }
        };
      }
    }

    const command = new ScanCommand(params);
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
        type: featureFlag.type === 'proj05' ? 'proj05' : 'local',
      }
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
    const getCommand = new GetCommand({
      TableName: tableName,
      Key: { id },
    });
    const existingItem = await dynamodb.send(getCommand);

    if (!existingItem.Item) {
      console.error(`Feature flag with ID ${id} not found`);
      return {
        statusCode: 404,
        body: JSON.stringify(`Error: Feature flag with ID ${id} not found`),
      };
    }

    const deleteCommand = new DeleteCommand({
      TableName: tableName,
      Key: { id },
    });
    await dynamodb.send(deleteCommand);

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
  const command = new ScanCommand({
    TableName: tableName,
    ProjectionExpression: 'id',
  });
  const result = await dynamodb.send(command);
  
  let maxNumber = 0;
  result.Items.forEach(item => {
    const num = parseInt(item.id.slice(3), 10);
    if (num > maxNumber) maxNumber = num;
  });

  const nextNumber = maxNumber + 1;
  return `cbx${nextNumber.toString().padStart(2, '0')}`;
}
