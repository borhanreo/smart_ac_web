import React, { useState, useEffect } from 'react';
import { getUserDevices, deleteDevice, updateDevice } from '../services/deviceService';
import { auth } from '../firebase';

const DeviceManager = ({ onSelectDevice, onRegisterNew }) => {
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

  return (
    <div className="device-manager">
      <div className="device-manager-header">
        <h2>My Devices</h2>
        <button 
          className="register-new-btn"
          onClick={onRegisterNew}
        >
          + Register New Device
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {devices.length === 0 ? (
        <div className="no-devices">
          <p>No devices registered yet.</p>
          <button 
            className="register-first-btn"
            onClick={onRegisterNew}
          >
            Register Your First Device
          </button>
        </div>
      ) : (
        <div className="devices-grid">
          {devices.map(device => (
            <div 
              key={device.id} 
              className={`device-card ${selectedDevice?.id === device.id ? 'selected' : ''}`}
            >
              <div className="device-header">
                <h3>{device.deviceName}</h3>
                <div className="device-actions">
                  <button 
                    className="edit-btn"
                    onClick={() => handleEditDevice(device)}
                    title="Edit device"
                  >
                    ✏️
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDeleteDevice(device.id, device.deviceName)}
                    title="Delete device"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              
              <div className="device-info">
                <p><strong>Type:</strong> {device.deviceType}</p>
                <p><strong>Location:</strong> {device.location}</p>
                <p><strong>MAC Address:</strong> {device.macAddress}</p>
                {device.description && (
                  <p><strong>Description:</strong> {device.description}</p>
                )}
                <p><strong>Last Seen:</strong> {formatLastSeen(device.lastSeen)}</p>
                <p className={`status ${device.isActive ? 'active' : 'inactive'}`}>
                  <strong>Status:</strong> {device.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>

              <button 
                className="select-btn"
                onClick={() => handleSelectDevice(device)}
              >
                {selectedDevice?.id === device.id ? 'Selected' : 'Select Device'}
              </button>
            </div>
          ))}
        </div>
      )}

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