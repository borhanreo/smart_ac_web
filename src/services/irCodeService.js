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

// AC function types that can be learned
export const AC_FUNCTIONS = {
  POWER_ON: 'power_on',
  POWER_OFF: 'power_off',
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

// Popular AC brands
export const AC_BRANDS = [
  'Daikin', 'Mitsubishi', 'LG', 'Samsung', 'Panasonic', 'Carrier', 
  'Toshiba', 'Sharp', 'Hitachi', 'Fujitsu', 'Haier', 'Gree', 
  'Midea', 'TCL', 'Voltas', 'Blue Star', 'Godrej', 'Whirlpool', 'Other'
];

// Save learned IR code to Firebase
export const saveIRCode = async (deviceId, acBrand, functionType, irCode, rawData = null) => {
  try {
    const irCodeDoc = {
      deviceId: deviceId,
      acBrand: acBrand,
      functionType: functionType,
      irCode: irCode,
      rawData: rawData, // Raw IR signal data
      protocol: rawData?.protocol || 'unknown',
      bits: rawData?.bits || 0,
      learnedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true
    };
    
    // Check if code already exists for this device/brand/function
    const existingCode = await getIRCode(deviceId, acBrand, functionType);
    
    if (existingCode.success && existingCode.code) {
      // Update existing code
      const docRef = doc(db, IR_CODES_COLLECTION, existingCode.code.id);
      await updateDoc(docRef, {
        ...irCodeDoc,
        updatedAt: serverTimestamp()
      });
      
      return { 
        success: true, 
        codeId: existingCode.code.id, 
        action: 'updated',
        message: `Updated ${functionType} code for ${acBrand}` 
      };
    } else {
      // Create new code
      const docRef = await addDoc(collection(db, IR_CODES_COLLECTION), irCodeDoc);
      return { 
        success: true, 
        codeId: docRef.id, 
        action: 'created',
        message: `Learned ${functionType} code for ${acBrand}` 
      };
    }
  } catch (error) {
    console.error('Error saving IR code:', error);
    return { success: false, error: error.message };
  }
};

// Get specific IR code
export const getIRCode = async (deviceId, acBrand, functionType) => {
  try {
    const q = query(
      collection(db, IR_CODES_COLLECTION),
      where('deviceId', '==', deviceId),
      where('acBrand', '==', acBrand),
      where('functionType', '==', functionType),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { success: false, message: 'IR code not found' };
    }
    
    const codeDoc = querySnapshot.docs[0];
    const codeData = { id: codeDoc.id, ...codeDoc.data() };
    
    return { success: true, code: codeData };
  } catch (error) {
    console.error('Error getting IR code:', error);
    return { success: false, error: error.message };
  }
};

// Get all IR codes for a device and brand
export const getDeviceIRCodes = async (deviceId, acBrand = null) => {
  try {
    let q;
    if (acBrand) {
      q = query(
        collection(db, IR_CODES_COLLECTION),
        where('deviceId', '==', deviceId),
        where('acBrand', '==', acBrand),
        where('isActive', '==', true)
      );
    } else {
      q = query(
        collection(db, IR_CODES_COLLECTION),
        where('deviceId', '==', deviceId),
        where('isActive', '==', true)
      );
    }
    
    const querySnapshot = await getDocs(q);
    const codes = [];
    
    querySnapshot.forEach((doc) => {
      codes.push({ id: doc.id, ...doc.data() });
    });
    
    // Group codes by function type for easy access
    const groupedCodes = {};
    codes.forEach(code => {
      groupedCodes[code.functionType] = code;
    });
    
    return { success: true, codes: codes, groupedCodes: groupedCodes };
  } catch (error) {
    console.error('Error getting device IR codes:', error);
    return { success: false, error: error.message };
  }
};

// Delete IR code
export const deleteIRCode = async (codeId) => {
  try {
    const docRef = doc(db, IR_CODES_COLLECTION, codeId);
    await updateDoc(docRef, { 
      isActive: false, 
      deletedAt: serverTimestamp() 
    });
    
    return { success: true, message: 'IR code deleted successfully' };
  } catch (error) {
    console.error('Error deleting IR code:', error);
    return { success: false, error: error.message };
  }
};

// Get available brands for a device (brands that have learned codes)
export const getAvailableBrands = async (deviceId) => {
  try {
    const q = query(
      collection(db, IR_CODES_COLLECTION),
      where('deviceId', '==', deviceId),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    const brands = new Set();
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      brands.add(data.acBrand);
    });
    
    return { success: true, brands: Array.from(brands).sort() };
  } catch (error) {
    console.error('Error getting available brands:', error);
    return { success: false, error: error.message };
  }
};

// Bulk import IR codes (for pre-configured brand codes)
export const importBrandCodes = async (deviceId, acBrand, codeMap) => {
  try {
    const results = [];
    
    for (const [functionType, irCode] of Object.entries(codeMap)) {
      const result = await saveIRCode(deviceId, acBrand, functionType, irCode);
      results.push({ functionType, result });
    }
    
    const successful = results.filter(r => r.result.success).length;
    const failed = results.filter(r => !r.result.success).length;
    
    return { 
      success: true, 
      imported: successful, 
      failed: failed,
      results: results,
      message: `Imported ${successful} codes for ${acBrand}${failed > 0 ? `, ${failed} failed` : ''}` 
    };
  } catch (error) {
    console.error('Error importing brand codes:', error);
    return { success: false, error: error.message };
  }
};