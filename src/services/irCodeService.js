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

// Collection name for IR codes
const IR_CODES_COLLECTION = 'irCodes';

// AC Brands list
export const AC_BRANDS = [
  'LG',
  'Samsung',
  'Daikin',
  'Mitsubishi',
  'Panasonic',
  'Carrier',
  'Toshiba',
  'Fujitsu',
  'Hitachi',
  'Sharp',
  'Gree',
  'Midea',
  'Haier',
  'TCL',
  'Voltas',
  'Blue Star',
  'Other'
];

// IR Command types for AC
export const IR_COMMANDS = {
  POWER_ON: 'power_on',
  POWER_OFF: 'power_off',
  POWER_TOGGLE: 'power_toggle',
  TEMP_UP: 'temp_up',
  TEMP_DOWN: 'temp_down',
  MODE_COOL: 'mode_cool',
  MODE_HEAT: 'mode_heat',
  MODE_FAN: 'mode_fan',
  MODE_DRY: 'mode_dry',
  MODE_AUTO: 'mode_auto',
  FAN_LOW: 'fan_low',
  FAN_MED: 'fan_med',
  FAN_HIGH: 'fan_high',
  FAN_AUTO: 'fan_auto',
  SWING_ON: 'swing_on',
  SWING_OFF: 'swing_off',
  TIMER: 'timer',
  SLEEP: 'sleep'
};

// Command labels for UI
export const COMMAND_LABELS = {
  [IR_COMMANDS.POWER_ON]: '⚡ Power On',
  [IR_COMMANDS.POWER_OFF]: '⭕ Power Off',
  [IR_COMMANDS.POWER_TOGGLE]: '🔄 Power Toggle',
  [IR_COMMANDS.TEMP_UP]: '🌡️ Temperature Up',
  [IR_COMMANDS.TEMP_DOWN]: '🌡️ Temperature Down',
  [IR_COMMANDS.MODE_COOL]: '❄️ Cool Mode',
  [IR_COMMANDS.MODE_HEAT]: '🔥 Heat Mode',
  [IR_COMMANDS.MODE_FAN]: '🌪️ Fan Mode',
  [IR_COMMANDS.MODE_DRY]: '💨 Dry Mode',
  [IR_COMMANDS.MODE_AUTO]: '🤖 Auto Mode',
  [IR_COMMANDS.FAN_LOW]: '💨 Fan Low',
  [IR_COMMANDS.FAN_MED]: '💨 Fan Medium',
  [IR_COMMANDS.FAN_HIGH]: '💨 Fan High',
  [IR_COMMANDS.FAN_AUTO]: '🤖 Fan Auto',
  [IR_COMMANDS.SWING_ON]: '↔️ Swing On',
  [IR_COMMANDS.SWING_OFF]: '↔️ Swing Off',
  [IR_COMMANDS.TIMER]: '⏰ Timer',
  [IR_COMMANDS.SLEEP]: '😴 Sleep'
};

// Save IR code for a device
export const saveIRCode = async (deviceId, macAddress, brand, command, irCode, protocol = 'NEC') => {
  try {
    const irCodeDoc = {
      deviceId,
      macAddress: macAddress.toUpperCase(),
      brand,
      command,
      irCode,
      protocol,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, IR_CODES_COLLECTION), irCodeDoc);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error saving IR code:', error);
    return { success: false, error: error.message };
  }
};

// Get IR codes for a device
export const getDeviceIRCodes = async (deviceId) => {
  try {
    const q = query(
      collection(db, IR_CODES_COLLECTION),
      where('deviceId', '==', deviceId)
    );
    
    const querySnapshot = await getDocs(q);
    const irCodes = [];
    
    querySnapshot.forEach((doc) => {
      irCodes.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, irCodes };
  } catch (error) {
    console.error('Error getting IR codes:', error);
    return { success: false, error: error.message, irCodes: [] };
  }
};

// Get IR codes by brand
export const getIRCodesByBrand = async (brand) => {
  try {
    const q = query(
      collection(db, IR_CODES_COLLECTION),
      where('brand', '==', brand)
    );
    
    const querySnapshot = await getDocs(q);
    const irCodes = [];
    
    querySnapshot.forEach((doc) => {
      irCodes.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return { success: true, irCodes };
  } catch (error) {
    console.error('Error getting IR codes by brand:', error);
    return { success: false, error: error.message, irCodes: [] };
  }
};

// Update IR code
export const updateIRCode = async (irCodeId, updates) => {
  try {
    const irCodeRef = doc(db, IR_CODES_COLLECTION, irCodeId);
    await updateDoc(irCodeRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating IR code:', error);
    return { success: false, error: error.message };
  }
};

// Delete IR code
export const deleteIRCode = async (irCodeId) => {
  try {
    const irCodeRef = doc(db, IR_CODES_COLLECTION, irCodeId);
    await deleteDoc(irCodeRef);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting IR code:', error);
    return { success: false, error: error.message };
  }
};

// Check if IR code exists for a command
export const getIRCodeForCommand = async (deviceId, command) => {
  try {
    const q = query(
      collection(db, IR_CODES_COLLECTION),
      where('deviceId', '==', deviceId),
      where('command', '==', command)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { success: false, exists: false };
    }
    
    const doc = querySnapshot.docs[0];
    return {
      success: true,
      exists: true,
      irCode: {
        id: doc.id,
        ...doc.data()
      }
    };
  } catch (error) {
    console.error('Error checking IR code:', error);
    return { success: false, error: error.message, exists: false };
  }
};

// Get device brand
export const getDeviceBrand = async (deviceId) => {
  try {
    const q = query(
      collection(db, IR_CODES_COLLECTION),
      where('deviceId', '==', deviceId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { success: false, brand: null };
    }
    
    // Get brand from first IR code entry
    const firstDoc = querySnapshot.docs[0];
    const brand = firstDoc.data().brand;
    
    return { success: true, brand };
  } catch (error) {
    console.error('Error getting device brand:', error);
    return { success: false, error: error.message, brand: null };
  }
};