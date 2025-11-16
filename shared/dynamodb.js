const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Obtener un item de DynamoDB
 */
async function getItem(tableName, key) {
  try {
    const command = new GetCommand({
      TableName: tableName,
      Key: key
    });
    const response = await docClient.send(command);
    return response.Item;
  } catch (error) {
    console.error('Error getting item from DynamoDB:', error);
    throw error;
  }
}

/**
 * Guardar un item en DynamoDB
 */
async function putItem(tableName, item) {
  try {
    const command = new PutCommand({
      TableName: tableName,
      Item: item
    });
    await docClient.send(command);
    return item;
  } catch (error) {
    console.error('Error putting item to DynamoDB:', error);
    throw error;
  }
}

/**
 * Actualizar un item en DynamoDB
 */
async function updateItem(tableName, key, updateExpression, expressionAttributeValues, expressionAttributeNames = null) {
  try {
    const params = {
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };
    
    if (expressionAttributeNames) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }
    
    const command = new UpdateCommand(params);
    const response = await docClient.send(command);
    return response.Attributes;
  } catch (error) {
    console.error('Error updating item in DynamoDB:', error);
    throw error;
  }
}

/**
 * Query a DynamoDB table
 */
async function query(tableName, keyConditionExpression, expressionAttributeValues, indexName = null) {
  try {
    const params = {
      TableName: tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues
    };
    
    if (indexName) {
      params.IndexName = indexName;
    }
    
    const command = new QueryCommand(params);
    const response = await docClient.send(command);
    return response.Items;
  } catch (error) {
    console.error('Error querying DynamoDB:', error);
    throw error;
  }
}

/**
 * Scan a DynamoDB table with filters
 */
async function scan(tableName, filterExpression = null, expressionAttributeValues = null, expressionAttributeNames = null) {
  try {
    const params = {
      TableName: tableName
    };
    
    if (filterExpression) {
      params.FilterExpression = filterExpression;
    }
    
    if (expressionAttributeValues) {
      params.ExpressionAttributeValues = expressionAttributeValues;
    }
    
    if (expressionAttributeNames) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }
    
    const command = new ScanCommand(params);
    const response = await docClient.send(command);
    return response.Items;
  } catch (error) {
    console.error('Error scanning DynamoDB:', error);
    throw error;
  }
}

/**
 * Eliminar un item de DynamoDB
 */
async function deleteItem(tableName, key) {
  try {
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key
    });
    await docClient.send(command);
    return { success: true };
  } catch (error) {
    console.error('Error deleting item from DynamoDB:', error);
    throw error;
  }
}

/**
 * Generar UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Obtener timestamp ISO 8601
 */
function getTimestamp() {
  return new Date().toISOString();
}

module.exports = {
  getItem,
  putItem,
  updateItem,
  query,
  scan,
  deleteItem,
  generateUUID,
  getTimestamp
};

