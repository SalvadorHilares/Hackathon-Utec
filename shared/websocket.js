const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

/**
 * Enviar mensaje a una conexión WebSocket
 */
async function sendMessage(apiEndpoint, connectionId, message) {
  try {
    const client = new ApiGatewayManagementApiClient({
      endpoint: apiEndpoint
    });
    
    const command = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(message)
    });
    
    await client.send(command);
    return { success: true };
  } catch (error) {
    console.error('Error sending WebSocket message:', error);
    throw error;
  }
}

/**
 * Construir endpoint de API Gateway WebSocket
 */
function getWebSocketEndpoint(apiId, region, stage) {
  return `https://${apiId}.execute-api.${region}.amazonaws.com/${stage}`;
}

module.exports = {
  sendMessage,
  getWebSocketEndpoint
};

