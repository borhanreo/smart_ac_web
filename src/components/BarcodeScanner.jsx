import React, { useState, useRef, useEffect } from 'react';

const BarcodeScanner = ({ onScanSuccess, onClose, isOpen }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Check for camera support
  const checkCameraSupport = () => {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  };

  // Start camera for scanning
  const startCamera = async () => {
    if (!checkCameraSupport()) {
      setError('Camera not supported on this device. Please use manual input.');
      return;
    }

    try {
      setError('');
      setScanning(true);
      
      // Get user media (camera)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      // Start barcode detection
      startBarcodeDetection();
      
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Camera access denied. Please enable camera permissions and try again, or use manual input.');
      setScanning(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  // Barcode detection using BarcodeDetector API (if available)
  const startBarcodeDetection = async () => {
    if (!('BarcodeDetector' in window)) {
      // Fallback to manual capture if BarcodeDetector is not available
      setError('Barcode detection not supported. Please use manual capture or type manually.');
      return;
    }

    try {
      const barcodeDetector = new window.BarcodeDetector({
        formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8']
      });

      const detectBarcodes = async () => {
        if (videoRef.current && scanning) {
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const scannedText = barcodes[0].rawValue;
              
              // Extract MAC address from scanned text
              const macAddress = extractMacAddress(scannedText);
              if (macAddress) {
                onScanSuccess(macAddress);
                handleClose();
              } else {
                setError('No valid MAC address found in scanned code. Please try again.');
              }
            }
          } catch (err) {
            console.error('Barcode detection error:', err);
          }
        }
        
        // Continue scanning
        if (scanning) {
          requestAnimationFrame(detectBarcodes);
        }
      };

      detectBarcodes();
    } catch (err) {
      setError('Barcode detection failed. Please try manual capture.');
    }
  };

  // Extract MAC address from scanned text
  const extractMacAddress = (text) => {
    // Common MAC address patterns
    const macPatterns = [
      // Standard format: XX:XX:XX:XX:XX:XX
      /([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/,
      // No separators: XXXXXXXXXXXX
      /([0-9A-Fa-f]{12})/,
      // Dot separated: XXXX.XXXX.XXXX
      /([0-9A-Fa-f]{4}\.){2}([0-9A-Fa-f]{4})/
    ];

    for (const pattern of macPatterns) {
      const match = text.match(pattern);
      if (match) {
        let mac = match[0];
        
        // Convert to standard format XX:XX:XX:XX:XX:XX
        if (mac.length === 12 && !mac.includes(':') && !mac.includes('-')) {
          // XXXXXXXXXXXX -> XX:XX:XX:XX:XX:XX
          mac = mac.match(/.{2}/g).join(':');
        } else if (mac.includes('.')) {
          // XXXX.XXXX.XXXX -> XX:XX:XX:XX:XX:XX
          mac = mac.replace(/\./g, '').match(/.{2}/g).join(':');
        }
        
        return mac.toUpperCase();
      }
    }
    return null;
  };

  // Manual capture from video
  const captureImage = async () => {
    if (!videoRef.current) return;

    try {
      // Create canvas to capture image
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      
      // Draw video frame to canvas
      context.drawImage(videoRef.current, 0, 0);
      
      // Convert to blob for processing
      canvas.toBlob(async (blob) => {
        // Here you could send to an OCR service or barcode reading service
        // For now, we'll show a message to manually enter
        setError('Image captured. Please manually enter the MAC address from the image.');
        setManualMode(true);
      });
      
    } catch (err) {
      setError('Failed to capture image. Please try again.');
    }
  };

  const handleClose = () => {
    stopCamera();
    setError('');
    setManualMode(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="scanner-modal-overlay">
      <div className="scanner-modal-content">
        <div className="scanner-header">
          <h3>📷 Scan MAC Address</h3>
          <button onClick={handleClose} className="close-btn">✕</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {!scanning && !manualMode && (
          <div className="scanner-start">
            <p>Choose scanning method:</p>
            <div className="scanner-buttons">
              <button onClick={startCamera} className="start-camera-btn">
                📹 Start Camera Scan
              </button>
              <button onClick={() => setManualMode(true)} className="manual-input-btn">
                ⌨️ Manual Input
              </button>
            </div>
            <div className="scanner-help">
              <h4>Supported formats:</h4>
              <ul>
                <li>QR codes containing MAC addresses</li>
                <li>Barcodes with MAC addresses</li>
                <li>Format: XX:XX:XX:XX:XX:XX</li>
                <li>Format: XXXXXXXXXXXX</li>
                <li>Format: XXXX.XXXX.XXXX</li>
              </ul>
            </div>
          </div>
        )}

        {scanning && (
          <div className="scanner-camera">
            <video
              ref={videoRef}
              className="scanner-video"
              autoPlay
              playsInline
              muted
            />
            <div className="scanner-overlay">
              <div className="scan-frame"></div>
              <p>Position the barcode/QR code within the frame</p>
            </div>
            <div className="scanner-controls">
              <button onClick={captureImage} className="capture-btn">
                📸 Manual Capture
              </button>
              <button onClick={stopCamera} className="stop-btn">
                ⏹️ Stop Scanning
              </button>
            </div>
          </div>
        )}

        {manualMode && (
          <div className="manual-input-mode">
            <h4>Manual MAC Address Input</h4>
            <p>Please enter the MAC address you saw in the code:</p>
            <ManualMacInput onSubmit={onScanSuccess} onCancel={() => setManualMode(false)} />
          </div>
        )}
      </div>
    </div>
  );
};

// Manual MAC input component
const ManualMacInput = ({ onSubmit, onCancel }) => {
  const [macValue, setMacValue] = useState('');
  const [error, setError] = useState('');

  const validateAndSubmit = () => {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macValue)) {
      setError('Please enter a valid MAC address (XX:XX:XX:XX:XX:XX)');
      return;
    }
    onSubmit(macValue.toUpperCase());
  };

  return (
    <div className="manual-mac-input">
      {error && <div className="error-message">{error}</div>}
      <input
        type="text"
        value={macValue}
        onChange={(e) => {
          setMacValue(e.target.value);
          setError('');
        }}
        placeholder="XX:XX:XX:XX:XX:XX"
        className="mac-manual-input"
      />
      <div className="manual-input-buttons">
        <button onClick={onCancel} className="cancel-btn">Cancel</button>
        <button onClick={validateAndSubmit} className="submit-btn">Use This MAC</button>
      </div>
    </div>
  );
};

export default BarcodeScanner;