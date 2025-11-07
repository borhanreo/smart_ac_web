import { updateDeviceStatusByMAC, markDeviceOffline, getUserDevices } from './deviceService';
import { deviceMonitoringConfig } from './deviceMonitoringConfig';

class DeviceStatusMonitor {
  constructor() {
    this.deviceTimeouts = new Map(); // Track device heartbeat timeouts
    // Get configuration from centralized config service
    this.heartbeatInterval = deviceMonitoringConfig.getStatusInterval();
    this.offlineThreshold = deviceMonitoringConfig.getOfflineTimeout(); 
    this.statusCheckInterval = deviceMonitoringConfig.getStatusCheckInterval();
    this.statusCallbacks = [];
    
    // Validate configuration
    if (!deviceMonitoringConfig.isValid()) {
      console.warn('⚠️ Device monitoring configuration validation failed, using defaults');
    }
    
    const config = deviceMonitoringConfig.getConfigSummary();
    console.log(`📊 Device Status Monitor initialized: ${config.description}`);
  }

  // Add callback for status change notifications
  onStatusChange(callback) {
    this.statusCallbacks.push(callback);
  }

  // Remove status change callback
  removeStatusChangeCallback(callback) {
    this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
  }

  // Notify all callbacks of status change
  notifyStatusChange(macAddress, isOnline, deviceData) {
    this.statusCallbacks.forEach(callback => {
      try {
        callback(macAddress, isOnline, deviceData);
      } catch (error) {
        console.error('Error in status change callback:', error);
      }
    });
  }

  // Handle device heartbeat
  handleHeartbeat(macAddress, data) {
    console.log(`💓 Heartbeat received from ${macAddress}`);
    
    // Clear existing timeout
    if (this.deviceTimeouts.has(macAddress)) {
      clearTimeout(this.deviceTimeouts.get(macAddress));
    }

    // Update device status to online
    this.updateDeviceStatus(macAddress, true, data);

    // Set new timeout for offline detection
    const timeout = setTimeout(() => {
      console.log(`⏰ Device ${macAddress} missed heartbeat, marking offline`);
      this.updateDeviceStatus(macAddress, false);
    }, this.offlineThreshold);

    this.deviceTimeouts.set(macAddress, timeout);
  }

  // Handle device coming online
  handleDeviceOnline(macAddress, data) {
    console.log(`🟢 Device ${macAddress} came online`);
    this.handleHeartbeat(macAddress, data);
  }

  // Handle device going offline
  handleDeviceOffline(macAddress, data) {
    console.log(`🔴 Device ${macAddress} went offline`);
    
    // Clear heartbeat timeout
    if (this.deviceTimeouts.has(macAddress)) {
      clearTimeout(this.deviceTimeouts.get(macAddress));
      this.deviceTimeouts.delete(macAddress);
    }

    this.updateDeviceStatus(macAddress, false, data);
  }

  // Update device status in Firebase
  async updateDeviceStatus(macAddress, isOnline, data = {}) {
    try {
      const result = await updateDeviceStatusByMAC(macAddress, isOnline);
      if (result.success) {
        console.log(`✅ Updated ${macAddress} status to ${isOnline ? 'online' : 'offline'}`);
        this.notifyStatusChange(macAddress, isOnline, { ...data, deviceId: result.deviceId });
      } else {
        console.warn(`⚠️ Failed to update ${macAddress} status:`, result.error);
      }
    } catch (error) {
      console.error('Error updating device status:', error);
    }
  }

  // Start monitoring user devices for timeouts
  async startMonitoringUserDevices(userId) {
    try {
      const result = await getUserDevices(userId);
      if (result.success) {
        result.devices.forEach(device => {
          // Check if device should be considered offline based on last seen
          if (device.lastSeen) {
            const lastSeenTime = device.lastSeen.toDate ? device.lastSeen.toDate() : new Date(device.lastSeen);
            const timeSinceLastSeen = Date.now() - lastSeenTime.getTime();
            
            if (timeSinceLastSeen > this.offlineThreshold && device.isActive) {
              console.log(`📱 Device ${device.macAddress} appears to be offline based on last seen time`);
              this.updateDeviceStatus(device.macAddress, false);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error monitoring user devices:', error);
    }
  }

  // Stop monitoring a specific device
  stopMonitoring(macAddress) {
    if (this.deviceTimeouts.has(macAddress)) {
      clearTimeout(this.deviceTimeouts.get(macAddress));
      this.deviceTimeouts.delete(macAddress);
    }
  }

  // Stop all monitoring
  stopAllMonitoring() {
    this.deviceTimeouts.forEach(timeout => clearTimeout(timeout));
    this.deviceTimeouts.clear();
    this.statusCallbacks = [];
  }

  // Get current monitoring status
  getMonitoringStatus() {
    return {
      monitoredDevices: Array.from(this.deviceTimeouts.keys()),
      heartbeatInterval: this.heartbeatInterval,
      offlineThreshold: this.offlineThreshold
    };
  }

  // Manually ping a device to check status
  async pingDevice(macAddress, mqttService) {
    const deviceTopicBase = `devices/${macAddress.replace(/:/g, '')}`;
    
    // Send ping command
    if (mqttService && mqttService.pingDevice) {
      mqttService.pingDevice(deviceTopicBase);
      
      // Wait for response (with timeout)
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, reason: 'timeout' });
        }, 5000); // 5 second timeout

        // This would need to be connected to MQTT message handler
        // For now, we'll just return a timeout
      });
    }
    
    return { success: false, reason: 'mqtt_not_available' };
  }
}

// Export singleton instance
export const deviceStatusMonitor = new DeviceStatusMonitor();
export default DeviceStatusMonitor;