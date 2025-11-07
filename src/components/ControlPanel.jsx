import React, { useState } from "react";
import { sendCommand } from "../mqttService";

export default function ControlPanel({ selectedDevice }) {
  const [temp, setTemp] = useState(23);
  const [mode, setMode] = useState("cool");
  const [fan, setFan] = useState("auto");
  const [powerOn, setPowerOn] = useState(true);
  const [isHealthOn, setIsHealthOn] = useState(true);

  const modes = ['Cool', 'Heat', 'Fan', 'Dry', 'Auto'];
  const [currentModeIndex, setCurrentModeIndex] = useState(0);

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

  const togglePower = () => {
    const newPowerState = !powerOn;
    setPowerOn(newPowerState);
    handleSendCommand(newPowerState ? "POWER_ON" : "POWER_OFF");
  };

  const adjustTemp = (delta) => {
    if (powerOn) {
      const newTemp = Math.max(16, Math.min(30, temp + delta));
      setTemp(newTemp);
      handleSendCommand("SET_TEMP", { value: newTemp });
    }
  };

  const changeMode = () => {
    if (powerOn) {
      const newIndex = (currentModeIndex + 1) % modes.length;
      setCurrentModeIndex(newIndex);
      const newMode = modes[newIndex].toLowerCase();
      setMode(newMode);
      handleSendCommand("SET_MODE", { value: newMode });
    }
  };

  const toggleFan = () => {
    if (powerOn) {
      const newFan = fan === "auto" ? "high" : "auto";
      setFan(newFan);
      handleSendCommand("SET_FAN_SPEED", { value: newFan });
    }
  };

  const getStatusLine = () => {
    if (powerOn) {
      const modeText = modes[currentModeIndex];
      const fanText = fan === "auto" ? "Auto Fan" : "High Fan";
      const healthText = isHealthOn ? " | Health" : "";
      return `${modeText} | ${fanText}${healthText}`;
    }
    return "Standby";
  };

  if (!selectedDevice) {
    return (
      <div className="remote-body">
        <div className="screen">
          <div className="icon-row">
            <span style={{opacity: 0.2}}>🔒</span>
          </div>
          <div className="temp-text">--°C</div>
          <div>No Device Selected</div>
        </div>
      </div>
    );
  }

  return (
    <div className="remote-body" style={{opacity: powerOn ? '1' : '0.7'}}>
      {/* LCD Screen Area */}
      <div className="screen">
        <div className="icon-row">
          <span style={{color: 'red', display: powerOn ? 'inline' : 'none'}}>⚡</span>
          <span>☁</span>
          <span>↔</span>
          <span style={{opacity: 0.2}}>🔒</span>
        </div>
        <div className="temp-text">
          {powerOn ? `${temp}°C` : '--°C'}
        </div>
        <div>{getStatusLine()}</div>
      </div>

      {/* Buttons Section */}
      <div className="buttons-grid">
        {/* Row 1: Power & Mode */}
        <div className="center-block">
          <button className="button power-btn" onClick={togglePower}>⚫</button>
        </div>
        
        <div className="center-block">
          {/* Blank column for the gap in the middle */}
        </div>

        <div className="center-block">
          <button className="button mode-btn" onClick={changeMode}>Mode</button>
        </div>

        {/* Row 2: Temp Up/Down */}
        <div className="center-block">
          <button className="button arrow-button" onClick={() => adjustTemp(1)}>^</button>
          <span className="text-xs font-semibold">Temp</span>
          <button className="button arrow-button" onClick={() => adjustTemp(-1)}>v</button>
        </div>

        {/* Row 3: Fan/Eco */}
        <div className="center-block">
          <button className="button" onClick={toggleFan}>Fan</button>
          <button className="button" onClick={() => powerOn && handleSendCommand("ECO_MODE")}>Eco</button>
        </div>

        {/* Row 4: Swing/Arrows */}
        <div className="center-block">
          <button className="button" onClick={() => powerOn && handleSendCommand("SWING_TOGGLE")}>Swing</button>
          <button className="button arrow-button" onClick={() => powerOn && handleSendCommand("HORIZONTAL_ADJUST")}>‹ ›</button>
        </div>
        
        {/* Row 5: Sleep/Display/Timer */}
        <button className="button" onClick={() => powerOn && handleSendCommand("SLEEP_MODE")}>Sleep</button>
        <button className="button" onClick={() => powerOn && handleSendCommand("DISPLAY_TOGGLE")}>Display</button>
        <button className="button" onClick={() => powerOn && handleSendCommand("TIMER_SET")}>Timer</button>

        {/* Row 6: Mute/Turbo/I Feel */}
        <button className="button" onClick={() => powerOn && handleSendCommand("MUTE_TOGGLE")}>Mute</button>
        <button className="button" onClick={() => powerOn && handleSendCommand("TURBO_MODE")}>Turbo</button>
        <button className="button" onClick={() => powerOn && handleSendCommand("I_FEEL_MODE")}>I Feel</button>
      </div>
    </div>
  );
}