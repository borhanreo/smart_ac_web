import mqtt from "mqtt";
let client = null;

// Helper function to determine the correct protocol and URL format
function formatBrokerUrl(brokerUrl) {
  // If the URL already has a protocol, use it as-is
  if (brokerUrl.startsWith('ws://') || brokerUrl.startsWith('wss://')) {
    return brokerUrl;
  }
  
  // If it's a plain MQTT URL (mqtt://), convert to WebSocket
  if (brokerUrl.startsWith('mqtt://')) {
    return brokerUrl.replace('mqtt://', 'ws://');
  }
  
  // If it's a secure MQTT URL (mqtts://), convert to secure WebSocket
  if (brokerUrl.startsWith('mqtts://')) {
    return brokerUrl.replace('mqtts://', 'wss://');
  }
  
  // If no protocol specified, assume WebSocket
  return `ws://${brokerUrl}`;
}

export function connectMqtt(onMessage, deviceTopicBase = null) {
  const options = {
    username: process.env.REACT_APP_MQTT_USERNAME,
    password: process.env.REACT_APP_MQTT_PASSWORD,
    reconnectPeriod: 2000,
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,
    connectTimeout: 30 * 1000, // 30 seconds
    clientId: 'mqtt_client_' + Math.random().toString(16).substr(2, 8),
  };
  
  // Format the broker URL for WebSocket compatibility
  const rawBrokerUrl = process.env.REACT_APP_MQTT_BROKER;
  const brokerUrl = formatBrokerUrl(rawBrokerUrl);
  
  console.log('Connecting to MQTT broker:', brokerUrl);
  
  // Disconnect existing client if any
  if (client && client.connected) {
    client.end();
  }
  
  client = mqtt.connect(brokerUrl, options);
  
  client.on("connect", () => {
    console.log("✅ MQTT Connected");
    
    // Subscribe to device-specific topics
    const baseTopic = deviceTopicBase || process.env.REACT_APP_MQTT_TOPIC_BASE;
    if (baseTopic) {
      client.subscribe(`${baseTopic}/status`);
      client.subscribe(`${baseTopic}/sensor`);
      console.log(`📡 Subscribed to ${baseTopic}/status and ${baseTopic}/sensor`);
    }
  });
  
  client.on("error", (err) => console.error("❌ MQTT Error:", err));
  
  client.on("message", (topic, message) => {
    try { 
      const data = JSON.parse(message.toString());
      onMessage(topic, data); 
    } catch { 
      console.warn("Invalid message:", message.toString()); 
    }
  });
  
  return client;
}
export function sendCommand(command, payload = {}, deviceTopicBase = null) {
  if (!client || !client.connected) {
    console.warn("MQTT client not connected");
    return false;
  }
  
  const baseTopic = deviceTopicBase || process.env.REACT_APP_MQTT_TOPIC_BASE;
  if (!baseTopic) {
    console.error("No topic base available");
    return false;
  }
  
  const message = JSON.stringify({ 
    command, 
    timestamp: new Date().toISOString(),
    ...payload 
  });
  
  client.publish(`${baseTopic}/control`, message);
  console.log(`📤 Sent command to ${baseTopic}/control:`, { command, ...payload });
  return true;
}

// Disconnect MQTT client
export function disconnectMqtt() {
  if (client && client.connected) {
    client.end();
    console.log("🔌 MQTT Disconnected");
  }
}