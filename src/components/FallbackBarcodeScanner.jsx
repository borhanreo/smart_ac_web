import React, { useState, useRef, useEffect } from 'react';

const FallbackBarcodeScanner = ({ isOpen, onScanSuccess, onClose }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const videoRef = useRef(null);

  // Extract MAC address from text
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
            mac = mac.match(/.{2}/g).join(':');
          } else if (mac.includes('.')) {
            mac = mac.replace(/\./g, '').match(/.{2}/g).join(':');
          } else if (mac.includes(' ')) {
            mac = mac.replace(/\s/g, ':');
          } else if (mac.includes('-')) {
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

  // Start camera
  const startCamera = async () => {
    try {
      setError('');
      setScanning(true);

      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      // Start barcode detection if available, otherwise show capture instructions
      if ('BarcodeDetector' in window) {
        startBarcodeDetection();
      } else {
        // Don't show error immediately, let user know they can capture manually
        console.log('BarcodeDetector not supported, using manual capture mode');
      }

    } catch (err) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Camera access failed. Please try manual input.');
      }
      setScanning(false);
    }
  };

  // Start barcode detection using native API
  const startBarcodeDetection = async () => {
    if (!('BarcodeDetector' in window)) {
      return;
    }

    try {
      const barcodeDetector = new window.BarcodeDetector({
        formats: ['qr_code', 'code_128', 'code_39', 'code_93', 'ean_13', 'ean_8']
      });

      const detectLoop = async () => {
        if (videoRef.current && scanning) {
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const scannedText = barcodes[0].rawValue;
              const macAddress = extractMacAddress(scannedText);
              
              if (macAddress) {
                onScanSuccess(macAddress);
                handleClose();
                return;
              }
            }
          } catch (detectionError) {
            console.warn('Detection error:', detectionError);
          }
        }

        if (scanning) {
          requestAnimationFrame(detectLoop);
        }
      };

      detectLoop();
    } catch (err) {
      console.error('BarcodeDetector error:', err);
      setError('Barcode detection failed. Please capture image manually.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  // Capture image for manual processing
  const captureImage = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    context.drawImage(videoRef.current, 0, 0);
    
    // Convert to data URL for preview
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageDataUrl);
    
    stopCamera();
    setManualMode(true);
    setError(''); // Clear any previous errors
  };

  // Handle close
  const handleClose = () => {
    stopCamera();
    setManualMode(false);
    setManualInput('');
    setCapturedImage(null);
    setError('');
    onClose();
  };

  // Handle manual submit
  const handleManualSubmit = () => {
    const extractedMac = extractMacAddress(manualInput);
    if (extractedMac) {
      onScanSuccess(extractedMac);
      handleClose();
    } else {
      setError('Please enter a valid MAC address format (XX:XX:XX:XX:XX:XX)');
    }
  };

  // Format MAC input
  const formatMacInput = (input) => {
    const cleaned = input.replace(/[^0-9A-Fa-f]/g, '');
    if (cleaned.length <= 12) {
      const formatted = cleaned.match(/.{1,2}/g)?.join(':') || cleaned;
      return formatted.toUpperCase();
    }
    return input;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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
                {('BarcodeDetector' in window) ? (
                  <ul>
                    <li>Point camera at barcode/QR code with MAC address</li>
                    <li>System will automatically detect and extract MAC</li>
                    <li>Ensure good lighting and hold steady</li>
                    <li>Use capture button if auto-detection doesn't work</li>
                  </ul>
                ) : (
                  <ul>
                    <li><strong>Manual Capture Mode:</strong> Your browser doesn't support automatic detection</li>
                    <li>Point camera at MAC address (barcode, QR code, or label)</li>
                    <li>Click "Capture & Enter MAC" to take a photo</li>
                    <li>Type the MAC address from the captured image</li>
                  </ul>
                )}
              </div>
              
              <div className="scanner-buttons">
                <button onClick={startCamera} className="start-camera-btn">
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
              {!('BarcodeDetector' in window) && (
                <div className="capture-instructions">
                  <p>📸 <strong>Capture Mode:</strong> Position the MAC address in view and click "Capture Image" below</p>
                </div>
              )}
              
              <div className="scanner-viewfinder">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '300px',
                    objectFit: 'cover',
                    borderRadius: '8px'
                  }}
                />
                
                <div className="scanner-overlay">
                  <div className="scan-area">
                    <div className="scan-corners"></div>
                    <p>
                      {('BarcodeDetector' in window) 
                        ? 'Position barcode/QR code or MAC label here' 
                        : 'Position MAC address here, then capture'
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="scanner-controls">
                <button onClick={captureImage} className="capture-btn primary-action">
                  📸 Capture & Enter MAC
                </button>
                <button onClick={stopCamera} className="stop-btn">
                  ⏹️ Stop Camera
                </button>
                <button onClick={() => { stopCamera(); setManualMode(true); }} className="switch-manual-btn">
                  ⌨️ Skip Camera
                </button>
              </div>
            </div>
          )}

          {manualMode && (
            <div className="manual-input-section">
              <h4>✏️ Enter MAC Address</h4>
              
              {capturedImage ? (
                <div className="captured-image-section">
                  <p>📸 Captured image - please type the MAC address you can see:</p>
                  <div className="image-preview">
                    <img 
                      src={capturedImage} 
                      alt="Captured MAC address" 
                      style={{
                        maxWidth: '100%',
                        maxHeight: '200px',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        marginBottom: '1rem'
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p>Type the MAC address from the barcode, QR code, or device label:</p>
              )}
              
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
              
              <div className="format-examples">
                <small>
                  <strong>Accepted formats:</strong> XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX, XXXXXXXXXXXX
                </small>
              </div>
              
              <div className="manual-buttons">
                <button 
                  onClick={() => { 
                    setManualMode(false); 
                    setManualInput(''); 
                    setCapturedImage(null);
                  }}
                  className="back-btn"
                >
                  ← Back to Camera
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
                <p><strong>Where to look:</strong></p>
                <ul>
                  <li>Device label or sticker on ESP32 board</li>
                  <li>Packaging box or documentation</li>
                  <li>QR code on device or manual</li>
                  <li>Serial monitor output (see code below)</li>
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

export default FallbackBarcodeScanner;