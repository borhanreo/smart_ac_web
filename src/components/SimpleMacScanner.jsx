import React, { useState } from 'react';

const SimpleMacScanner = ({ onScanSuccess, onClose, isOpen }) => {
  const [inputMethod, setInputMethod] = useState('manual'); // 'manual', 'file', 'camera'
  const [manualInput, setManualInput] = useState('');
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  // Extract MAC address from text
  const extractMacAddress = (text) => {
    const macPatterns = [
      // Standard format: XX:XX:XX:XX:XX:XX
      /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/g,
      // No separators: XXXXXXXXXXXX
      /\b([0-9A-Fa-f]{12})\b/g,
      // Dot separated: XXXX.XXXX.XXXX
      /([0-9A-Fa-f]{4}\.){2}([0-9A-Fa-f]{4})/g
    ];

    for (const pattern of macPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (let match of matches) {
          let mac = match;
          
          // Convert to standard format XX:XX:XX:XX:XX:XX
          if (mac.length === 12 && !mac.includes(':') && !mac.includes('-')) {
            mac = mac.match(/.{2}/g).join(':');
          } else if (mac.includes('.')) {
            mac = mac.replace(/\./g, '').match(/.{2}/g).join(':');
          }
          
          // Validate the extracted MAC
          const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
          if (macRegex.test(mac)) {
            return mac.toUpperCase();
          }
        }
      }
    }
    return null;
  };

  // Handle manual input submission
  const handleManualSubmit = () => {
    if (!manualInput.trim()) {
      setError('Please enter a MAC address');
      return;
    }

    const extractedMac = extractMacAddress(manualInput);
    if (extractedMac) {
      onScanSuccess(extractedMac);
      handleClose();
    } else {
      setError('No valid MAC address found. Please check the format (XX:XX:XX:XX:XX:XX)');
    }
  };

  // Handle file input (image upload)
  const handleFileInput = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setProcessing(true);
    setError('');

    try {
      // For demonstration - in a real app, you'd use an OCR service
      // This is a simplified version that asks user to enter what they see
      const reader = new FileReader();
      reader.onload = () => {
        // Show preview and ask for manual input
        setInputMethod('file-manual');
        setProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to process image. Please try manual input.');
      setProcessing(false);
    }
  };

  // Handle camera input (using device camera)
  const handleCameraInput = async () => {
    try {
      setError('');
      
      // Check if device supports camera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported on this device');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // For now, redirect to manual input after showing camera
      // In a full implementation, you'd implement barcode detection here
      setInputMethod('camera-manual');
      
      // Stop the stream for now
      stream.getTracks().forEach(track => track.stop());
      
    } catch (err) {
      setError('Camera access denied or not available. Please use manual input.');
    }
  };

  const handleClose = () => {
    setInputMethod('manual');
    setManualInput('');
    setError('');
    setProcessing(false);
    onClose();
  };

  const validateMacFormat = (mac) => {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  };

  const formatMacAddress = (input) => {
    // Remove all non-alphanumeric characters
    const cleaned = input.replace(/[^0-9A-Fa-f]/g, '');
    
    // If 12 characters, format as XX:XX:XX:XX:XX:XX
    if (cleaned.length === 12) {
      return cleaned.match(/.{2}/g).join(':').toUpperCase();
    }
    
    return input.toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <div className="scanner-modal-overlay">
      <div className="scanner-modal-content">
        <div className="scanner-header">
          <h3>📱 Enter MAC Address</h3>
          <button onClick={handleClose} className="close-btn">✕</button>
        </div>

        <div className="scanner-body">
          {error && <div className="error-message">{error}</div>}

          {inputMethod === 'manual' && (
            <div className="input-method-selection">
              <h4>Choose input method:</h4>
              
              <div className="method-buttons">
                <button 
                  className="method-btn manual-btn active"
                  onClick={() => setInputMethod('manual')}
                >
                  ⌨️ Type Manually
                </button>
                
                <button 
                  className="method-btn file-btn"
                  onClick={() => document.getElementById('file-input').click()}
                >
                  📁 Upload Image
                </button>
                
                <button 
                  className="method-btn camera-btn"
                  onClick={handleCameraInput}
                >
                  📷 Use Camera
                </button>
              </div>

              <input
                id="file-input"
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />

              <div className="manual-input-section">
                <label>MAC Address:</label>
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => {
                    setError('');
                    setManualInput(e.target.value);
                  }}
                  onBlur={(e) => {
                    // Auto-format on blur
                    const formatted = formatMacAddress(e.target.value);
                    setManualInput(formatted);
                  }}
                  placeholder="XX:XX:XX:XX:XX:XX or XXXXXXXXXXXX"
                  className="mac-input-field"
                />
                
                <div className="format-help">
                  <small>
                    Supported formats: XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX, XXXXXXXXXXXX
                  </small>
                </div>

                <div className="submit-section">
                  <button 
                    onClick={handleManualSubmit}
                    className="submit-mac-btn"
                    disabled={!manualInput.trim()}
                  >
                    Use This MAC Address
                  </button>
                </div>
              </div>
            </div>
          )}

          {(inputMethod === 'file-manual' || inputMethod === 'camera-manual') && (
            <div className="post-capture-input">
              <h4>
                {inputMethod === 'file-manual' ? '📁 Image uploaded' : '📷 Camera ready'}
              </h4>
              <p>Please type the MAC address you can see:</p>
              
              <input
                type="text"
                value={manualInput}
                onChange={(e) => {
                  setError('');
                  setManualInput(e.target.value);
                }}
                onBlur={(e) => {
                  const formatted = formatMacAddress(e.target.value);
                  setManualInput(formatted);
                }}
                placeholder="Type the MAC address from the image/camera"
                className="mac-input-field"
                autoFocus
              />

              <div className="post-capture-buttons">
                <button 
                  onClick={() => setInputMethod('manual')}
                  className="back-btn"
                >
                  ← Back
                </button>
                <button 
                  onClick={handleManualSubmit}
                  className="submit-mac-btn"
                  disabled={!manualInput.trim()}
                >
                  Use This MAC
                </button>
              </div>
            </div>
          )}

          {processing && (
            <div className="processing">
              <p>🔄 Processing image...</p>
            </div>
          )}

          <div className="help-section">
            <h4>📋 How to find your ESP32 MAC address:</h4>
            <ol>
              <li>Connect ESP32 to computer via USB</li>
              <li>Upload this code to Serial Monitor:</li>
            </ol>
            <pre className="code-example">
{`#include "WiFi.h"
void setup() {
  Serial.begin(115200);
  Serial.println(WiFi.macAddress());
}
void loop() {}`}
            </pre>
            <p><strong>Common locations:</strong></p>
            <ul>
              <li>Printed on the ESP32 board</li>
              <li>On device packaging/label</li>
              <li>In device settings/info screen</li>
              <li>QR code on device or manual</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleMacScanner;