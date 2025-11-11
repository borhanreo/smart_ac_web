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
      console.log(`📨 MQTT Message received on topic: ${topic}`, data);
      
      // Special handling for IR learning responses
      if (data.type === 'ir_learning_response') {
        console.log(`🎛️ IR LEARNING RESPONSE DETECTED!`);
        console.log(`🎛️ Topic: ${topic}`);
        console.log(`🎛️ Data:`, data);
        console.log(`🎛️ Available callbacks:`, Object.keys(client.topicCallbacks || {}));
      }
      
      // Call topic-specific callbacks first
      if (client.topicCallbacks && client.topicCallbacks[topic]) {
        console.log(`🎯 Calling topic-specific callback for: ${topic}`);
        client.topicCallbacks[topic](topic, message);
      } else {
        console.log(`⚠️ No topic-specific callback found for: ${topic}`);
        console.log(`📋 Available callbacks:`, Object.keys(client.topicCallbacks || {}));
        
        // Special debug for IR learning responses
        if (data.type === 'ir_learning_response') {
          console.log(`❌ IR LEARNING RESPONSE BUT NO CALLBACK!`);
          console.log(`❌ Expected topic format: devices/{mac}/response`);
          console.log(`❌ Actual topic: ${topic}`);
        }
      }
      
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
      
      // Call topic-specific callbacks for non-JSON messages too
      if (client.topicCallbacks && client.topicCallbacks[topic]) {
        client.topicCallbacks[topic](topic, message);
      }
      
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

// Subscribe to a specific topic with callback
export function subscribeToTopic(topic, messageCallback) {
  if (!client || !client.connected) {
    console.warn("⚠️ MQTT client not connected for subscription to:", topic);
    return false;
  }
  
  console.log(`🔔 Attempting to subscribe to topic: ${topic}`);
  
  client.subscribe(topic, (err) => {
    if (err) {
      console.error(`❌ Failed to subscribe to ${topic}:`, err);
      return false;
    }
    console.log(`✅ Successfully subscribed to: ${topic}`);
  });

  // Store the callback for this topic
  if (!client.topicCallbacks) {
    client.topicCallbacks = {};
    console.log(`📋 Initialized topic callbacks store`);
  }
  
  client.topicCallbacks[topic] = messageCallback;
  console.log(`💾 Stored callback for topic: ${topic}`);
  console.log(`📋 Total registered callbacks: ${Object.keys(client.topicCallbacks).length}`);

  return true;
}

// Unsubscribe from a specific topic
export function unsubscribeFromTopic(topic) {
  if (!client || !client.connected) {
    console.warn("MQTT client not connected");
    return false;
  }
  
  client.unsubscribe(topic, (err) => {
    if (err) {
      console.error(`Failed to unsubscribe from ${topic}:`, err);
      return false;
    }
    console.log(`📡 Unsubscribed from ${topic}`);
  });

  // Remove the callback for this topic
  if (client.topicCallbacks && client.topicCallbacks[topic]) {
    delete client.topicCallbacks[topic];
  }

  return true;
}

// Debug function to test topic subscription
export function testTopicSubscription(macAddress) {
  const macWithoutColons = macAddress.replace(/:/g, '');
  const testTopic = `devices/${macWithoutColons}/response`;
  
  console.log(`🧪 Testing topic subscription:`);
  console.log(`📍 Original MAC: ${macAddress}`);
  console.log(`📍 Processed MAC: ${macWithoutColons}`);
  console.log(`📡 Expected topic: ${testTopic}`);
  
  // Subscribe to test topic
  subscribeToTopic(testTopic, (topic, message) => {
    console.log(`🧪 TEST: Received message on ${topic}:`, message.toString());
  });
  
  return testTopic;
}

// Get current subscriptions for debugging
export function getSubscriptions() {
  if (client && client.topicCallbacks) {
    console.log(`📋 Current subscriptions:`, Object.keys(client.topicCallbacks));
    return Object.keys(client.topicCallbacks);
  }
  return [];
}

// Test function to simulate ESP32 response (for debugging)
export function simulateESP32Response(macAddress, command) {
  const macWithoutColons = macAddress.replace(/:/g, '');
  const topic = `devices/${macWithoutColons}/response`;
  
  const testResponse = {
    type: "ir_learning_response",
    success: true,
    ir_command: command,
    ir_code: "0x20DF10EF",
    protocol: "NEC",
    brand: "Samsung",
    timestamp: new Date().toISOString()
  };
  
  console.log(`🧪 Simulating ESP32 response on topic: ${topic}`);
  console.log(`🧪 Test message:`, testResponse);
  
  if (client && client.connected) {
    client.publish(topic, JSON.stringify(testResponse));
    console.log(`✅ Test message published to ${topic}`);
  } else {
    console.error(`❌ MQTT client not connected, cannot publish test message`);
  }
}

// Manual subscription test for debugging
export function forceSubscribeToResponseTopic(macAddress) {
  const macWithoutColons = macAddress.replace(/:/g, '');
  const topic = `devices/${macWithoutColons}/response`;
  
  console.log(`🔧 FORCE SUBSCRIBING to: ${topic}`);
  
  if (!client || !client.connected) {
    console.error(`❌ MQTT client not connected!`);
    return false;
  }
  
  // Force subscribe with callback
  client.subscribe(topic, (err) => {
    if (err) {
      console.error(`❌ Failed to subscribe to ${topic}:`, err);
    } else {
      console.log(`✅ FORCE SUBSCRIBED to: ${topic}`);
    }
  });
  
  // Add a simple test callback
  if (!client.topicCallbacks) {
    client.topicCallbacks = {};
  }
  
  client.topicCallbacks[topic] = (receivedTopic, message) => {
    console.log(`🎯 FORCE CALLBACK TRIGGERED for topic: ${receivedTopic}`);
    console.log(`📨 Message:`, message.toString());
    try {
      const data = JSON.parse(message.toString());
      console.log(`📊 Parsed data:`, data);
    } catch (e) {
      console.log(`⚠️ Failed to parse JSON:`, e);
    }
  };
  
  console.log(`💾 Added force callback for: ${topic}`);
  return true;
}

// Check MQTT connection status
export function getMQTTStatus() {
  const status = {
    connected: client ? client.connected : false,
    clientExists: !!client,
    subscriptions: client?.topicCallbacks ? Object.keys(client.topicCallbacks) : [],
    totalCallbacks: client?.topicCallbacks ? Object.keys(client.topicCallbacks).length : 0
  };
  
  console.log(`📊 MQTT Status:`, status);
  return status;
}

// Disconnect MQTT client
export function disconnectMqtt() {
  if (client && client.connected) {
    client.end();
    console.log("🔌 MQTT Disconnected");
  }
}