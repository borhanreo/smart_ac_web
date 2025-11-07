import React, { useState, useEffect } from "react";
import { connectMqtt } from "./mqttService";
import Login from "./components/Login";
import ControlPanel from "./components/ControlPanel";
import ScheduleManager from "./components/ScheduleManager";
import StatusMonitor from "./components/StatusMonitor";
import DeviceManager from "./components/DeviceManager";
import DeviceRegistration from "./components/DeviceRegistration";
import DeviceStatusPage from "./pages/DeviceStatusPage";
import { auth } from "./firebase";
import "./styles.css";

function App() {
  const [user, setUser] = useState(null);
  const [mqttData, setMqttData] = useState({});
  const [currentView, setCurrentView] = useState('devices'); // 'devices', 'register', 'control', 'status'
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      if (user) {
        setCurrentView('devices');
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Connect to MQTT only when user is logged in and device is selected
    if (user && selectedDevice) {
      const topicBase = selectedDevice.mqttTopicBase || `devices/${selectedDevice.macAddress.replace(/:/g, '')}`;
      connectMqtt((topic, data) => setMqttData(data), topicBase);
    }
  }, [user, selectedDevice]);

  const handleDeviceSelect = (device) => {
    setSelectedDevice(device);
    if (device) {
      setCurrentView('control');
    }
  };

  const handleDeviceRegistered = (deviceId) => {
    setCurrentView('devices');
  };

  const handleLogout = () => {
    auth.signOut();
    setUser(null);
    setSelectedDevice(null);
    setCurrentView('devices');
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Smart AC Controller</h1>
        <div className="header-actions">
          <span>Welcome, {user.email}</span>
          <nav className="nav-menu">
            <button 
              className={currentView === 'devices' ? 'active' : ''}
              onClick={() => setCurrentView('devices')}
            >
              My Devices
            </button>
            <button 
              className={currentView === 'status' ? 'active' : ''}
              onClick={() => setCurrentView('status')}
            >
              📊 Status Monitor
            </button>
            {selectedDevice && (
              <button 
                className={currentView === 'control' ? 'active' : ''}
                onClick={() => setCurrentView('control')}
              >
                Control Panel
              </button>
            )}
          </nav>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <main className="app-content">
        {currentView === 'devices' && (
          <DeviceManager 
            onSelectDevice={handleDeviceSelect}
            onRegisterNew={() => setCurrentView('register')}
            onDevicesLoaded={setDevices}
          />
        )}

        {currentView === 'status' && (
          <DeviceStatusPage />
        )}

        {currentView === 'register' && (
          <DeviceRegistration 
            onDeviceRegistered={handleDeviceRegistered}
            onCancel={() => setCurrentView('devices')}
          />
        )}

        {currentView === 'control' && selectedDevice && (
          <div className="control-section">
            <div className="device-info-bar">
              <h2>{selectedDevice.deviceName}</h2>
              <p>{selectedDevice.location} - {selectedDevice.deviceType}</p>
            </div>
            <ControlPanel selectedDevice={selectedDevice} />
            <ScheduleManager selectedDevice={selectedDevice} />
            <StatusMonitor 
              devices={selectedDevice ? [selectedDevice] : []}
              onDeviceUpdate={(macAddress, isOnline, deviceData) => {
                console.log(`Control Panel: Device ${macAddress} status changed to ${isOnline ? 'online' : 'offline'}`);
                // Update the selected device status
                if (selectedDevice && selectedDevice.macAddress === macAddress) {
                  setSelectedDevice({...selectedDevice, isActive: isOnline, lastSeen: new Date()});
                }
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
export default App;