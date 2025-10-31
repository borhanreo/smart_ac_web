# Smart AC Controller

A React-based web application for controlling and monitoring smart air conditioning units remotely. This application provides real-time control, scheduling, and monitoring capabilities through MQTT communication and Firebase authentication.

## Features

- 🔐 **User Authentication** - Secure login using Firebase Auth
- 🎛️ **Remote Control** - Real-time AC control (temperature, mode, fan speed, power)
- 📅 **Smart Scheduling** - Create and manage AC schedules
- 📊 **Status Monitoring** - Real-time monitoring of AC status and sensor data
- 🌐 **MQTT Integration** - Real-time communication with AC devices
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Technology Stack

- **Frontend**: React 18, JavaScript (ES6+)
- **Authentication**: Firebase Auth
- **Real-time Communication**: MQTT over WebSocket
- **Styling**: CSS3
- **Build Tool**: React Scripts (Create React App)

## Prerequisites

Before running this application, ensure you have:

- Node.js (version 14 or higher)
- npm or yarn package manager
- Firebase project with Authentication enabled
- MQTT broker with WebSocket support
- Smart AC device compatible with MQTT

## Installation

1. **If windows the open WSL**
   ```bash
   cd /mnt/d/D/....
   git clone <repository-url>
   cd react_ac_web
   ```

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd react_ac_web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your actual configuration:
   ```env
   REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_APP_ID=your_firebase_app_id
   
   REACT_APP_MQTT_BROKER=wss://your-broker-url:8083/mqtt
   REACT_APP_MQTT_USERNAME=your_mqtt_user
   REACT_APP_MQTT_PASSWORD=your_mqtt_password
   REACT_APP_MQTT_TOPIC_BASE=device/ac01
   ```

## Configuration

### Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication and configure sign-in methods
3. Get your Firebase config from Project Settings
4. Update the environment variables with your Firebase credentials

### MQTT Broker Setup

1. Set up an MQTT broker with WebSocket support (e.g., Mosquitto, HiveMQ)
2. Ensure WebSocket port is accessible (typically 8083 for WSS)
3. Configure authentication if required
4. Update MQTT environment variables

## Usage

### Development

Start the development server:

open WSL
```bash
cd cd /mnt/d/D/Local\ Project/Smart\ AC/react_ac_web
npm install
```


```bash
npm start
```

The application will open in your browser at `http://localhost:3000`.

### Production Build

Create a production build:

```bash
npm run build
```

The build files will be created in the `build/` directory.

### Testing

Run the test suite:

```bash
npm test
```

## Project Structure

```
src/
├── App.jsx                 # Main application component
├── index.js               # Application entry point
├── firebase.js            # Firebase configuration
├── mqttService.js         # MQTT service for device communication
├── styles.css             # Global styles
└── components/
    ├── ControlPanel.jsx   # AC control interface
    ├── Login.jsx          # User authentication
    ├── ScheduleManager.jsx # Schedule management
    └── StatusMonitor.jsx  # Real-time status display
```

## Components

### ControlPanel
- Temperature control
- Mode selection (Cool, Heat, Auto, Fan)
- Fan speed adjustment
- Power on/off

### ScheduleManager
- Create, edit, and delete schedules
- Time-based automation
- Recurring schedule options

### StatusMonitor
- Real-time temperature readings
- Device status indicators
- Connection status
- Historical data display

### Login
- Firebase authentication
- User session management
- Secure access control

## MQTT Communication

The application communicates with AC devices using MQTT protocol:

- **Command Topic**: `device/{deviceId}/command`
- **Status Topic**: `device/{deviceId}/status`
- **Sensor Topic**: `device/{deviceId}/sensors`

### Message Format

Commands sent to AC device:
```json
{
  "temperature": 24,
  "mode": "cool",
  "fanSpeed": 2,
  "power": true,
  "timestamp": "2025-10-31T10:30:00Z"
}
```

Status received from AC device:
```json
{
  "currentTemp": 26,
  "targetTemp": 24,
  "mode": "cool",
  "fanSpeed": 2,
  "power": true,
  "humidity": 65,
  "timestamp": "2025-10-31T10:30:05Z"
}
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_FIREBASE_API_KEY` | Firebase API key | `AIzaSyC...` |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `project.firebaseapp.com` |
| `REACT_APP_FIREBASE_PROJECT_ID` | Firebase project ID | `smart-ac-project` |
| `REACT_APP_FIREBASE_APP_ID` | Firebase app ID | `1:123456789:web:abc...` |
| `REACT_APP_MQTT_BROKER` | MQTT broker WebSocket URL | `wss://broker.hivemq.com:8083/mqtt` |
| `REACT_APP_MQTT_USERNAME` | MQTT username | `your_username` |
| `REACT_APP_MQTT_PASSWORD` | MQTT password | `your_password` |
| `REACT_APP_MQTT_TOPIC_BASE` | Base MQTT topic | `device/ac01` |

## Deployment

### Netlify

1. Build the project: `npm run build`
2. Upload the `build/` folder to Netlify
3. Configure environment variables in Netlify dashboard

### Vercel

1. Connect your repository to Vercel
2. Configure environment variables
3. Deploy automatically on push

### Firebase Hosting

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Initialize: `firebase init hosting`
3. Build and deploy: `npm run build && firebase deploy`

## Troubleshooting

### Common Issues

1. **MQTT Connection Failed**
   - Check broker URL and credentials
   - Ensure WebSocket port is accessible
   - Verify network connectivity

2. **Firebase Authentication Error**
   - Verify Firebase configuration
   - Check API keys and project settings
   - Ensure authentication methods are enabled

3. **Build Errors**
   - Check Node.js version compatibility
   - Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`

### Debug Mode

Enable debug mode by adding to your `.env`:
```env
REACT_APP_DEBUG=true
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review MQTT and Firebase documentation

## Changelog

### Version 1.0.0
- Initial release
- Basic AC control functionality
- Firebase authentication
- MQTT communication
- Schedule management
- Status monitoring

---

**Note**: Make sure to keep your environment variables secure and never commit them to version control.# smart_ac_react
# smart_ac_web
