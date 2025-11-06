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

// Check if device MAC address is already registered by any user
export const checkDeviceExists = async (macAddress) => {
  try {
    const q = query(
      collection(db, DEVICES_COLLECTION),
      where('macAddress', '==', macAddress)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking device existence:', error);
    return false;
  }
};