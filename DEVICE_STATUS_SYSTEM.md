# ESP32 Device Online/Offline Status Mechanism

## Overview
This system provides real-time monitoring of ESP32 device status using **configurable MQTT status reporting** (default: 30 seconds), Firebase Firestore for persistence, and React for the web interface. ESP32 devices send status updates to `device/{MAC_ADDRESS}/status` at configurable intervals, with configurable offline detection timing.

## System Architecture

### 1. Web Application Components

#### Device Status Monitor (`deviceStatusMonitor.js`)
- **Purpose**: Centralized service for managing device online/offline status
- **Features**:
  - Heartbeat timeout tracking (90-second timeout)
  - Status change notifications
  - Automatic offline marking for missed heartbeats
  - Firebase integration for status persistence

#### Enhanced MQTT Service (`mqttService.js`)
- **Topics Monitored**:
  - `devices/{MAC}/heartbeat` - Regular device heartbeat (every 30s)
  - `devices/{MAC}/online` - Device coming online
  - `devices/{MAC}/offline` - Device going offline
  - `devices/{MAC}/status` - Device status updates
  - `devices/{MAC}/ping` - Ping/pong for manual status checks

#### Device Service (`deviceService.js`)
- **New Functions**:
  - `updateDeviceStatusByMAC()` - Update device status in Firebase
  - `markDeviceOffline()` - Mark device as offline
  - `getDeviceByMAC()` - Get device by MAC address

#### Status Monitor Component (`StatusMonitor.jsx`)
- **Features**:
  - Real-time status display with visual indicators
  - Manual ping functionality
  - Status request buttons
  - Monitoring statistics
  - Last seen timestamps

### 2. ESP32 Device Code

#### Core Features (`ESP32_Device_Code.ino`)
- **Heartbeat System**: Sends heartbeat every 30 seconds
- **Status Reporting**: Regular status updates with device metrics
- **Command Handling**: Responds to ping and control commands
- **Auto-reconnection**: Handles WiFi and MQTT disconnections
- **Time Synchronization**: NTP client for accurate timestamps

#### MQTT Topics Published:
- `device/{MAC_ADDRESS}/status` - **5-second status reports** with full device metrics
- `device/{MAC_ADDRESS}/online` - Device online notification
- `device/{MAC_ADDRESS}/offline` - Device offline notification (before reboot)
- Legacy support: `devices/{MAC}/heartbeat`, `devices/{MAC}/status`

#### MQTT Topics Subscribed:
- `device/{MAC_ADDRESS}/cmd` - Control commands (AC settings, reboot, status request)
- `device/{MAC_ADDRESS}/ping` - Ping requests
- Legacy support: `devices/{MAC}/cmd`, `devices/{MAC}/ping`

## How It Works

### 1. Device Startup Process
```
ESP32 Boot → WiFi Connection → MQTT Connection → Send Online Status → Start Heartbeat Timer
```

### 2. Status Reporting Mechanism
```
Every 30 seconds (configurable):
ESP32 → Publish status → Web App receives → Reset timeout timer → Update Firebase status
```

### 3. Offline Detection
```
Missed status reports (90s timeout, configurable) → Mark device offline → Update Firebase → Notify UI components
```

### 4. Real-time UI Updates
```
MQTT message received → Device Status Monitor → Update device list → Visual status change
```

## Configuration

### Environment Variables (.env)
The system uses configurable timing parameters that can be adjusted via environment variables:

```env
# Device Status Monitoring Configuration (in milliseconds)
REACT_APP_DEVICE_STATUS_INTERVAL=30000     # ESP32 reports every 30 seconds
REACT_APP_DEVICE_OFFLINE_TIMEOUT=90000     # Device marked offline after 90 seconds
REACT_APP_DEVICE_STATUS_CHECK_INTERVAL=5000 # Web app checks status every 5 seconds
```

### Configuration Options:
- **REACT_APP_DEVICE_STATUS_INTERVAL**: How often ESP32 sends status (5s - 5min)
- **REACT_APP_DEVICE_OFFLINE_TIMEOUT**: When to mark device offline (must be > status interval)
- **REACT_APP_DEVICE_STATUS_CHECK_INTERVAL**: How often web app processes status updates

## Installation & Setup

### 1. ESP32 Arduino Code Setup
```cpp
// Update these constants in ESP32_Device_Code.ino:
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_broker = "YOUR_MQTT_BROKER_HOST";
const char* mqtt_username = "YOUR_MQTT_USERNAME";
const char* mqtt_password = "YOUR_MQTT_PASSWORD";
```

