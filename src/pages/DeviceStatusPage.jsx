import React, { useState, useEffect } from 'react';
import { getUserDevices } from '../services/deviceService';
import { deviceStatusMonitor } from '../services/deviceStatusMonitor';
import { connectMqtt } from '../mqttService';
import StatusMonitor from '../components/StatusMonitor';
import { auth } from '../firebase';

const DeviceStatusPage = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUserDevices();
    
    // Setup real-time status monitoring
    const handleStatusChange = (macAddress, isOnline, deviceData) => {
      setDevices(prevDevices => 
        prevDevices.map(device => 
          device.macAddress === macAddress 
            ? { ...device, isActive: isOnline, lastSeen: new Date() }
            : device
        )
      );
    };

    deviceStatusMonitor.onStatusChange(handleStatusChange);
    
    // Start MQTT connection for status monitoring
    const mqttConnection = connectMqtt(
      (topic, message) => {
        console.log('Device Status Page - MQTT Message:', { topic, message });
      }
    );
    
    // Start monitoring user devices
    if (auth.currentUser) {
      deviceStatusMonitor.startMonitoringUserDevices(auth.currentUser.uid);
    }
    
    return () => {
      // Cleanup on unmount
      deviceStatusMonitor.removeStatusChangeCallback(handleStatusChange);
    };
  }, []);

  const loadUserDevices = async () => {
    try {
      setLoading(true);
      const result = await getUserDevices(auth.currentUser.uid);
      
      if (result.success) {
        setDevices(result.devices);
      } else {
        setError(result.error || 'Failed to load devices');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error loading devices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceUpdate = (macAddress, isOnline, deviceData) => {
    console.log(`Device Status Page: Device ${macAddress} status changed to ${isOnline ? 'online' : 'offline'}`);
    
    // Update devices state
    setDevices(prevDevices => 
      prevDevices.map(device => 
        device.macAddress === macAddress 
          ? { ...device, isActive: isOnline, lastSeen: new Date() }
          : device
      )
    );
  };

  if (loading) {
    return (
      <div className="device-status-page">
        <div className="page-header">
          <h1>Device Status Monitor</h1>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading device status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="device-status-page">
        <div className="page-header">
          <h1>Device Status Monitor</h1>
        </div>
        <div className="error-container">
          <div className="error-message">
            <h3>Error Loading Devices</h3>
            <p>{error}</p>
            <button onClick={loadUserDevices} className="retry-btn">
              🔄 Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="device-status-page">
      <div className="page-header">
        <h1>📊 Device Status Monitor</h1>
        <p>Real-time monitoring of all your connected devices</p>
        <div className="page-actions">
          <button onClick={loadUserDevices} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="page-content">
        <StatusMonitor 
          devices={devices}
          onDeviceUpdate={handleDeviceUpdate}
        />
      </div>

      <style jsx>{`
        .device-status-page {
          min-height: 100vh;
          background: #f8fafc;
          padding: 20px;
        }

        .page-header {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .page-header h1 {
          margin: 0;
          color: #1f2937;
          font-size: 1.75rem;
          font-weight: 700;
        }

        .page-header p {
          margin: 4px 0 0 0;
          color: #6b7280;
          font-size: 1rem;
        }

        .page-actions {
          display: flex;
          gap: 12px;
        }

        .refresh-btn,
        .retry-btn {
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .refresh-btn:hover,
        .retry-btn:hover {
          background: #2563eb;
        }

        .page-content {
          max-width: 1200px;
          margin: 0 auto;
        }

        .loading-container,
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          background: white;
          border-radius: 12px;
          padding: 40px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e5e7eb;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading-container p {
          color: #6b7280;
          font-size: 1rem;
          margin: 0;
        }

        .error-message {
          text-align: center;
        }

        .error-message h3 {
          color: #dc2626;
          margin: 0 0 8px 0;
          font-size: 1.25rem;
        }

        .error-message p {
          color: #6b7280;
          margin: 0 0 20px 0;
          font-size: 1rem;
        }

        @media (max-width: 768px) {
          .device-status-page {
            padding: 12px;
          }

          .page-header {
            padding: 16px;
            flex-direction: column;
            align-items: stretch;
          }

          .page-header h1 {
            font-size: 1.5rem;
          }

          .page-actions {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default DeviceStatusPage;