const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

const client = new SFNClient({ region: process.env.REGION || 'us-east-1' });
const stsClient = new STSClient({ region: process.env.REGION || 'us-east-1' });

/**
 * Construir ARN de Step Functions desde el nombre
 */
async function getStateMachineArn(stateMachineName) {
  try {
    // Si ya es un ARN, retornarlo
    if (stateMachineName.startsWith('arn:aws:states:')) {
      return stateMachineName;
    }
    
    // Obtener account ID
    const identityCommand = new GetCallerIdentityCommand({});
    const identity = await stsClient.send(identityCommand);
    const accountId = identity.Account;
    const region = process.env.REGION || 'us-east-1';
    
    // Construir ARN
    return `arn:aws:states:${region}:${accountId}:stateMachine:${stateMachineName}`;
  } catch (error) {
    console.error('Error getting state machine ARN:', error);
    throw error;
  }
}

/**
 * Iniciar ejecución de Step Functions
 */
async function startExecution(stateMachineArnOrName, input) {
  try {
    // Construir ARN si es necesario
    const stateMachineArn = await getStateMachineArn(stateMachineArnOrName);
    
    const command = new StartExecutionCommand({
      stateMachineArn: stateMachineArn,
      input: JSON.stringify(input)
    });
    
    const response = await client.send(command);
    return response;
  } catch (error) {
    console.error('Error starting Step Functions execution:', error);
    throw error;
  }
}

/**
 * Enviar éxito de tarea a Step Functions
 */
async function sendTaskSuccess(taskToken, output) {
  const { SFNClient, SendTaskSuccessCommand } = require('@aws-sdk/client-sfn');
  const sfnClient = new SFNClient({ region: process.env.REGION || 'us-east-1' });
  
  try {
    const command = new SendTaskSuccessCommand({
      taskToken: taskToken,
      output: JSON.stringify(output)
    });
    
    await sfnClient.send(command);
    return { success: true };
  } catch (error) {
    console.error('Error sending task success to Step Functions:', error);
    throw error;
  }
}

/**
 * Enviar fallo de tarea a Step Functions
 */
async function sendTaskFailure(taskToken, error, cause) {
  const { SFNClient, SendTaskFailureCommand } = require('@aws-sdk/client-sfn');
  const sfnClient = new SFNClient({ region: process.env.REGION || 'us-east-1' });
  
  try {
    const command = new SendTaskFailureCommand({
      taskToken: taskToken,
      error: error,
      cause: cause
    });
    
    await sfnClient.send(command);
    return { success: true };
  } catch (error) {
    console.error('Error sending task failure to Step Functions:', error);
    throw error;
  }
}

module.exports = {
  startExecution,
  sendTaskSuccess,
  sendTaskFailure
};

