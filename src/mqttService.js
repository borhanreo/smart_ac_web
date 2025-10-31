import mqtt from "mqtt";
let client = null;
export function connectMqtt(onMessage) {
  const options = {
    username: process.env.REACT_APP_MQTT_USERNAME,
    password: process.env.REACT_APP_MQTT_PASSWORD,
    reconnectPeriod: 2000,
    protocol: "wss",
  };
  const brokerUrl = process.env.REACT_APP_MQTT_BROKER;
  client = mqtt.connect(brokerUrl, options);
  client.on("connect", () => console.log("✅ MQTT Connected"));
  client.on("error", (err) => console.error("❌ MQTT Error:", err));
  client.on("message", (topic, message) => {
    try { onMessage(topic, JSON.parse(message.toString())); } catch { console.warn("Invalid message:", message.toString()); }
  });
  const baseTopic = process.env.REACT_APP_MQTT_TOPIC_BASE;
  client.subscribe(`${baseTopic}/status`);
  return client;
}
export function sendCommand(command, payload = {}) {
  if (!client || !client.connected) return;
  const baseTopic = process.env.REACT_APP_MQTT_TOPIC_BASE;
  const message = JSON.stringify({ command, ...payload });
  client.publish(`${baseTopic}/control`, message);
}