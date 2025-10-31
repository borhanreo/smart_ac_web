import React, { useState } from "react";
import { sendCommand } from "../mqttService";
export default function ControlPanel() {
  const [temp, setTemp] = useState(24);
  const [mode, setMode] = useState("cool");
  const [fan, setFan] = useState("medium");
  return (<div className="panel"><h3>AC Control Panel</h3>
    <button onClick={() => sendCommand("POWER_ON")}>Power ON</button>
    <button onClick={() => sendCommand("POWER_OFF")}>Power OFF</button>
    <div><label>Temperature:</label>
      <input type="number" value={temp} onChange={(e) => setTemp(e.target.value)} />
      <button onClick={() => sendCommand("SET_TEMP", { value: temp })}>Set</button></div>
    <div><label>Mode:</label>
      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value="cool">Cool</option><option value="heat">Heat</option><option value="fan">Fan</option></select>
      <button onClick={() => sendCommand("MODE", { value: mode })}>Apply</button></div>
    <div><label>Fan Speed:</label>
      <select value={fan} onChange={(e) => setFan(e.target.value)}>
        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
      <button onClick={() => sendCommand("FAN_SPEED", { value: fan })}>Apply</button></div></div>);
}