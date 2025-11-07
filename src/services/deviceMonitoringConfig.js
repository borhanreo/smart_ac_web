// Configuration service for device monitoring settings
class DeviceMonitoringConfig {
  constructor() {
    // Load configuration from environment variables with defaults
    this.statusInterval = parseInt(process.env.REACT_APP_DEVICE_STATUS_INTERVAL) || 30000; // 30 seconds
    this.offlineTimeout = parseInt(process.env.REACT_APP_DEVICE_OFFLINE_TIMEOUT) || 90000; // 90 seconds  
    this.statusCheckInterval = parseInt(process.env.REACT_APP_DEVICE_STATUS_CHECK_INTERVAL) || 5000; // 5 seconds
    
    console.log('📊 Device Monitoring Configuration loaded:', {
      statusInterval: `${this.statusInterval}ms (${this.statusInterval/1000}s)`,
      offlineTimeout: `${this.offlineTimeout}ms (${this.offlineTimeout/1000}s)`,
      statusCheckInterval: `${this.statusCheckInterval}ms (${this.statusCheckInterval/1000}s)`
    });
  }

  // Get status reporting interval in milliseconds
  getStatusInterval() {
    return this.statusInterval;
  }

  // Get offline timeout in milliseconds  
  getOfflineTimeout() {
    return this.offlineTimeout;
  }

  // Get status check interval in milliseconds
  getStatusCheckInterval() {
    return this.statusCheckInterval;
  }

  // Get status reporting interval in seconds
  getStatusIntervalSeconds() {
    return this.statusInterval / 1000;
  }

  // Get offline timeout in seconds
  getOfflineTimeoutSeconds() {
    return this.offlineTimeout / 1000;
  }

  // Get status check interval in seconds  
  getStatusCheckIntervalSeconds() {
    return this.statusCheckInterval / 1000;
  }

  // Get human-readable configuration summary
  getConfigSummary() {
    return {
      statusReport: `${this.getStatusIntervalSeconds()}s`,
      offlineDetection: `${this.getOfflineTimeoutSeconds()}s`, 
      checkInterval: `${this.getStatusCheckIntervalSeconds()}s`,
      description: `Devices report every ${this.getStatusIntervalSeconds()}s • Offline after ${this.getOfflineTimeoutSeconds()}s`
    };
  }

  // Validate configuration values
  isValid() {
    const validations = [
      { value: this.statusInterval, min: 5000, max: 300000, name: 'Status Interval' },
      { value: this.offlineTimeout, min: 10000, max: 600000, name: 'Offline Timeout' },
      { value: this.statusCheckInterval, min: 1000, max: 60000, name: 'Status Check Interval' }
    ];

    for (const validation of validations) {
      if (validation.value < validation.min || validation.value > validation.max) {
        console.error(`❌ ${validation.name} (${validation.value}ms) is out of valid range: ${validation.min}-${validation.max}ms`);
        return false;
      }
    }

    // Logical validation: offline timeout should be greater than status interval
    if (this.offlineTimeout <= this.statusInterval) {
      console.error(`❌ Offline timeout (${this.offlineTimeout}ms) must be greater than status interval (${this.statusInterval}ms)`);
      return false;
    }

    return true;
  }

  // Get ESP32 configuration values for Arduino code
  getESP32Config() {
    return {
      statusReportInterval: this.statusInterval,
      comment: `// Configured for ${this.getStatusIntervalSeconds()}s reporting interval`
    };
  }
}

// Export singleton instance
export const deviceMonitoringConfig = new DeviceMonitoringConfig();
export default DeviceMonitoringConfig;