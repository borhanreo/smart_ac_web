import React, { useState, useEffect } from "react";
import { connectMqtt } from "./mqttService";
import Login from "./components/Login";
import ControlPanel from "./components/ControlPanel";
import ScheduleManager from "./components/ScheduleManager";
import StatusMonitor from "./components/StatusMonitor";
import "./styles.css";
function App() {
  const [user, setUser] = useState(null);
  const [mqttData, setMqttData] = useState({});
  useEffect(() => {
    if (user) connectMqtt((topic, data) => setMqttData(data));
  }, [user]);
  if (!user) return <Login onLogin={setUser} />;
  return (
    <div className="app">
      <h1>Smart AC Controller</h1>
      <ControlPanel />
      <ScheduleManager />
      <StatusMonitor mqttData={mqttData} />
    </div>
  );
}
export default App;