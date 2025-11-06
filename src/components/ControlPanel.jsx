import React, { useState } from "react";
import { sendCommand } from "../mqttService";

export default function ControlPanel({ selectedDevice }) {
  const [temp, setTemp] = useState(24);
  const [mode, setMode] = useState("cool");
  const [fan, setFan] = useState("medium");

  const getDeviceTopicBase = () => {
    if (!selectedDevice) return null;
    return selectedDevice.mqttTopicBase || `devices/${selectedDevice.macAddress.replace(/:/g, '')}`;
  };

  const handleSendCommand = (command, payload = {}) => {
    const topicBase = getDeviceTopicBase();
    if (topicBase) {
      sendCommand(command, payload, topicBase);
    } else {
      console.warn("No device selected or invalid device");
    }
  };

  if (!selectedDevice) {
    return (
      <div className="panel">
        <h3>No Device Selected</h3>
        <p>Please select a device to control.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>{selectedDevice.deviceType} Control Panel</h3>
      
      <div className="control-group">
        <h4>Power Control</h4>
        <button onClick={() => handleSendCommand("POWER_ON")}>Power ON</button>
        <button onClick={() => handleSendCommand("POWER_OFF")}>Power OFF</button>
      </div>

      <div className="control-group">
        <h4>Temperature</h4>
        <label>Set Temperature:</label>
        <input 
          type="number" 
          value={temp} 
          onChange={(e) => setTemp(e.target.value)}
          min="16"
          max="30"
        />
        <span>°C</span>
        <button onClick={() => handleSendCommand("SET_TEMP", { value: parseInt(temp) })}>
          Set Temperature
        </button>
      </div>

      <div className="control-group">
        <h4>Operating Mode</h4>
        <label>Mode:</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="cool">Cool</option>
          <option value="heat">Heat</option>
          <option value="fan">Fan Only</option>
          <option value="dry">Dry</option>
          <option value="auto">Auto</option>
        </select>
        <button onClick={() => handleSendCommand("SET_MODE", { value: mode })}>
          Apply Mode
        </button>
      </div>

      <div className="control-group">
        <h4>Fan Control</h4>
        <label>Fan Speed:</label>
        <select value={fan} onChange={(e) => setFan(e.target.value)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="auto">Auto</option>
        </select>
        <button onClick={() => handleSendCommand("SET_FAN_SPEED", { value: fan })}>
          Apply Speed
        </button>
      </div>

      <div className="control-group">
        <h4>Quick Actions</h4>
        <button onClick={() => handleSendCommand("SWING_TOGGLE")}>
          Toggle Swing
        </button>
        <button onClick={() => handleSendCommand("SLEEP_MODE")}>
          Sleep Mode
        </button>
        <button onClick={() => handleSendCommand("ECO_MODE")}>
          Eco Mode
        </button>
      </div>
    </div>
  );
}