import mqtt from "mqtt";
import { deviceStatusMonitor } from './services/deviceStatusMonitor';
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

export function connectMqtt(onMessage, deviceTopicBase = null, onDeviceStatusChange = null) {
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
      client.subscribe(`${baseTopic}/heartbeat`);
      client.subscribe(`${baseTopic}/online`);
      client.subscribe(`${baseTopic}/offline`);
      console.log(`📡 Subscribed to ${baseTopic} topics: status, sensor, heartbeat, online, offline`);
    }
    
    // Subscribe to global device status topics (legacy format)
    client.subscribe('devices/+/heartbeat');
    client.subscribe('devices/+/online');
    client.subscribe('devices/+/offline');
    client.subscribe('devices/+/status');
    
    // Subscribe to new 5-second status reporting format
    client.subscribe('device/+/status');
    client.subscribe('device/+/online');
    client.subscribe('device/+/offline');
    console.log('📡 Subscribed to device status topics (both legacy and new format)');
  });
  
  client.on("error", (err) => console.error("❌ MQTT Error:", err));
  
  client.on("message", (topic, message) => {
    try { 
      const data = JSON.parse(message.toString());
      
      // Handle device status changes
      if (topic.includes('/heartbeat') || topic.includes('/online') || topic.includes('/offline') || topic.includes('/status')) {
        const macAddress = data.macAddress || extractMacFromTopic(topic);
        
        // Determine if device is online based on message type and content
        let isOnline = false;
        if (topic.includes('/online') || topic.includes('/heartbeat')) {
          isOnline = true;
        } else if (topic.includes('/offline')) {
          isOnline = false;
        } else if (topic.includes('/status')) {
          // For 5-second status messages, check the status field
          isOnline = data.status === 'online';
        }
        
        // Update device status monitor
        if (topic.includes('/heartbeat')) {
          deviceStatusMonitor.handleHeartbeat(macAddress, data);
        } else if (topic.includes('/online')) {
          deviceStatusMonitor.handleDeviceOnline(macAddress, data);
        } else if (topic.includes('/offline')) {
          deviceStatusMonitor.handleDeviceOffline(macAddress, data);
        } else if (topic.includes('/status')) {
          // Handle 5-second status reports as heartbeat
          deviceStatusMonitor.handleHeartbeat(macAddress, data);
          console.log(`📊 5-second status from ${macAddress}: ${data.status}`);
        }
        
        // Call legacy callback if provided
        if (onDeviceStatusChange) {
          onDeviceStatusChange(macAddress, isOnline, data);
        }
      }
      
      onMessage(topic, data); 
    } catch (error) { 
      // Handle non-JSON messages (like simple status messages)
      const messageStr = message.toString();
      console.log(`📨 Received message on ${topic}: ${messageStr}`);
      
      // Handle simple status messages
      if (topic.includes('/online') || topic.includes('/offline') || topic.includes('/heartbeat')) {
        const macAddress = extractMacFromTopic(topic) || messageStr;
        const isOnline = topic.includes('/online') || topic.includes('/heartbeat');
        
        // Update device status monitor
        if (topic.includes('/heartbeat')) {
          deviceStatusMonitor.handleHeartbeat(macAddress, { message: messageStr });
        } else if (topic.includes('/online')) {
          deviceStatusMonitor.handleDeviceOnline(macAddress, { message: messageStr });
        } else if (topic.includes('/offline')) {
          deviceStatusMonitor.handleDeviceOffline(macAddress, { message: messageStr });
        }
        
        // Call legacy callback if provided
        if (onDeviceStatusChange) {
          onDeviceStatusChange(macAddress, isOnline, { message: messageStr });
        }
      }
      
      onMessage(topic, { message: messageStr });
    }
  });
  
  return client;
}

// Helper function to extract MAC address from topic
function extractMacFromTopic(topic) {
  const parts = topic.split('/');
  
  // Handle both topic formats:
  // Legacy: devices/AABBCCDDEEFF/status
  // New: device/AA:BB:CC:DD:EE:FF/status
  
  for (const part of parts) {
    // Check for MAC with colons (new format)
    if (part.match(/^[A-Fa-f0-9]{2}:[A-Fa-f0-9]{2}:[A-Fa-f0-9]{2}:[A-Fa-f0-9]{2}:[A-Fa-f0-9]{2}:[A-Fa-f0-9]{2}$/)) {
      return part.toUpperCase();
    }
    // Check for MAC without colons (legacy format)
    if (part.match(/^[A-Fa-f0-9]{12}$/)) {
      // Format MAC address with colons
      return part.replace(/(.{2})/g, '$1:').slice(0, -1).toUpperCase();
    }
  }
  return null;
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

// Send ping to device to check if it's online
export function pingDevice(deviceTopicBase) {
  if (!client || !client.connected) {
    console.warn("MQTT client not connected");
    return false;
  }
  
  const message = JSON.stringify({
    command: 'PING',
    timestamp: new Date().toISOString(),
    requestId: Math.random().toString(36).substr(2, 9)
  });
  
  client.publish(`${deviceTopicBase}/ping`, message);
  console.log(`🏓 Ping sent to ${deviceTopicBase}/ping`);
  return true;
}

// Request device status
export function requestDeviceStatus(deviceTopicBase) {
  if (!client || !client.connected) {
    console.warn("MQTT client not connected");
    return false;
  }
  
  const message = JSON.stringify({
    command: 'STATUS_REQUEST',
    timestamp: new Date().toISOString()
  });
  
  client.publish(`${deviceTopicBase}/control`, message);
  console.log(`📋 Status request sent to ${deviceTopicBase}/control`);
  return true;
}

// Publish device heartbeat (for testing purposes)
export function publishHeartbeat(macAddress) {
  if (!client || !client.connected) {
    console.warn("MQTT client not connected");
    return false;
  }
  
  const deviceTopic = `devices/${macAddress.replace(/:/g, '')}`;
  const message = JSON.stringify({
    macAddress: macAddress,
    timestamp: new Date().toISOString(),
    status: 'online'
  });
  
  client.publish(`${deviceTopic}/heartbeat`, message);
  console.log(`💓 Heartbeat published for ${macAddress}`);
  return true;
}

// Disconnect MQTT client
export function disconnectMqtt() {
  if (client && client.connected) {
    client.end();
    console.log("🔌 MQTT Disconnected");
  }
}