### 2. Required Arduino Libraries
```
- WiFi (ESP32 Core)
- PubSubClient (MQTT)
- ArduinoJson
- NTPClient
```

### 3. Web Application Environment
```env
REACT_APP_MQTT_BROKER_URL=ws://your-mqtt-broker:8083/mqtt
REACT_APP_MQTT_USERNAME=your_username
REACT_APP_MQTT_PASSWORD=your_password
```

## Status Flow Diagram

```
┌─────────────────┐    MQTT Heartbeat     ┌──────────────────┐
│   ESP32 Device  │ ──────────────────── │   Web Application│
│                 │                       │                  │
│ • WiFi Connected│    Every 30 seconds   │ • MQTT Service   │
│ • MQTT Client   │ ◄──── Ping/Pong ──── │ • Status Monitor │
│ • Heartbeat     │                       │ • Firebase Store │
│ • NTP Time      │    Status Updates     │ • React UI      │
└─────────────────┘ ──────────────────── └──────────────────┘
         │                                         │
         │              Firebase Firestore        │
         └─────────────── Status Persistence ─────┘
```

## Device Status States

### Online Indicators
- 🟢 Green status icon
- Recent heartbeat (< 90 seconds)
- "Online" badge in UI
- Active MQTT connection
- Responding to ping requests

### Offline Indicators
- 🔴 Red status icon
- Missed heartbeat (> 90 seconds)
- "Offline" badge in UI
- No MQTT messages received
- Ping requests timeout

## Firebase Schema

### Device Document Structure
```javascript
{
  id: "device_id",
  name: "Living Room AC",
  macAddress: "AA:BB:CC:DD:EE:FF",
  deviceType: "air_conditioner",
  userId: "user_id",
  isActive: true,           // Online/Offline status
  lastSeen: timestamp,      // Last heartbeat received
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## Monitoring Features

### Manual Device Testing
- **Ping Device**: Send ping command and wait for response
- **Status Request**: Request full device status report
- **Real-time Updates**: Automatic UI refresh on status changes

### Statistics Dashboard
- Total device count
- Online device count
- Offline device count
- Last seen timestamps
- MQTT connection status

## Troubleshooting

### ESP32 Device Issues
1. **No Heartbeat**: Check WiFi and MQTT broker connection
2. **Frequent Disconnections**: Verify network stability and broker settings
3. **Time Sync Issues**: Ensure NTP server is accessible
4. **Memory Issues**: Monitor free heap in status messages

### Web Application Issues
1. **MQTT Not Connected**: Check broker URL and WebSocket support
2. **Status Not Updating**: Verify topic subscriptions and Firebase rules
3. **UI Not Refreshing**: Check status monitor component integration

### Firebase Issues
1. **Permission Denied**: Verify Firestore security rules
2. **Timestamp Issues**: Ensure serverTimestamp() is used correctly
3. **Device Not Found**: Check MAC address format consistency

## Security Considerations

### MQTT Security
- Use secure WebSocket (wss://) in production
- Implement proper authentication credentials
- Consider device-specific topics and permissions

### Firebase Security
- Implement proper Firestore security rules
- Validate device ownership before status updates
- Use Firebase Authentication for user sessions

## Performance Optimization

### Heartbeat Tuning
- **30s Interval**: Balance between responsiveness and network usage
- **90s Timeout**: Allow for 3 missed heartbeats before marking offline
- **Retention**: Use retained messages for last known status

### Firebase Optimization
- **Batch Updates**: Group multiple status changes
- **Indexing**: Create indexes for MAC address queries
- **Cleanup**: Remove old offline devices periodically

## Future Enhancements

### Planned Features
1. **Historical Status Tracking**: Store status change history
2. **Alerts & Notifications**: Email/SMS alerts for offline devices
3. **Geofencing**: Location-based status monitoring
4. **Device Groups**: Manage multiple devices as groups
5. **Advanced Analytics**: Device uptime statistics and reporting

### ESP32 Enhancements
1. **Deep Sleep Support**: Power-saving mode with wake-up heartbeats
2. **OTA Updates**: Over-the-air firmware updates
3. **Local Web Server**: Device configuration via local web interface
4. **Sensor Integration**: Temperature, humidity, and other sensors
5. **Edge Intelligence**: Local decision making and caching