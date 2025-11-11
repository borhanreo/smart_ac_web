import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { 
  AC_BRANDS, 
  IR_COMMANDS, 
  COMMAND_LABELS,
  saveIRCode,
  getDeviceIRCodes,
  getIRCodeForCommand,
  updateIRCode,
  deleteIRCode
} from '../services/irCodeService';
import { sendCommand } from '../mqttService';

const IRCodeLearning = forwardRef(({ selectedDevice, onClose }, ref) => {
  const [selectedBrand, setSelectedBrand] = useState('');
  const [learningCommand, setLearningCommand] = useState('');
  const [isLearning, setIsLearning] = useState(false);
  const [learnedCodes, setLearnedCodes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [learningTimeout, setLearningTimeout] = useState(null);

  useEffect(() => {
    if (selectedDevice) {
      loadDeviceIRCodes();
    }
  }, [selectedDevice]);

  const loadDeviceIRCodes = async () => {
    try {
      setLoading(true);
      const result = await getDeviceIRCodes(selectedDevice.id);
      
      if (result.success) {
        const codesMap = {};
        let deviceBrand = '';
        
        result.irCodes.forEach(code => {
          codesMap[code.command] = code;
          if (!deviceBrand && code.brand) {
            deviceBrand = code.brand;
          }
        });
        
        setLearnedCodes(codesMap);
        if (deviceBrand) {
          setSelectedBrand(deviceBrand);
        }
      }
    } catch (err) {
      setError('Failed to load IR codes');
      console.error('Error loading IR codes:', err);
    } finally {
      setLoading(false);
    }
  };

  const startLearning = async (command) => {
    if (!selectedBrand) {
      setError('Please select AC brand first');
      return;
    }

    setLearningCommand(command);
    setIsLearning(true);
    setError('');
    setSuccess('');

    try {
      // Send IR learning command to ESP32
      const deviceTopicBase = `devices/${selectedDevice.macAddress.replace(/:/g, '')}`;
      const learnCommand = {
        command: 'learn_ir',
        ir_command: command,
        brand: selectedBrand,
        timeout: 30000 // 30 second timeout
      };

      const result = sendCommand(learnCommand.command, learnCommand, deviceTopicBase);
      
      if (result) {
        console.log(`📡 IR learning command sent for ${command}`);
        
        // Set timeout for learning
        const timeout = setTimeout(() => {
          setIsLearning(false);
          setLearningCommand('');
          setError('Learning timeout. Please try again.');
        }, 30000);
        
        setLearningTimeout(timeout);
        
        // Listen for response (this would be handled by MQTT message handler)
        setupLearningListener(command);
      } else {
        throw new Error('Failed to send learning command');
      }
    } catch (err) {
      setIsLearning(false);
      setLearningCommand('');
      setError('Failed to start IR learning: ' + err.message);
      console.error('IR learning error:', err);
    }
  };

  const setupLearningListener = (command) => {
    // This function sets up listening for the IR code response
    // The actual MQTT response handling would be done in the parent component
    // or through a global MQTT handler that calls handleLearningResponse
    console.log(`🎯 Listening for IR learning response for command: ${command}`);
  };

  // This function should be called when MQTT response is received
  const handleLearningResponse = async (responseData) => {
    console.log('🎯 IR Learning Response Handler Called');
    console.log('📨 Response data:', responseData);
    console.log('🔄 Current learning state:', { isLearning, learningCommand });
    
    if (!isLearning) {
      console.log('⚠️ Not currently learning, ignoring response');
      return;
    }
    
    if (responseData.ir_command !== learningCommand) {
      console.log('⚠️ Response command mismatch:', {
        expected: learningCommand,
        received: responseData.ir_command
      });
      return;
    }
    
    console.log('✅ Response validation passed, processing...');

    clearTimeout(learningTimeout);
    setIsLearning(false);

    try {
      if (responseData.success && responseData.ir_code) {
        // Save the learned IR code to Firebase
        const result = await saveIRCode(
          selectedDevice.id,
          selectedDevice.macAddress,
          selectedBrand,
          learningCommand,
          responseData.ir_code,
          responseData.protocol || 'NEC'
        );

        if (result.success) {
          // Update local state
          setLearnedCodes(prev => ({
            ...prev,
            [learningCommand]: {
              id: result.id,
              deviceId: selectedDevice.id,
              macAddress: selectedDevice.macAddress,
              brand: selectedBrand,
              command: learningCommand,
              irCode: responseData.ir_code,
              protocol: responseData.protocol || 'NEC'
            }
          }));

          setSuccess(`✅ Successfully learned ${COMMAND_LABELS[learningCommand]}`);
          console.log(`✅ IR code learned and saved: ${learningCommand} = ${responseData.ir_code}`);
        } else {
          setError('Failed to save IR code: ' + result.error);
        }
      } else {
        setError('Failed to learn IR code: ' + (responseData.error || 'No IR signal received'));
      }
    } catch (err) {
      setError('Error processing IR code: ' + err.message);
      console.error('Error processing learned IR code:', err);
    }

    setLearningCommand('');
  };

  const cancelLearning = () => {
    if (learningTimeout) {
      clearTimeout(learningTimeout);
    }
    setIsLearning(false);
    setLearningCommand('');
    setError('');
  };

  const testIRCode = async (command) => {
    const irCode = learnedCodes[command];
    if (!irCode) {
      setError('No IR code found for this command');
      return;
    }

    try {
      const deviceTopicBase = `devices/${selectedDevice.macAddress.replace(/:/g, '')}`;
      const testCommand = {
        command: 'send_ir',
        ir_code: irCode.irCode,
        protocol: irCode.protocol,
        ir_command: command
      };

      const result = sendCommand(testCommand.command, testCommand, deviceTopicBase);
      
      if (result) {
        setSuccess(`🧪 Testing ${COMMAND_LABELS[command]}...`);
        console.log(`🧪 Testing IR code for ${command}: ${irCode.irCode}`);
      } else {
        setError('Failed to send test command');
      }
    } catch (err) {
      setError('Failed to test IR code: ' + err.message);
      console.error('IR test error:', err);
    }
  };

  const deleteIRCodeHandler = async (command) => {
    const irCode = learnedCodes[command];
    if (!irCode || !window.confirm(`Delete IR code for ${COMMAND_LABELS[command]}?`)) {
      return;
    }

    try {
      const result = await deleteIRCode(irCode.id);
      
      if (result.success) {
        setLearnedCodes(prev => {
          const updated = { ...prev };
          delete updated[command];
          return updated;
        });
        setSuccess(`🗑️ Deleted ${COMMAND_LABELS[command]} IR code`);
      } else {
        setError('Failed to delete IR code: ' + result.error);
      }
    } catch (err) {
      setError('Error deleting IR code: ' + err.message);
      console.error('Delete IR code error:', err);
    }
  };

  // Expose the handleLearningResponse function for parent component
  useImperativeHandle(ref, () => {
    console.log('🔧 useImperativeHandle called, exposing handleLearningResponse');
    console.log('🔧 Current learning state:', { isLearning, learningCommand });
    const exposedMethods = {
      handleLearningResponse,
      // Add some debug methods
      getCurrentState: () => ({ isLearning, learningCommand }),
      testMethod: () => console.log('🧪 Test method called from IR Learning component')
    };
    console.log('🔧 Exposed methods:', Object.keys(exposedMethods));
    return exposedMethods;
  }, [handleLearningResponse, isLearning, learningCommand]);

  // Debug: Log when component mounts and unmounts
  useEffect(() => {
    console.log('🎛️ IRCodeLearning component mounted');
    
    // Store handler globally as backup
    window.irLearningHandler = handleLearningResponse;
    console.log('💾 Stored IR learning handler globally');
    
    return () => {
      console.log('🎛️ IRCodeLearning component unmounted');
      window.irLearningHandler = null;
    };
  }, [handleLearningResponse]);

  const commandCategories = {
    'Power': [IR_COMMANDS.POWER_ON, IR_COMMANDS.POWER_OFF, IR_COMMANDS.POWER_TOGGLE],
    'Temperature': [IR_COMMANDS.TEMP_UP, IR_COMMANDS.TEMP_DOWN],
    'Mode': [IR_COMMANDS.MODE_COOL, IR_COMMANDS.MODE_HEAT, IR_COMMANDS.MODE_FAN, IR_COMMANDS.MODE_DRY, IR_COMMANDS.MODE_AUTO],
    'Fan': [IR_COMMANDS.FAN_LOW, IR_COMMANDS.FAN_MED, IR_COMMANDS.FAN_HIGH, IR_COMMANDS.FAN_AUTO],
    'Other': [IR_COMMANDS.SWING_ON, IR_COMMANDS.SWING_OFF, IR_COMMANDS.TIMER, IR_COMMANDS.SLEEP]
  };

  if (loading) {
    return (
      <div className="ir-learning-modal">
        <div className="ir-learning-content">
          <div className="loading">Loading IR codes...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ir-learning-modal">
      <div className="ir-learning-content">
        <div className="ir-learning-header">
          <h2>🎛️ IR Remote Code Learning</h2>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        <div className="device-info">
          <h3>Device: {selectedDevice.name}</h3>
          <p>MAC: {selectedDevice.macAddress}</p>
        </div>

        {/* Brand Selection */}
        <div className="brand-selection">
          <label htmlFor="brand-select">AC Brand:</label>
          <select
            id="brand-select"
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            disabled={isLearning}
          >
            <option value="">Select AC Brand</option>
            {AC_BRANDS.map(brand => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
        </div>

        {/* Status Messages */}
        {error && <div className="error-message">❌ {error}</div>}
        {success && <div className="success-message">✅ {success}</div>}

        {/* Learning Status */}
        {isLearning && (
          <div className="learning-status">
            <div className="learning-indicator">
              <div className="spinner"></div>
              <div className="learning-text">
                <h3>Learning {COMMAND_LABELS[learningCommand]}...</h3>
                <p>Point your AC remote at the ESP32 and press the corresponding button</p>
                <button onClick={cancelLearning} className="cancel-btn">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Command Categories */}
        {!isLearning && selectedBrand && (
          <div className="commands-grid">
            {Object.entries(commandCategories).map(([category, commands]) => (
              <div key={category} className="command-category">
                <h4>{category}</h4>
                <div className="command-buttons">
                  {commands.map(command => {
                    const isLearned = learnedCodes[command];
                    return (
                      <div key={command} className="command-item">
                        <div className="command-info">
                          <span className="command-label">{COMMAND_LABELS[command]}</span>
                          {isLearned && <span className="learned-badge">✓</span>}
                        </div>
                        <div className="command-actions">
                          <button
                            onClick={() => startLearning(command)}
                            className={`learn-btn ${isLearned ? 'relearn' : ''}`}
                            disabled={isLearning}
                          >
                            {isLearned ? '🔄 Re-learn' : '📡 Learn'}
                          </button>
                          {isLearned && (
                            <>
                              <button
                                onClick={() => testIRCode(command)}
                                className="test-btn"
                                disabled={isLearning}
                              >
                                🧪 Test
                              </button>
                              <button
                                onClick={() => deleteIRCodeHandler(command)}
                                className="delete-btn"
                                disabled={isLearning}
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Debug Test Button */}
        <div style={{textAlign: 'center', marginBottom: '16px'}}>
          <button
            onClick={() => {
              console.log('🧪 Testing handleLearningResponse directly...');
              const testData = {
                type: "ir_learning_response",
                success: true,
                ir_command: learningCommand || "power_on",
                ir_code: "0x20DF10EF",
                protocol: "NEC"
              };
              console.log('🧪 Test data:', testData);
              console.log('🧪 Current learning state:', { isLearning, learningCommand });
              handleLearningResponse(testData);
            }}
            style={{
              background: '#10b981',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            🧪 Test Handler
          </button>
        </div>

        {/* Instructions */}
        <div className="instructions">
          <h4>📋 Instructions:</h4>
          <ol>
            <li>Select your AC brand from the dropdown</li>
            <li>Click "📡 Learn" for any button you want to teach</li>
            <li>Point your original AC remote at the ESP32 device</li>
            <li>Press the corresponding button on your remote within 30 seconds</li>
            <li>Use "🧪 Test" to verify the learned code works</li>
            <li>Learned codes are automatically saved to your device</li>
          </ol>
        </div>
      </div>

      <style jsx>{`
        .ir-learning-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .ir-learning-content {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          width: 100%;
        }

        .ir-learning-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #f3f4f6;
          padding-bottom: 16px;
        }

        .ir-learning-header h2 {
          margin: 0;
          color: #1f2937;
          font-size: 1.5rem;
        }

        .close-btn {
          background: #ef4444;
          color: white;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 16px;
        }

        .device-info {
          background: #f8fafc;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .device-info h3 {
          margin: 0 0 8px 0;
          color: #1f2937;
        }

        .device-info p {
          margin: 0;
          color: #6b7280;
          font-family: monospace;
        }

        .brand-selection {
          margin-bottom: 20px;
        }

        .brand-selection label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #374151;
        }

        .brand-selection select {
          width: 100%;
          padding: 8px 12px;
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          font-size: 16px;
        }

        .error-message {
          background: #fef2f2;
          color: #dc2626;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          border: 1px solid #fecaca;
        }

        .success-message {
          background: #f0fdf4;
          color: #16a34a;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 16px;
          border: 1px solid #bbf7d0;
        }

        .learning-status {
          background: #eff6ff;
          padding: 24px;
          border-radius: 8px;
          margin-bottom: 20px;
          border: 2px solid #3b82f6;
        }

        .learning-indicator {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e5e7eb;
          border-top: 4px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .learning-text h3 {
          margin: 0 0 8px 0;
          color: #1f2937;
        }

        .learning-text p {
          margin: 0 0 12px 0;
          color: #6b7280;
        }

        .cancel-btn {
          background: #ef4444;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
        }

        .commands-grid {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-bottom: 24px;
        }

        .command-category h4 {
          margin: 0 0 12px 0;
          color: #1f2937;
          font-size: 1.1rem;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }

        .command-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 12px;
        }

        .command-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f9fafb;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }

        .command-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .command-label {
          font-weight: 500;
          color: #374151;
        }

        .learned-badge {
          background: #10b981;
          color: white;
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 10px;
        }

        .command-actions {
          display: flex;
          gap: 6px;
        }

        .learn-btn,
        .test-btn,
        .delete-btn {
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: background-color 0.2s;
        }

        .learn-btn {
          background: #3b82f6;
          color: white;
        }

        .learn-btn.relearn {
          background: #f59e0b;
        }

        .test-btn {
          background: #10b981;
          color: white;
        }

        .delete-btn {
          background: #ef4444;
          color: white;
        }

        .learn-btn:hover {
          background: #2563eb;
        }

        .learn-btn.relearn:hover {
          background: #d97706;
        }

        .test-btn:hover {
          background: #059669;
        }

        .delete-btn:hover {
          background: #dc2626;
        }

        .instructions {
          background: #f8fafc;
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid #3b82f6;
        }

        .instructions h4 {
          margin: 0 0 12px 0;
          color: #1f2937;
        }

        .instructions ol {
          margin: 0;
          padding-left: 20px;
          color: #6b7280;
        }

        .instructions li {
          margin-bottom: 6px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        @media (max-width: 768px) {
          .ir-learning-modal {
            padding: 10px;
          }

          .ir-learning-content {
            padding: 16px;
          }

          .command-buttons {
            grid-template-columns: 1fr;
          }

          .learning-indicator {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
});

export default IRCodeLearning;