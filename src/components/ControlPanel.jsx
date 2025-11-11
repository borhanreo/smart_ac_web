import React, { useState, useEffect, useRef } from "react";
import { sendCommand, subscribeToTopic, unsubscribeFromTopic, getSubscriptions, simulateESP32Response, forceSubscribeToResponseTopic, getMQTTStatus } from "../mqttService";
import IRCodeLearning from "./IRCodeLearning";
import { getDeviceIRCodes, getIRCodeForCommand } from '../services/irCodeService';

export default function ControlPanel({ selectedDevice }) {
  const [temp, setTemp] = useState(23);
  const [mode, setMode] = useState("cool");
  const [fan, setFan] = useState("auto");
  const [powerOn, setPowerOn] = useState(true);
  const [isHealthOn, setIsHealthOn] = useState(true);
  const [showIRLearning, setShowIRLearning] = useState(false);
  const [deviceIRCodes, setDeviceIRCodes] = useState({});
  const [irLearningEnabled, setIrLearningEnabled] = useState(false);

  const modes = ['Cool', 'Heat', 'Fan', 'Dry', 'Auto'];
  const [currentModeIndex, setCurrentModeIndex] = useState(0);
  
  const irLearningRef = useRef(null);

  // Load device IR codes and setup MQTT listener
  useEffect(() => {
    if (selectedDevice) {
      loadDeviceIRCodes();
      setupResponseListener();
    }
    
    return () => {
      cleanupResponseListener();
    };
  }, [selectedDevice]);

  const loadDeviceIRCodes = async () => {
    if (!selectedDevice) return;
    
    try {
      const result = await getDeviceIRCodes(selectedDevice.id);
      if (result.success) {
        const codesMap = {};
        result.irCodes.forEach(code => {
          codesMap[code.command] = code;
        });
        setDeviceIRCodes(codesMap);
        setIrLearningEnabled(result.irCodes.length > 0);
      }
    } catch (error) {
      console.error('Error loading device IR codes:', error);
    }
  };

  const setupResponseListener = () => {
    if (!selectedDevice) {
      console.log('⚠️ No selected device for IR response listener setup');
      return;
    }
    
    const macWithoutColons = selectedDevice.macAddress.replace(/:/g, '');
    const responseTopic = `devices/${macWithoutColons}/response`;
    console.log(`🔧 Setting up IR response listener for device: ${selectedDevice.name}`);
    console.log(`📍 MAC Address: ${selectedDevice.macAddress} → ${macWithoutColons}`);
    console.log(`📡 Subscribing to topic: ${responseTopic}`);
    
    subscribeToTopic(responseTopic, handleMQTTResponse);
    console.log(`✅ Subscribed to ${responseTopic}`);
  };

  const cleanupResponseListener = () => {
    if (!selectedDevice) return;
    
    const responseTopic = `devices/${selectedDevice.macAddress.replace(/:/g, '')}/response`;
    unsubscribeFromTopic(responseTopic);
    console.log(`📡 Unsubscribed from ${responseTopic}`);
  };

  const handleMQTTResponse = (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 MQTT Response received on topic:', topic);
      console.log('📨 Message data:', data);
      
      // Enhanced debugging for IR learning responses
      if (data.type === 'ir_learning_response') {
        console.log('🎛️ IR LEARNING RESPONSE DETECTED IN CONTROL PANEL!');
        console.log('🔍 IR Learning Modal Open:', showIRLearning);
        console.log('🔍 IR Learning Ref Current:', !!irLearningRef.current);
        console.log('🔍 IR Learning Ref Methods:', irLearningRef.current ? Object.keys(irLearningRef.current) : 'No methods');
        
        // Store the message for potential retry
        window.lastIRResponse = data;
        console.log('💾 Stored IR response for potential retry');
        
        if (irLearningRef.current && irLearningRef.current.handleLearningResponse) {
          console.log('🎯 Forwarding IR learning response to component via ref');
          try {
            irLearningRef.current.handleLearningResponse(data);
            console.log('✅ Successfully called handleLearningResponse via ref');
          } catch (error) {
            console.error('❌ Error calling handleLearningResponse via ref:', error);
          }
        } else if (window.irLearningHandler) {
          console.log('🎯 Forwarding IR learning response via global handler');
          try {
            window.irLearningHandler(data);
            console.log('✅ Successfully called handleLearningResponse via global handler');
          } catch (error) {
            console.error('❌ Error calling handleLearningResponse via global handler:', error);
          }
        } else {
          console.log('❌ Cannot forward IR response:');
          console.log('  - Modal Open:', showIRLearning);
          console.log('  - Ref Available:', !!irLearningRef.current);
          console.log('  - Handler Available:', !!(irLearningRef.current?.handleLearningResponse));
          console.log('  - Ref Contents:', irLearningRef.current ? Object.keys(irLearningRef.current) : 'No ref');
          
          // Try calling test method if available
          if (irLearningRef.current?.testMethod) {
            console.log('🧪 Testing ref connection...');
            irLearningRef.current.testMethod();
          }
          
          // Try to retry after a short delay
          setTimeout(() => {
            if (irLearningRef.current && irLearningRef.current.handleLearningResponse) {
              console.log('🔄 Retrying IR response forwarding via ref...');
              try {
                irLearningRef.current.handleLearningResponse(data);
                console.log('✅ Retry successful via ref!');
              } catch (error) {
                console.error('❌ Retry failed via ref:', error);
              }
            } else if (window.irLearningHandler) {
              console.log('🔄 Retrying IR response forwarding via global handler...');
              try {
                window.irLearningHandler(data);
                console.log('✅ Retry successful via global handler!');
              } catch (error) {
                console.error('❌ Retry failed via global handler:', error);
              }
            } else {
              console.log('❌ Retry conditions not met - Ref:', !!irLearningRef.current, 'GlobalHandler:', !!window.irLearningHandler);
            }
          }, 100);
        }
      } else {
        console.log('📋 Response type:', data.type, '(not IR learning response)');
      }
    } catch (error) {
      console.error('❌ Error parsing MQTT response:', error);
      console.log('Raw message:', message.toString());
    }
  };

  const getDeviceTopicBase = () => {
    if (!selectedDevice) return null;
    // Use plural 'devices' for control commands with MAC without colons
    return selectedDevice.mqttTopicBase || `devices/${selectedDevice.macAddress.replace(/:/g, '')}`;
  };  const handleSendCommand = async (command, payload = {}) => {
    const topicBase = getDeviceTopicBase();
    if (!topicBase) {
      console.warn("No device selected or invalid device");
      return;
    }

    // Check if we have a learned IR code for this command
    const irCode = deviceIRCodes[command];
    
    if (irCode && irLearningEnabled) {
      // Send IR code instead of basic command
      const irPayload = {
        command: 'send_ir',
        ir_code: irCode.irCode,
        protocol: irCode.protocol || 'NEC',
        ir_command: command,
        ...payload
      };
      
      console.log(`🎛️ Sending IR command: ${command} with code: ${irCode.irCode}`);
      sendCommand(irPayload.command, irPayload, topicBase);
    } else {
      // Send regular command
      console.log(`📡 Sending regular command: ${command}`);
      sendCommand(command, payload, topicBase);
    }
  };

  const togglePower = () => {
    const newPowerState = !powerOn;
    setPowerOn(newPowerState);
    handleSendCommand(newPowerState ? "power_on" : "power_off");
  };

  const adjustTemp = (delta) => {
    if (powerOn) {
      const newTemp = Math.max(16, Math.min(30, temp + delta));
      setTemp(newTemp);
      
      if (delta > 0) {
        handleSendCommand("temp_up", { value: newTemp });
      } else {
        handleSendCommand("temp_down", { value: newTemp });
      }
    }
  };

  const changeMode = () => {
    if (powerOn) {
      const newIndex = (currentModeIndex + 1) % modes.length;
      setCurrentModeIndex(newIndex);
      const newMode = modes[newIndex].toLowerCase();
      setMode(newMode);
      handleSendCommand("SET_MODE", { value: newMode });
    }
  };

  const toggleFan = () => {
    if (powerOn) {
      const newFan = fan === "auto" ? "high" : "auto";
      setFan(newFan);
      handleSendCommand("SET_FAN_SPEED", { value: newFan });
    }
  };

  const getStatusLine = () => {
    if (powerOn) {
      const modeText = modes[currentModeIndex];
      const fanText = fan === "auto" ? "Auto Fan" : "High Fan";
      const healthText = isHealthOn ? " | Health" : "";
      return `${modeText} | ${fanText}${healthText}`;
    }
    return "Standby";
  };

  if (!selectedDevice) {
    return (
      <div className="remote-body">
        <div className="screen">
          <div className="icon-row">
            <span style={{opacity: 0.2}}>🔒</span>
          </div>
          <div className="temp-text">--°C</div>
          <div>No Device Selected</div>
        </div>
      </div>
    );
  }

  return (
    <div className="remote-body" style={{opacity: powerOn ? '1' : '0.7'}}>
      {/* LCD Screen Area */}
      <div className="screen">
        <div className="icon-row">
          <span style={{color: 'red', display: powerOn ? 'inline' : 'none'}}>⚡</span>
          <span>☁</span>
          <span>↔</span>
          <span style={{opacity: 0.2}}>🔒</span>
        </div>
        <div className="temp-text">
          {powerOn ? `${temp}°C` : '--°C'}
        </div>
        <div>{getStatusLine()}</div>
      </div>

      {/* Buttons Section */}
      <div className="buttons-grid">
        {/* Row 1: Power & Mode */}
        <div className="center-block">
          <button className="button power-btn" onClick={togglePower}>⚫</button>
        </div>
        
        <div className="center-block">
          {/* Blank column for the gap in the middle */}
        </div>

        <div className="center-block">
          <button className="button mode-btn" onClick={changeMode}>Mode</button>
        </div>

        {/* Row 2: Temp Up/Down */}
        <div className="center-block">
          <button className="button arrow-button" onClick={() => adjustTemp(1)}>^</button>
          <span className="text-xs font-semibold">Temp</span>
          <button className="button arrow-button" onClick={() => adjustTemp(-1)}>v</button>
        </div>

        {/* Row 3: Fan/Eco */}
        <div className="center-block">
          <button className="button" onClick={toggleFan}>Fan</button>
          <button className="button" onClick={() => powerOn && handleSendCommand("ECO_MODE")}>Eco</button>
        </div>

        {/* Row 4: Swing/Arrows */}
        <div className="center-block">
          <button className="button" onClick={() => powerOn && handleSendCommand("SWING_TOGGLE")}>Swing</button>
          <button className="button arrow-button" onClick={() => powerOn && handleSendCommand("HORIZONTAL_ADJUST")}>‹ ›</button>
        </div>
        
        {/* Row 5: Sleep/Display/Timer */}
        <button className="button" onClick={() => powerOn && handleSendCommand("SLEEP_MODE")}>Sleep</button>
        <button className="button" onClick={() => powerOn && handleSendCommand("DISPLAY_TOGGLE")}>Display</button>
        <button className="button" onClick={() => powerOn && handleSendCommand("TIMER_SET")}>Timer</button>

        {/* Row 6: Mute/Turbo/I Feel */}
        <button className="button" onClick={() => powerOn && handleSendCommand("MUTE_TOGGLE")}>Mute</button>
        <button className="button" onClick={() => powerOn && handleSendCommand("TURBO_MODE")}>Turbo</button>
        <button className="button" onClick={() => powerOn && handleSendCommand("I_FEEL_MODE")}>I Feel</button>
      </div>

      {/* IR Learning Button */}
      <div className="ir-learning-section">
        <button 
          className="ir-learning-btn"
          onClick={() => {
            console.log('🎛️ Learn Remote button clicked!');
            console.log('🎛️ Current showIRLearning state:', showIRLearning);
            console.log('🎛️ Setting showIRLearning to true...');
            alert('Learn Remote button clicked! Check if modal opens...'); // Visual confirmation
            setShowIRLearning(true);
            
            // Verify state change
            setTimeout(() => {
              console.log('🎛️ showIRLearning after setState (should be true):', showIRLearning);
            }, 50);
            
            // Ensure subscription is active when modal opens
            setTimeout(() => {
              if (selectedDevice) {
                const macWithoutColons = selectedDevice.macAddress.replace(/:/g, '');
                const responseTopic = `devices/${macWithoutColons}/response`;
                console.log('🔧 Ensuring subscription for IR Learning:', responseTopic);
                subscribeToTopic(responseTopic, handleMQTTResponse);
              }
            }, 100);
          }}
          title="Learn IR codes from your AC remote"
        >
          🎛️ Learn Remote {showIRLearning ? '(OPEN)' : '(CLOSED)'}
        </button>
        <button 
          className="debug-btn"
          onClick={() => {
            console.log('🔍 DEBUG: Current device:', selectedDevice);
            if (selectedDevice) {
              const macWithoutColons = selectedDevice.macAddress.replace(/:/g, '');
              const expectedTopic = `devices/${macWithoutColons}/response`;
              console.log('🔍 DEBUG: Expected topic:', expectedTopic);
              console.log('🔍 DEBUG: Current subscriptions:', getSubscriptions());
              getMQTTStatus();
            }
          }}
          style={{fontSize: '12px', padding: '4px 8px', marginLeft: '8px'}}
        >
          🔍 Debug
        </button>
        <br/>
        <button 
          className="test-btn"
          onClick={() => {
            if (selectedDevice) {
              console.log('🧪 Testing ESP32 simulation...');
              simulateESP32Response(selectedDevice.macAddress, 'power_on');
            }
          }}
          style={{fontSize: '12px', padding: '4px 8px', marginTop: '4px'}}
        >
          🧪 Test Sim
        </button>
        <button 
          className="force-sub-btn"
          onClick={() => {
            if (selectedDevice) {
              console.log('🔧 Force subscribing...');
              forceSubscribeToResponseTopic(selectedDevice.macAddress);
            }
          }}
          style={{fontSize: '12px', padding: '4px 8px', marginLeft: '4px'}}
        >
          🔧 Force Sub
        </button>
        <button 
          className="retry-btn"
          onClick={() => {
            if (window.lastIRResponse) {
              console.log('🔄 Manual retry of last IR response:', window.lastIRResponse);
              if (irLearningRef.current && irLearningRef.current.handleLearningResponse) {
                console.log('🎯 Using ref method for manual retry');
                irLearningRef.current.handleLearningResponse(window.lastIRResponse);
              } else if (window.irLearningHandler) {
                console.log('🎯 Using global handler for manual retry');
                window.irLearningHandler(window.lastIRResponse);
              } else {
                console.log('❌ Manual retry failed - Ref:', !!irLearningRef.current, 'Global:', !!window.irLearningHandler);
              }
            } else {
              console.log('❌ No stored IR response to retry');
            }
          }}
          style={{fontSize: '12px', padding: '4px 8px', marginLeft: '4px'}}
        >
          🔄 Retry
        </button>
        <button 
          className="test-ref-btn"
          onClick={() => {
            console.log('🔍 Testing IR Learning Connection...');
            console.log('Modal Open:', showIRLearning);
            console.log('Ref Exists:', !!irLearningRef.current);
            console.log('Global Handler Exists:', !!window.irLearningHandler);
            
            if (irLearningRef.current) {
              console.log('Ref Methods:', Object.keys(irLearningRef.current));
              if (irLearningRef.current.getCurrentState) {
                console.log('Current State via Ref:', irLearningRef.current.getCurrentState());
              }
              if (irLearningRef.current.testMethod) {
                irLearningRef.current.testMethod();
              }
            }
            
            if (window.irLearningHandler) {
              console.log('🧪 Testing global handler with dummy data...');
              const testData = {
                type: "ir_learning_response",
                success: true,
                ir_command: "power_on",
                ir_code: "0xTEST123",
                protocol: "NEC"
              };
              try {
                window.irLearningHandler(testData);
                console.log('✅ Global handler test successful');
              } catch (error) {
                console.error('❌ Global handler test failed:', error);
              }
            }
          }}
          style={{fontSize: '12px', padding: '4px 8px', marginLeft: '4px'}}
        >
          🔍 Test All
        </button>
        {irLearningEnabled && (
          <div className="ir-status">
            ✅ IR Codes Available
          </div>
        )}
      </div>

      {/* Debug State Display */}
      <div style={{fontSize: '10px', color: '#666', marginTop: '8px'}}>
        Debug: Modal={showIRLearning.toString()}, Device={!!selectedDevice}
      </div>

      {/* IR Learning Modal */}
      {showIRLearning && (
        <IRCodeLearning
          ref={irLearningRef}
          selectedDevice={selectedDevice}
          onClose={() => {
            console.log('🎛️ IR Learning modal closing...');
            setShowIRLearning(false);
            loadDeviceIRCodes(); // Reload codes after learning
          }}
        />
      )}
    </div>
  );
}