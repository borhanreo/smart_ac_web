import React, { useState, useEffect } from 'react';
import { 
  AC_FUNCTIONS, 
  AC_BRANDS, 
  saveIRCode, 
  getDeviceIRCodes, 
  deleteIRCode 
} from '../services/irCodeService';
import { connectMqtt, sendCommand } from '../mqttService';

const IRCodeLearning = ({ selectedDevice, onIRCodeLearned }) => {
  const [selectedBrand, setSelectedBrand] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [learningMode, setLearningMode] = useState(false);
  const [currentFunction, setCurrentFunction] = useState('');
  const [learnedCodes, setLearnedCodes] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success', 'error', 'info'

  useEffect(() => {
    if (selectedDevice && selectedBrand) {
      loadLearnedCodes();
    }
  }, [selectedDevice, selectedBrand]);

  useEffect(() => {
    // Setup MQTT listener for IR code responses
    if (selectedDevice && learningMode) {
      const deviceTopicBase = `devices/${selectedDevice.macAddress.replace(/:/g, '')}`;
      const responseTopic = `${deviceTopicBase}/response`;
      
      const mqttConnection = connectMqtt(
        (topic, message) => {
          if (topic.includes('/response') && message.type === 'ir_learned') {
            handleIRCodeReceived(message);
          }
        }
      );

      return () => {
        // Cleanup MQTT connection when not learning
        setLearningMode(false);
      };
    }
  }, [selectedDevice, learningMode]);

  const loadLearnedCodes = async () => {
    if (!selectedDevice || !selectedBrand) return;
    
    setLoading(true);
    try {
      const brand = selectedBrand === 'Other' ? customBrand : selectedBrand;
      const result = await getDeviceIRCodes(selectedDevice.id, brand);
      
      if (result.success) {
        setLearnedCodes(result.groupedCodes);
      }
    } catch (error) {
      console.error('Error loading learned codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const startLearning = async (functionType) => {
    if (!selectedDevice || !selectedBrand) {
      setMessage('Please select a device and AC brand first');
      setMessageType('error');
      return;
    }

    setCurrentFunction(functionType);
    setLearningMode(true);
    setMessage(`Learning ${getFunctionDisplayName(functionType)}... Point your AC remote at the device and press the button.`);
    setMessageType('info');

    // Send learning command to ESP32
    const deviceTopicBase = `devices/${selectedDevice.macAddress.replace(/:/g, '')}`;
    const command = {
      command: 'learn_ir',
      function: functionType,
      timeout: 30000 // 30 second timeout
    };

    const result = sendCommand(command.command, command, deviceTopicBase);
    if (!result) {
      setMessage('Failed to send learning command to device');
      setMessageType('error');
      setLearningMode(false);
    }
  };

  const stopLearning = () => {
    setLearningMode(false);
    setCurrentFunction('');
    setMessage('Learning cancelled');
    setMessageType('info');

    // Send stop learning command to ESP32
    if (selectedDevice) {
      const deviceTopicBase = `devices/${selectedDevice.macAddress.replace(/:/g, '')}`;
      const command = { command: 'stop_learning' };
      sendCommand(command.command, command, deviceTopicBase);
    }
  };

  const handleIRCodeReceived = async (irData) => {
    if (!currentFunction || !learningMode) return;

    setLoading(true);
    try {
      const brand = selectedBrand === 'Other' ? customBrand : selectedBrand;
      const result = await saveIRCode(
        selectedDevice.id,
        brand,
        currentFunction,
        irData.code,
        irData.rawData
      );

      if (result.success) {
        setMessage(`✅ Successfully learned ${getFunctionDisplayName(currentFunction)} for ${brand}!`);
        setMessageType('success');
        
        // Update learned codes
        setLearnedCodes(prev => ({
          ...prev,
          [currentFunction]: {
            id: result.codeId,
            functionType: currentFunction,
            irCode: irData.code,
            acBrand: brand,
            learnedAt: new Date()
          }
        }));

        if (onIRCodeLearned) {
          onIRCodeLearned(currentFunction, irData.code, brand);
        }
      } else {
        setMessage(`❌ Failed to save IR code: ${result.error}`);
        setMessageType('error');
      }
    } catch (error) {
      setMessage(`❌ Error saving IR code: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
      setLearningMode(false);
      setCurrentFunction('');
    }
  };

  const deleteLearnedCode = async (functionType) => {
    const codeToDelete = learnedCodes[functionType];
    if (!codeToDelete) return;

    const confirmed = window.confirm(`Delete learned code for ${getFunctionDisplayName(functionType)}?`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const result = await deleteIRCode(codeToDelete.id);
      if (result.success) {
        setMessage(`Deleted ${getFunctionDisplayName(functionType)} code`);
        setMessageType('success');
        
        // Remove from learned codes
        const updatedCodes = { ...learnedCodes };
        delete updatedCodes[functionType];
        setLearnedCodes(updatedCodes);
      } else {
        setMessage(`Failed to delete code: ${result.error}`);
        setMessageType('error');
      }
    } catch (error) {
      setMessage(`Error deleting code: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const testLearnedCode = (functionType) => {
    const code = learnedCodes[functionType];
    if (!code || !selectedDevice) return;

    // Send test command to ESP32
    const deviceTopicBase = `devices/${selectedDevice.macAddress.replace(/:/g, '')}`;
    const command = {
      command: 'send_ir',
      function: functionType,
      code: code.irCode
    };

    const result = sendCommand(command.command, command, deviceTopicBase);
    if (result) {
      setMessage(`📡 Testing ${getFunctionDisplayName(functionType)} code...`);
      setMessageType('info');
    } else {
      setMessage(`Failed to test ${getFunctionDisplayName(functionType)} code`);
      setMessageType('error');
    }
  };

  const getFunctionDisplayName = (functionType) => {
    const names = {
      [AC_FUNCTIONS.POWER_ON]: 'Power On',
      [AC_FUNCTIONS.POWER_OFF]: 'Power Off',
      [AC_FUNCTIONS.TEMP_UP]: 'Temperature Up',
      [AC_FUNCTIONS.TEMP_DOWN]: 'Temperature Down',
      [AC_FUNCTIONS.MODE_COOL]: 'Cool Mode',
      [AC_FUNCTIONS.MODE_HEAT]: 'Heat Mode',
      [AC_FUNCTIONS.MODE_FAN]: 'Fan Mode',
      [AC_FUNCTIONS.MODE_DRY]: 'Dry Mode',
      [AC_FUNCTIONS.MODE_AUTO]: 'Auto Mode',
      [AC_FUNCTIONS.FAN_LOW]: 'Fan Low',
      [AC_FUNCTIONS.FAN_MED]: 'Fan Medium',
      [AC_FUNCTIONS.FAN_HIGH]: 'Fan High',
      [AC_FUNCTIONS.FAN_AUTO]: 'Fan Auto',
      [AC_FUNCTIONS.SWING_ON]: 'Swing On',
      [AC_FUNCTIONS.SWING_OFF]: 'Swing Off',
      [AC_FUNCTIONS.TIMER]: 'Timer',
      [AC_FUNCTIONS.SLEEP]: 'Sleep Mode'
    };
    return names[functionType] || functionType;
  };

  const clearMessage = () => {
    setMessage('');
    setMessageType('');
  };

  if (!selectedDevice) {
    return (
      <div className="ir-learning-container">
        <p className="no-device-message">Please select a device to configure IR codes</p>
      </div>
    );
  }

  return (
    <div className="ir-learning-container">
      <div className="ir-learning-header">
        <h3>🔧 IR Remote Learning</h3>
        <p>Learn IR codes from your AC remote control</p>
      </div>

      {/* Brand Selection */}
      <div className="brand-selection">
        <label htmlFor="ac-brand">AC Brand:</label>
        <select
          id="ac-brand"
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          disabled={learningMode}
        >
          <option value="">Select AC Brand</option>
          {AC_BRANDS.map(brand => (
            <option key={brand} value={brand}>{brand}</option>
          ))}
        </select>

        {selectedBrand === 'Other' && (
          <input
            type="text"
            placeholder="Enter custom brand name"
            value={customBrand}
            onChange={(e) => setCustomBrand(e.target.value)}
            disabled={learningMode}
            className="custom-brand-input"
          />
        )}
      </div>

      {/* Message Display */}
      {message && (
        <div className={`message-bar ${messageType}`}>
          <span>{message}</span>
          <button onClick={clearMessage} className="close-message">×</button>
        </div>
      )}

      {/* Learning Controls */}
      {selectedBrand && (selectedBrand !== 'Other' || customBrand) && (
        <div className="learning-controls">
          <div className="function-grid">
            {Object.values(AC_FUNCTIONS).map(functionType => (
              <div key={functionType} className="function-item">
                <div className="function-info">
                  <span className="function-name">{getFunctionDisplayName(functionType)}</span>
                  {learnedCodes[functionType] && (
                    <span className="learned-indicator">✅ Learned</span>
                  )}
                </div>
                
                <div className="function-actions">
                  {!learningMode ? (
                    <>
                      <button
                        onClick={() => startLearning(functionType)}
                        className="learn-btn"
                        disabled={loading}
                      >
                        {learnedCodes[functionType] ? '🔄 Re-learn' : '📡 Learn'}
                      </button>
                      
                      {learnedCodes[functionType] && (
                        <>
                          <button
                            onClick={() => testLearnedCode(functionType)}
                            className="test-btn"
                            disabled={loading}
                          >
                            🧪 Test
                          </button>
                          <button
                            onClick={() => deleteLearnedCode(functionType)}
                            className="delete-btn"
                            disabled={loading}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </>
                  ) : currentFunction === functionType ? (
                    <button
                      onClick={stopLearning}
                      className="stop-btn"
                    >
                      ⏹️ Stop Learning
                    </button>
                  ) : (
                    <button disabled className="learn-btn disabled">
                      Waiting...
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .ir-learning-container {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-top: 24px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .ir-learning-header {
          margin-bottom: 24px;
          text-align: center;
        }

        .ir-learning-header h3 {
          margin: 0 0 8px 0;
          color: #1f2937;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .ir-learning-header p {
          margin: 0;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .brand-selection {
          margin-bottom: 24px;
        }

        .brand-selection label {
          display: block;
          margin-bottom: 8px;
          color: #374151;
          font-weight: 500;
        }

        .brand-selection select,
        .custom-brand-input {
          width: 100%;
          padding: 8px 12px;
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          font-size: 1rem;
          transition: border-color 0.2s;
        }

        .brand-selection select:focus,
        .custom-brand-input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .custom-brand-input {
          margin-top: 12px;
        }

        .message-bar {
          padding: 12px 16px;
          margin-bottom: 20px;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .message-bar.success {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        .message-bar.error {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .message-bar.info {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
        }

        .close-message {
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0;
          margin-left: 12px;
          opacity: 0.7;
        }

        .close-message:hover {
          opacity: 1;
        }

        .function-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
        }

        .function-item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          background: #fafafa;
        }

        .function-info {
          margin-bottom: 12px;
        }

        .function-name {
          font-weight: 500;
          color: #374151;
        }

        .learned-indicator {
          display: block;
          font-size: 0.75rem;
          color: #059669;
          margin-top: 4px;
        }

        .function-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .learn-btn,
        .test-btn,
        .delete-btn,
        .stop-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .learn-btn {
          background: #3b82f6;
          color: white;
        }

        .learn-btn:hover:not(:disabled) {
          background: #2563eb;
        }

        .test-btn {
          background: #10b981;
          color: white;
        }

        .test-btn:hover:not(:disabled) {
          background: #059669;
        }

        .delete-btn {
          background: #ef4444;
          color: white;
        }

        .delete-btn:hover:not(:disabled) {
          background: #dc2626;
        }

        .stop-btn {
          background: #f59e0b;
          color: white;
        }

        .stop-btn:hover {
          background: #d97706;
        }

        .learn-btn.disabled,
        .learn-btn:disabled,
        .test-btn:disabled,
        .delete-btn:disabled {
          background: #d1d5db;
          cursor: not-allowed;
        }

        .no-device-message {
          text-align: center;
          color: #6b7280;
          padding: 40px 20px;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .function-grid {
            grid-template-columns: 1fr;
          }
          
          .function-actions {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default IRCodeLearning;