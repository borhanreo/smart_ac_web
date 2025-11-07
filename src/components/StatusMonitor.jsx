import React, { useState, useEffect, useCallback } from 'react';
import { deviceStatusMonitor } from '../services/deviceStatusMonitor';
import { connectMqtt, sendCommand, pingDevice, requestDeviceStatus } from '../mqttService';
import { deviceMonitoringConfig } from '../services/deviceMonitoringConfig';

const StatusMonitor = ({ devices = [], onDeviceUpdate }) => {
  const [monitoringStatus, setMonitoringStatus] = useState({});
  const [mqttConnected, setMqttConnected] = useState(false);

  // Ensure devices is always an array
  const deviceList = Array.isArray(devices) ? devices : [];

  useEffect(() => {
    // Setup MQTT connection for device monitoring
    const mqttConnection = connectMqtt(
      (topic, message) => {
        console.log('Status Monitor - MQTT Message:', { topic, message });
      }
    );

    setMqttConnected(true);

    // Setup status change listener
    const handleStatusChange = (macAddress, isOnline, deviceData) => {
      console.log(`Status Monitor: ${macAddress} is now ${isOnline ? 'online' : 'offline'}`);
      
      // Update monitoring status
      setMonitoringStatus(prev => ({
        ...prev,
        [macAddress]: {
          isOnline,
          lastUpdate: new Date(),
          data: deviceData
        }
      }));

      // Notify parent component
      if (onDeviceUpdate) {
        onDeviceUpdate(macAddress, isOnline, deviceData);
      }
    };

    deviceStatusMonitor.onStatusChange(handleStatusChange);

    return () => {
      deviceStatusMonitor.removeStatusChangeCallback(handleStatusChange);
      setMqttConnected(false);
    };
  }, [onDeviceUpdate]);

  // Ping a specific device
  const handlePingDevice = async (macAddress) => {
    const deviceTopicBase = `devices/${macAddress.replace(/:/g, '')}`;
    
    try {
      const result = pingDevice(deviceTopicBase);
      if (result) {
        console.log(`🏓 Ping sent to device ${macAddress}`);
      }
    } catch (error) {
      console.error('Error pinging device:', error);
    }
  };

  // Request device status
  const handleRequestDeviceStatus = (macAddress) => {
    const deviceTopicBase = `devices/${macAddress.replace(/:/g, '')}`;
    
    try {
      const result = requestDeviceStatus(deviceTopicBase);
      if (result) {
        console.log(`📊 Status request sent to device ${macAddress}`);
      }
    } catch (error) {
      console.error('Error requesting device status:', error);
    }
  };

  // Get status indicator
  const getStatusIndicator = (device) => {
    const status = monitoringStatus[device.macAddress];
    const isOnline = status?.isOnline ?? device.isActive;
    const lastUpdate = status?.lastUpdate || (device.lastSeen ? new Date(device.lastSeen) : null);

    return {
      isOnline,
      lastUpdate,
      color: isOnline ? '#10B981' : '#EF4444',
      text: isOnline ? 'Online' : 'Offline',
      icon: isOnline ? '🟢' : '🔴'
    };
  };

  // Format last seen time
  const formatLastSeen = (lastUpdate) => {
    if (!lastUpdate) return 'Never';
    
    const now = new Date();
    const diffMs = now - lastUpdate;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return lastUpdate.toLocaleDateString();
  };

  return (
    <div className="status-monitor">
      <div className="status-header">
        <h3>Device Status Monitor</h3>
        <div className="mqtt-status">
          <span className={`mqtt-indicator ${mqttConnected ? 'connected' : 'disconnected'}`}>
            {mqttConnected ? '🟢' : '🔴'} MQTT {mqttConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {deviceList.length === 0 ? (
        <div className="no-devices-message">
          <p>No devices to monitor</p>
        </div>
      ) : (
        <>
          <div className="devices-status-list">
            {deviceList.map(device => {
          const status = getStatusIndicator(device);
          return (
            <div key={device.id} className="device-status-item">
              <div className="device-info">
                <div className="device-name">
                  <span className="status-icon">{status.icon}</span>
                  <strong>{device.name}</strong>
                </div>
                <div className="device-mac">{device.macAddress}</div>
              </div>

              <div className="status-info">
                <div className={`status-badge ${status.isOnline ? 'online' : 'offline'}`}>
                  {status.text}
                </div>
                <div className="last-seen">
                  Last seen: {formatLastSeen(status.lastUpdate)}
                </div>
              </div>

              <div className="status-actions">
                <button 
                  onClick={() => handlePingDevice(device.macAddress)}
                  className="ping-btn"
                  title="Ping Device"
                >
                  🏓 Ping
                </button>
                <button 
                  onClick={() => handleRequestDeviceStatus(device.macAddress)}
                  className="status-btn"
                  title="Request Status"
                >
                  📊 Status
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="monitoring-info">
        <h4>Monitoring Statistics</h4>
        <div className="monitoring-note">
          <p>📊 {deviceMonitoringConfig.getConfigSummary().description}</p>
        </div>
        <div className="stats">
          <div className="stat-item">
            <span className="stat-label">Total Devices:</span>
            <span className="stat-value">{deviceList.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Online:</span>
            <span className="stat-value online-count">
              {deviceList.filter(d => getStatusIndicator(d).isOnline).length}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Offline:</span>
            <span className="stat-value offline-count">
              {deviceList.filter(d => !getStatusIndicator(d).isOnline).length}
            </span>
          </div>
        </div>
      </div>
      </>
      )}

      <style jsx>{`
        .status-monitor {
          background: white;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          margin-bottom: 24px;
        }

        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 2px solid #f3f4f6;
        }

        .status-header h3 {
          margin: 0;
          color: #1f2937;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .mqtt-status {
          display: flex;
          align-items: center;
        }

        .mqtt-indicator {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .mqtt-indicator.connected {
          background: #ecfdf5;
          color: #059669;
        }

        .mqtt-indicator.disconnected {
          background: #fef2f2;
          color: #dc2626;
        }

        .devices-status-list {
          space-y: 12px;
        }

        .device-status-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          margin-bottom: 12px;
        }

        .device-info {
          flex: 1;
        }

        .device-name {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .device-name strong {
          color: #1f2937;
          font-size: 1rem;
        }

        .status-icon {
          font-size: 1rem;
        }

        .device-mac {
          color: #6b7280;
          font-size: 0.875rem;
          font-family: monospace;
        }

        .status-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 0 20px;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 4px;
        }

        .status-badge.online {
          background: #ecfdf5;
          color: #059669;
        }

        .status-badge.offline {
          background: #fef2f2;
          color: #dc2626;
        }

        .last-seen {
          color: #6b7280;
          font-size: 0.75rem;
        }

        .status-actions {
          display: flex;
          gap: 8px;
        }

        .ping-btn,
        .status-btn {
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          background: #3b82f6;
          color: white;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .ping-btn:hover,
        .status-btn:hover {
          background: #2563eb;
        }

        .monitoring-info {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 2px solid #f3f4f6;
        }

        .monitoring-info h4 {
          margin: 0 0 12px 0;
          color: #1f2937;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .monitoring-note {
          background: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 16px;
        }

        .monitoring-note p {
          margin: 0;
          color: #0369a1;
          font-size: 0.875rem;
          text-align: center;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          text-align: center;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .stat-label {
          color: #6b7280;
          font-size: 0.875rem;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 600;
          color: #1f2937;
        }

        .online-count {
          color: #059669;
        }

        .offline-count {
          color: #dc2626;
        }

        .no-devices-message {
          text-align: center;
          padding: 40px 20px;
          color: #6b7280;
          font-size: 1rem;
        }

        .no-devices-message p {
          margin: 0;
        }

        @media (max-width: 768px) {
          .device-status-item {
            flex-direction: column;
            gap: 12px;
          }

          .status-info {
            margin: 0;
          }

          .stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default StatusMonitor;