import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

// Collection name for devices
const DEVICES_COLLECTION = 'devices';

// Add a new device for a user
export const registerDevice = async (userId, deviceData) => {
  try {
    const deviceDoc = {
      ...deviceData,
      userId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
      lastSeen: null
    };
    
    const docRef = await addDoc(collection(db, DEVICES_COLLECTION), deviceDoc);
    return { success: true, deviceId: docRef.id };
  } catch (error) {
    console.error('Error registering device:', error);
    return { success: false, error: error.message };
  }
};

// Get all devices for a specific user
export const getUserDevices = async (userId) => {
  try {
    const q = query(
      collection(db, DEVICES_COLLECTION),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const devices = [];
    
    querySnapshot.forEach((doc) => {
      devices.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, devices };
  } catch (error) {
    console.error('Error fetching user devices:', error);
    return { success: false, error: error.message };
  }
};

// Update device information
export const updateDevice = async (deviceId, updates) => {
  try {
    const deviceRef = doc(db, DEVICES_COLLECTION, deviceId);
    await updateDoc(deviceRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating device:', error);
    return { success: false, error: error.message };
  }
};

// Delete a device
export const deleteDevice = async (deviceId) => {
  try {
    await deleteDoc(doc(db, DEVICES_COLLECTION, deviceId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting device:', error);
    return { success: false, error: error.message };
  }
};

// Update device last seen timestamp
export const updateDeviceLastSeen = async (deviceId) => {
  try {
    const deviceRef = doc(db, DEVICES_COLLECTION, deviceId);
    await updateDoc(deviceRef, {
      lastSeen: serverTimestamp(),
      isActive: true
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating device last seen:', error);
    return { success: false, error: error.message };
  }
};

// Update device online status by MAC address
export const updateDeviceStatusByMAC = async (macAddress, isOnline) => {
  try {
    const q = query(
      collection(db, DEVICES_COLLECTION),
      where('macAddress', '==', macAddress.toUpperCase())
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const deviceDoc = querySnapshot.docs[0];
      const deviceRef = doc(db, DEVICES_COLLECTION, deviceDoc.id);
      
      await updateDoc(deviceRef, {
        isActive: isOnline,
        lastSeen: serverTimestamp(),
        connectionStatus: isOnline ? 'online' : 'offline',
        lastStatusChange: serverTimestamp()
      });
      
      return { success: true, deviceId: deviceDoc.id };
    }
    
    return { success: false, error: 'Device not found' };
  } catch (error) {
    console.error('Error updating device status:', error);
    return { success: false, error: error.message };
  }
};

// Mark device as offline
export const markDeviceOffline = async (deviceId) => {
  try {
    const deviceRef = doc(db, DEVICES_COLLECTION, deviceId);
    await updateDoc(deviceRef, {
      isActive: false,
      connectionStatus: 'offline',
      lastStatusChange: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error marking device offline:', error);
    return { success: false, error: error.message };
  }
};

// Get device by MAC address (for status updates)
export const getDeviceByMAC = async (macAddress) => {
  try {
    const q = query(
      collection(db, DEVICES_COLLECTION),
      where('macAddress', '==', macAddress.toUpperCase())
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const deviceDoc = querySnapshot.docs[0];
      return {
        success: true,
        device: {
          id: deviceDoc.id,
          ...deviceDoc.data()
        }
      };
    }
    
    return { success: false, error: 'Device not found' };
  } catch (error) {
    console.error('Error getting device by MAC:', error);
    return { success: false, error: error.message };
  }
};

// Check if device MAC address is already registered by any user
export const checkDeviceExists = async (macAddress) => {
  try {
    const q = query(
      collection(db, DEVICES_COLLECTION),
      where('macAddress', '==', macAddress.toUpperCase())
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking device existence:', error);
    return false;
  }
};

// Get detailed information about existing device (without exposing sensitive user data)
export const getDeviceInfo = async (macAddress) => {
  try {
    const q = query(
      collection(db, DEVICES_COLLECTION),
      where('macAddress', '==', macAddress.toUpperCase())
    );
    
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return { exists: false };
    }
    
    const deviceDoc = querySnapshot.docs[0];
    const deviceData = deviceDoc.data();
    
    // Return limited info for privacy
    return {
      exists: true,
      deviceType: deviceData.deviceType,
      registeredAt: deviceData.createdAt,
      isActive: deviceData.isActive,
      // Don't return userId or other sensitive info
    };
  } catch (error) {
    console.error('Error getting device info:', error);
    return { exists: false, error: error.message };
  }
};

// Handle automatic device registration/update from 5-second status messages
export const handleDeviceStatusMessage = async (statusData) => {
  try {
    const { macAddress, deviceType, location, status } = statusData;
    
    if (!macAddress) {
      return { success: false, error: 'No MAC address provided' };
    }

    // Check if device exists
    const existingDevice = await getDeviceByMAC(macAddress);
    
    if (existingDevice.success && existingDevice.device) {
      // Device exists, update its status
      const result = await updateDeviceStatusByMAC(macAddress, status === 'online');
      return {
        success: true,
        action: 'updated',
        deviceId: existingDevice.device.id,
        message: `Device ${macAddress} status updated to ${status}`
      };
    } else {
      // Device doesn't exist, log for potential auto-registration
      console.log(`📱 New device detected: ${macAddress} (${deviceType || 'Unknown'}) - Status: ${status}`);
      
      // For security, we don't auto-register devices
      // Admin/user needs to manually register them
      return {
        success: false,
        action: 'detected',
        message: `New device detected but not registered: ${macAddress}`,
        deviceData: statusData
      };
    }
  } catch (error) {
    console.error('Error handling device status message:', error);
    return { success: false, error: error.message };
  }
};