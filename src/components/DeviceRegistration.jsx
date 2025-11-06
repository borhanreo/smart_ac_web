import React, { useState } from 'react';
import { registerDevice, checkDeviceExists } from '../services/deviceService';
import { auth } from '../firebase';

const DeviceRegistration = ({ onDeviceRegistered, onCancel }) => {
  const [formData, setFormData] = useState({
    deviceName: '',
    macAddress: '',
    deviceType: 'AC',
    location: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateMacAddress = (mac) => {
    // MAC address validation (XX:XX:XX:XX:XX:XX format)
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validation
    if (!formData.deviceName.trim()) {
      setError('Device name is required');
      setLoading(false);
      return;
    }

    if (!formData.macAddress.trim()) {
      setError('MAC address is required');
      setLoading(false);
      return;
    }

    if (!validateMacAddress(formData.macAddress)) {
      setError('Please enter a valid MAC address (XX:XX:XX:XX:XX:XX)');
      setLoading(false);
      return;
    }

    if (!formData.location.trim()) {
      setError('Location is required');
      setLoading(false);
      return;
    }

    try {
      // Check if device already exists
      const deviceExists = await checkDeviceExists(formData.macAddress);
      if (deviceExists) {
        setError('This device is already registered by another user');
        setLoading(false);
        return;
      }

      // Register the device
      const result = await registerDevice(auth.currentUser.uid, {
        deviceName: formData.deviceName.trim(),
        macAddress: formData.macAddress.toUpperCase().trim(),
        deviceType: formData.deviceType,
        location: formData.location.trim(),
        description: formData.description.trim(),
        mqttTopicBase: `devices/${formData.macAddress.replace(/:/g, '')}`
      });

      if (result.success) {
        setSuccess('Device registered successfully!');
        setTimeout(() => {
          onDeviceRegistered && onDeviceRegistered(result.deviceId);
        }, 1500);
      } else {
        setError(result.error || 'Failed to register device');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Registration error:', err);
    }

    setLoading(false);
  };

  return (
    <div className="device-registration">
      <div className="registration-container">
        <h2>Register New ESP32 Device</h2>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <form onSubmit={handleSubmit} className="registration-form">
          <div className="form-group">
            <label htmlFor="deviceName">Device Name *</label>
            <input
              type="text"
              id="deviceName"
              name="deviceName"
              value={formData.deviceName}
              onChange={handleInputChange}
              placeholder="e.g., Living Room AC"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="macAddress">MAC Address *</label>
            <input
              type="text"
              id="macAddress"
              name="macAddress"
              value={formData.macAddress}
              onChange={handleInputChange}
              placeholder="XX:XX:XX:XX:XX:XX"
              pattern="^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$"
              required
            />
            <small>Enter the MAC address of your ESP32 device</small>
          </div>

          <div className="form-group">
            <label htmlFor="deviceType">Device Type</label>
            <select
              id="deviceType"
              name="deviceType"
              value={formData.deviceType}
              onChange={handleInputChange}
            >
              <option value="AC">Air Conditioner</option>
              <option value="Heater">Heater</option>
              <option value="Fan">Fan</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="location">Location *</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="e.g., Living Room, Bedroom"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Optional description about this device"
              rows="3"
            />
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              onClick={onCancel}
              className="cancel-btn"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="register-btn"
              disabled={loading}
            >
              {loading ? 'Registering...' : 'Register Device'}
            </button>
          </div>
        </form>

        <div className="help-section">
          <h3>How to find your ESP32 MAC Address:</h3>
          <ol>
            <li>Connect your ESP32 to a computer</li>
            <li>Upload this code to get the MAC address:
              <pre><code>{`#include "WiFi.h"

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_MODE_STA);
  Serial.print("MAC Address: ");
  Serial.println(WiFi.macAddress());
}

void loop() {
  // Nothing
}`}</code></pre>
            </li>
            <li>Open Serial Monitor to see the MAC address</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DeviceRegistration;