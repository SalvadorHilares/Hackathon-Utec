const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn');

const client = new SFNClient({ region: process.env.REGION || 'us-east-1' });

/**
 * Iniciar ejecución de Step Functions
 */
async function startExecution(stateMachineArn, input) {
  try {
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

