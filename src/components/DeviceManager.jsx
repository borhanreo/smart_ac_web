import React, { useState, useEffect } from 'react';
import { getUserDevices, deleteDevice, updateDevice } from '../services/deviceService';
import { auth } from '../firebase';

const DeviceManager = ({ onSelectDevice, onRegisterNew, onDevicesLoaded }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);

  useEffect(() => {
    loadUserDevices();
  }, []);

  const loadUserDevices = async () => {
    try {
      setLoading(true);
      const result = await getUserDevices(auth.currentUser.uid);
      
      if (result.success) {
        setDevices(result.devices);
        // Notify parent component about loaded devices
        if (onDevicesLoaded) {
          onDevicesLoaded(result.devices);
        }
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

  const handleSelectDevice = (device) => {
    setSelectedDevice(device);
    onSelectDevice && onSelectDevice(device);
  };

  const handleDeleteDevice = async (deviceId, deviceName) => {
    if (window.confirm(`Are you sure you want to delete "${deviceName}"?`)) {
      try {
        const result = await deleteDevice(deviceId);
        if (result.success) {
          setDevices(devices.filter(d => d.id !== deviceId));
          if (selectedDevice && selectedDevice.id === deviceId) {
            setSelectedDevice(null);
            onSelectDevice && onSelectDevice(null);
          }
        } else {
          setError(result.error || 'Failed to delete device');
        }
      } catch (err) {
        setError('An unexpected error occurred');
        console.error('Error deleting device:', err);
      }
    }
  };

  const handleEditDevice = (device) => {
    setEditingDevice({
      ...device,
      deviceName: device.deviceName,
      location: device.location,
      description: device.description || ''
    });
  };

  const handleUpdateDevice = async (e) => {
    e.preventDefault();
    try {
      const result = await updateDevice(editingDevice.id, {
        deviceName: editingDevice.deviceName,
        location: editingDevice.location,
        description: editingDevice.description
      });

      if (result.success) {
        setDevices(devices.map(d => 
          d.id === editingDevice.id 
            ? { ...d, ...editingDevice }
            : d
        ));
        setEditingDevice(null);
      } else {
        setError(result.error || 'Failed to update device');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error updating device:', err);
    }
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never';
    
    const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div className="loading">Loading devices...</div>;
  }

  const getDeviceIcon = (deviceType) => {
    switch (deviceType?.toLowerCase()) {
      case 'air conditioner':
      case 'ac':
      case 'air conditioning':
        return (
          <svg className="w-16 h-16 mb-4 text-primary-text icon-svg" fill="currentColor" viewBox="0 -27.73 122.88 122.88" xmlns="http://www.w3.org/2000/svg">
            <path d="M79.93,51.37c-0.53-0.51-0.32-1.2,0.48-1.54c0.8-0.34,1.87-0.2,2.41,0.3c3.78,3.6,1.96,6.52,0.21,9.32 c-1.32,2.12-2.59,4.15-0.25,6.19c0.57,0.5,0.4,1.19-0.37,1.55c-0.77,0.36-1.86,0.26-2.43-0.24c-3.47-3.03-1.86-5.62-0.17-8.32 C81.22,56.36,82.7,54,79.93,51.37L79.93,51.37z M14.57,28.11h73.65c0.96,0,1.74,0.78,1.74,1.74v12.26h24.13 c1.46,0,2.79-0.6,3.75-1.56c0.96-0.96,1.56-2.29,1.56-3.75V8.8c0-1.46-0.6-2.79-1.56-3.75c-0.96-0.96-2.29-1.56-3.75-1.56H8.8 c-1.46,0-2.79,0.6-3.75,1.56C4.08,6.01,3.48,7.34,3.48,8.8V36.8c0,1.46,0.6,2.79,1.56,3.75c0.96,0.96,2.29,1.56,3.75,1.56h4.03 V29.85C12.83,28.89,13.61,28.11,14.57,28.11L14.57,28.11z M86.48,31.59H16.31v10.09h70.17V31.59L86.48,31.59z M15.21,13.64 c-0.96,0-1.74-0.78-1.74-1.74c0-0.96,0.78-1.74,1.74-1.74h93.74c0.96,0,1.74,0.78,1.74,1.74c0,0.96-0.78,1.74-1.74,1.74H15.21 L15.21,13.64z M98.58,31.99c1.36,0,2.46,1.1,2.46,2.46s-1.1,2.46-2.46,2.46s-2.46-1.1-2.46-2.46S97.23,31.99,98.58,31.99 L98.58,31.99z M108.85,31.99c1.36,0,2.46,1.1,2.46,2.46s-1.1,2.46-2.46,2.46c-1.36,0-2.46-1.1-2.46-2.46S107.49,31.99,108.85,31.99 L108.85,31.99z M8.8,0h105.29c2.42,0,4.62,0.99,6.21,2.58c1.59,1.59,2.58,3.79,2.58,6.21V36.8c0,2.42-0.99,4.62-2.58,6.21 c-1.59,1.59-3.79,2.58-6.21,2.58H8.8c-2.42,0-4.62-0.99-6.21-2.58C0.99,41.42,0,39.22,0,36.8V8.8c0-2.42,0.99-4.62,2.58-6.21 C4.18,0.99,6.38,0,8.8,0L8.8,0z M15.21,21.76c-0.96,0-1.74-0.78-1.74-1.74c0-0.96,0.78-1.74,1.74-1.74h93.74 c0.96,0,1.74,0.78,1.74,1.74c0,0.96-0.78,1.74-1.74,1.74H15.21L15.21,21.76z M21.37,51.37c-0.53-0.51-0.32-1.2,0.48-1.54 c0.8-0.34,1.87-0.2,2.41,0.3c3.78,3.6,1.96,6.52,0.21,9.32c-1.32,2.12-2.59,4.15-0.25,6.19c0.57,0.5,0.4,1.19-0.37,1.55 c-0.77,0.36-1.86,0.26-2.43-0.24c-3.47-3.03-1.86-5.62-0.17-8.32C22.66,56.36,24.13,54,21.37,51.37L21.37,51.37z M36.01,51.37 c-0.53-0.51-0.32-1.2,0.48-1.54c0.8-0.34,1.87-0.2,2.41,0.3c3.78,3.6,1.96,6.52,0.21,9.32c-1.32,2.12-2.59,4.15-0.25,6.19 c0.57,0.5,0.4,1.19-0.37,1.55c-0.77,0.36-1.86,0.26-2.43-0.24c-3.47-3.03-1.86-5.62-0.17-8.32C37.3,56.36,38.77,54,36.01,51.37 L36.01,51.37z M50.65,51.37c-0.53-0.51-0.32-1.2,0.48-1.54c0.8-0.34,1.87-0.2,2.41,0.3c3.78,3.6,1.96,6.52,0.21,9.32 c-1.32,2.12-2.59,4.15-0.25,6.19c0.57,0.5,0.4,1.19-0.37,1.55c-0.77,0.36-1.86,0.26-2.43-0.24c-3.47-3.03-1.86-5.62-0.17-8.32 C51.94,56.36,53.42,54,50.65,51.37L50.65,51.37z M65.29,51.37c-0.53-0.51-0.32-1.2,0.48-1.54c0.8-0.34,1.87-0.2,2.41,0.3 c3.78,3.6,1.96,6.52,0.21,9.32c-1.32,2.12-2.59,4.15-0.25,6.19c0.57,0.5,0.4,1.19-0.37,1.55c-0.77,0.36-1.86,0.26-2.43-0.24 c-3.47-3.03-1.85-5.62-0.17-8.32C66.58,56.36,68.06,54,65.29,51.37L65.29,51.37z"/>
          </svg>
        );
      case 'refrigerator':
      case 'fridge':
        return (
          <svg className="w-16 h-16 mb-4 text-primary-text icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" fill="#e2e8f0" stroke="currentColor" strokeWidth="2"/>
            <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="7" y1="6" x2="7" y2="10" stroke="currentColor" strokeWidth="2"/>
            <line x1="7" y1="14" x2="7" y2="18" stroke="currentColor" strokeWidth="2"/>
          </svg>
        );
      case 'washing machine':
      case 'washer':
        return (
          <svg className="w-16 h-16 mb-4 text-primary-text icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
            <circle cx="12" cy="13" r="6" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="12" cy="13" r="3" fill="#81e6e9" stroke="currentColor"/>
            <circle cx="7" cy="7" r="1" fill="currentColor"/>
            <circle cx="17" cy="7" r="1" fill="currentColor"/>
          </svg>
        );
      case 'fan':
      case 'ceiling fan':
        return (
          <svg className="w-16 h-16 mb-4 text-primary-text icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="2" fill="currentColor"/>
            <path d="M12 2v4" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 18v4" stroke="currentColor" strokeWidth="2"/>
            <path d="M4.93 4.93l2.83 2.83" stroke="currentColor" strokeWidth="2"/>
            <path d="M16.24 16.24l2.83 2.83" stroke="currentColor" strokeWidth="2"/>
            <path d="M2 12h4" stroke="currentColor" strokeWidth="2"/>
            <path d="M18 12h4" stroke="currentColor" strokeWidth="2"/>
            <path d="M4.93 19.07l2.83-2.83" stroke="currentColor" strokeWidth="2"/>
            <path d="M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2"/>
          </svg>
        );
      case 'smart tv':
      case 'television':
      case 'tv':
        return (
          <svg className="w-16 h-16 mb-4 text-primary-text icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="2" y="5" width="20" height="14" rx="2" ry="2" fill="#f3f4f6" stroke="currentColor" strokeWidth="2"/>
            <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth="2"/>
            <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="2"/>
            <circle cx="12" cy="12" r="2" fill="#81e6e9"/>
          </svg>
        );
      default:
        return (
          <svg className="w-16 h-16 mb-4 text-primary-text icon-svg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="6" width="18" height="12" rx="2" ry="2" fill="#e2e8f0" stroke="currentColor" strokeWidth="2"/>
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M9 12l2 2 4-4" stroke="#22c55e" strokeWidth="2" fill="none"/>
          </svg>
        );
    }
  };

  return (
    <div className="my-devices-container">
      {/* Main Content Wrapper */}
      <div className="my-devices-content">
        
        {/* Header Title */}
        <header className="my-devices-header">
          <h1 className="main-title">
            MY SMART <br /> DEVICES
          </h1>
          <button 
            className="register-new-btn-modern"
            onClick={onRegisterNew}
          >
            + Add New Device
          </button>
        </header>

        {error && <div className="error-message-modern">{error}</div>}

        {devices.length === 0 ? (
          <div className="no-devices-modern">
            <div className="empty-state-card">
              <svg className="w-16 h-16 mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
              <h3>No devices registered yet</h3>
              <p>Start building your smart home by adding your first device</p>
              <button 
                className="register-first-btn-modern"
                onClick={onRegisterNew}
              >
                Register Your First Device
              </button>
            </div>
          </div>
        ) : (
          /* Grid of Devices */
          <div className="devices-grid-modern">
            {devices.map(device => (
              <div 
                key={device.id} 
                className={`device-card-modern ${selectedDevice?.id === device.id ? 'selected' : ''}`}
                onClick={() => handleSelectDevice(device)}
              >
                {/* Device Icon */}
                {getDeviceIcon(device.deviceType)}
                
                {/* Device Name */}
                <h3 className="device-name">{device.deviceName}</h3>
                
                {/* Device Info */}
                <div className="device-subtitle">
                  <span className="device-type">{device.deviceType}</span>
                  <span className="device-location">📍 {device.location}</span>
                </div>
                
                {/* Status Indicator */}
                <div className={`device-status ${device.isActive ? 'active' : 'inactive'}`}>
                  <span className="status-dot"></span>
                  {device.isActive ? 'Online' : 'Offline'}
                </div>

                {/* Action Buttons */}
                <div className="device-actions-modern">
                  <button 
                    className="action-btn edit-btn-modern"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditDevice(device);
                    }}
                    title="Edit device"
                  >
                    ✏️
                  </button>
                  <button 
                    className="action-btn delete-btn-modern"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDevice(device.id, device.deviceName);
                    }}
                    title="Delete device"
                  >
                    🗑️
                  </button>
                </div>

                {/* Selection Indicator */}
                {selectedDevice?.id === device.id && (
                  <div className="selection-indicator">
                    <span>✓ Selected</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Bar */}
      <footer className="my-devices-footer">
        <p>
          <span>🏠</span> Smart Home Control Center
        </p>
      </footer>

      {/* Edit Device Modal */}
      {editingDevice && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Device</h3>
            <form onSubmit={handleUpdateDevice}>
              <div className="form-group">
                <label htmlFor="editDeviceName">Device Name</label>
                <input
                  type="text"
                  id="editDeviceName"
                  value={editingDevice.deviceName}
                  onChange={(e) => setEditingDevice({
                    ...editingDevice,
                    deviceName: e.target.value
                  })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="editLocation">Location</label>
                <input
                  type="text"
                  id="editLocation"
                  value={editingDevice.location}
                  onChange={(e) => setEditingDevice({
                    ...editingDevice,
                    location: e.target.value
                  })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="editDescription">Description</label>
                <textarea
                  id="editDescription"
                  value={editingDevice.description}
                  onChange={(e) => setEditingDevice({
                    ...editingDevice,
                    description: e.target.value
                  })}
                  rows="3"
                />
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button"
                  onClick={() => setEditingDevice(null)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="save-btn"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceManager;