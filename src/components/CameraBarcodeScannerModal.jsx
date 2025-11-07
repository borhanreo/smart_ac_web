import React, { useState, useRef } from 'react';

// Try to import Scanner, fallback to null if not available
let Scanner = null;
try {
  Scanner = require('@yudiel/react-qr-scanner').Scanner;
} catch (e) {
  console.warn('Scanner library not available:', e);
}

const CameraBarcodeScannerModal = ({ isOpen, onScanSuccess, onClose }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');

  // Extract MAC address from scanned text
  const extractMacAddress = (text) => {
    console.log('Scanned text:', text);
    
    // Common MAC address patterns
    const macPatterns = [
      // Standard format: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
      /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/g,
      // No separators: XXXXXXXXXXXX (12 hex digits)
      /\b([0-9A-Fa-f]{12})\b/g,
      // Dot separated: XXXX.XXXX.XXXX
      /([0-9A-Fa-f]{4}\.){2}([0-9A-Fa-f]{4})/g,
      // With spaces: XX XX XX XX XX XX
      /([0-9A-Fa-f]{2}\s){5}([0-9A-Fa-f]{2})/g
    ];

    for (const pattern of macPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        for (let match of matches) {
          let mac = match.trim();
          
          // Convert to standard format XX:XX:XX:XX:XX:XX
          if (mac.length === 12 && !mac.includes(':') && !mac.includes('-')) {
            // XXXXXXXXXXXX -> XX:XX:XX:XX:XX:XX
            mac = mac.match(/.{2}/g).join(':');
          } else if (mac.includes('.')) {
            // XXXX.XXXX.XXXX -> XX:XX:XX:XX:XX:XX
            mac = mac.replace(/\./g, '').match(/.{2}/g).join(':');
          } else if (mac.includes(' ')) {
            // XX XX XX XX XX XX -> XX:XX:XX:XX:XX:XX
            mac = mac.replace(/\s/g, ':');
          } else if (mac.includes('-')) {
            // XX-XX-XX-XX-XX-XX -> XX:XX:XX:XX:XX:XX
            mac = mac.replace(/-/g, ':');
          }
          
          // Validate the final MAC format
          const macRegex = /^([0-9A-Fa-f]{2}:){5}([0-9A-Fa-f]{2})$/;
          if (macRegex.test(mac)) {
            return mac.toUpperCase();
          }
        }
      }
    }
    return null;
  };

  const handleScanResult = (result) => {
    if (result && result.length > 0) {
      console.log('Scanner result:', result);
      
      // Get the first result
      const firstResult = result[0];
      let scannedText = '';
      
      if (typeof firstResult === 'string') {
        scannedText = firstResult;
      } else if (firstResult.rawValue) {
        scannedText = firstResult.rawValue;
      } else if (firstResult.text) {
        scannedText = firstResult.text;
      } else if (firstResult.data) {
        scannedText = firstResult.data;
      }

      const macAddress = extractMacAddress(scannedText);
      
      if (macAddress) {
        console.log('Extracted MAC:', macAddress);
        onScanSuccess(macAddress);
        handleClose();
      } else {
        setError(`Scanned: "${scannedText}" - No valid MAC address found. Please try again or enter manually.`);
        setTimeout(() => setError(''), 5000);
      }
    }
  };

  const handleScanError = (error) => {
    console.error('Scan error:', error);
    if (error?.message?.includes('NotAllowedError') || error?.message?.includes('permission')) {
      setError('Camera permission denied. Please allow camera access in your browser settings.');
    } else if (error?.message?.includes('NotFoundError')) {
      setError('No camera found. Please ensure your device has a camera.');
    } else {
      setError('Camera error occurred. Please try manual input.');
    }
  };

  const startScanning = () => {
    setError('');
    setScanning(true);
  };

  const stopScanning = () => {
    setScanning(false);
    setError('');
  };

  const handleClose = () => {
    setScanning(false);
    setManualMode(false);
    setManualInput('');
    setError('');
    onClose();
  };

  const handleManualSubmit = () => {
    const extractedMac = extractMacAddress(manualInput);
    if (extractedMac) {
      onScanSuccess(extractedMac);
      handleClose();
    } else {
      setError('Please enter a valid MAC address format (XX:XX:XX:XX:XX:XX)');
    }
  };

  const formatMacInput = (input) => {
    // Auto-format as user types
    const cleaned = input.replace(/[^0-9A-Fa-f]/g, '');
    if (cleaned.length <= 12) {
      const formatted = cleaned.match(/.{1,2}/g)?.join(':') || cleaned;
      return formatted.toUpperCase();
    }
    return input;
  };

  if (!isOpen) return null;

  return (
    <div className="camera-scanner-overlay">
      <div className="camera-scanner-modal">
        <div className="scanner-header">
          <h3>📷 Scan MAC Address</h3>
          <button onClick={handleClose} className="close-btn">×</button>
        </div>

        <div className="scanner-content">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {!scanning && !manualMode && (
            <div className="scanner-start-screen">
              <div className="scanner-instructions">
                <h4>📱 How to scan:</h4>
                <ul>
                  <li>Point camera at QR code or barcode containing MAC address</li>
                  <li>Ensure good lighting and steady hand</li>
                  <li>MAC address formats: XX:XX:XX:XX:XX:XX, XXXXXXXXXXXX</li>
                </ul>
              </div>
              
              <div className="scanner-buttons">
                <button onClick={startScanning} className="start-camera-btn">
                  📹 Start Camera
                </button>
                <button onClick={() => setManualMode(true)} className="manual-btn">
                  ⌨️ Enter Manually
                </button>
              </div>
            </div>
          )}

          {scanning && (
            <div className="camera-scanner-container">
              <div className="scanner-viewfinder">
                {Scanner ? (
                  <Scanner
                    onScan={handleScanResult}
                    onError={handleScanError}
                    constraints={{
                      facingMode: 'environment', // Use back camera
                      width: 640,
                      height: 480
                    }}
                    styles={{
                      container: {
                        width: '100%',
                        height: '300px'
                      },
                      video: {
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }
                    }}
                  />
                ) : (
                  <div className="scanner-fallback">
                    <p>Camera scanner not available. Please use manual input.</p>
                    <button onClick={() => { stopScanning(); setManualMode(true); }} className="fallback-manual-btn">
                      Switch to Manual Input
                    </button>
                  </div>
                )}
                
                <div className="scanner-overlay">
                  <div className="scan-area">
                    <div className="scan-corners"></div>
                    <p>Position barcode/QR code here</p>
                  </div>
                </div>
              </div>

              <div className="scanner-controls">
                <button onClick={stopScanning} className="stop-btn">
                  ⏹️ Stop Camera
                </button>
                <button onClick={() => { stopScanning(); setManualMode(true); }} className="switch-manual-btn">
                  ⌨️ Switch to Manual
                </button>
              </div>
            </div>
          )}

          {manualMode && (
            <div className="manual-input-section">
              <h4>✏️ Enter MAC Address Manually</h4>
              <p>Type or paste the MAC address from your device:</p>
              
              <input
                type="text"
                value={manualInput}
                onChange={(e) => {
                  const formatted = formatMacInput(e.target.value);
                  setManualInput(formatted);
                  setError('');
                }}
                placeholder="XX:XX:XX:XX:XX:XX"
                className="manual-mac-input"
                maxLength="17"
                autoFocus
              />
              
              <div className="manual-buttons">
                <button 
                  onClick={() => { setManualMode(false); setManualInput(''); }}
                  className="back-btn"
                >
                  ← Back to Scanner
                </button>
                <button 
                  onClick={handleManualSubmit}
                  className="submit-btn"
                  disabled={!manualInput.trim()}
                >
                  Use This MAC
                </button>
              </div>
            </div>
          )}

          <div className="help-info">
            <details>
              <summary>🔍 Need help finding MAC address?</summary>
              <div className="help-content">
                <p><strong>Common locations:</strong></p>
                <ul>
                  <li>Printed on device label/sticker</li>
                  <li>Device packaging or manual</li>
                  <li>QR code on device or box</li>
                  <li>Serial monitor output from ESP32</li>
                </ul>
                <p><strong>ESP32 Code to get MAC:</strong></p>
                <pre>{`#include "WiFi.h"
void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_MODE_STA);
  Serial.println(WiFi.macAddress());
}
void loop() {}`}</pre>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraBarcodeScannerModal;