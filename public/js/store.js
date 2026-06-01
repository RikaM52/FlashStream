/**
 * FlashStream Store Module
 * Centralized storage management with type safety and migration utilities
 * Version: 1.0.0
 */

// ========================================
// STORAGE KEYS - Centralized definition
// ========================================

export const STORAGE_KEYS = {
  // User Settings
  THEME: 'flashstream_theme',
  LANGUAGE: 'flashstream_language',
  OFFLINE_FIRST: 'flashstream_offline_first',
  AUTO_PLAY: 'flashstream_auto_play',
  QUALITY_PREFERENCE: 'flashstream_quality_preference',
  SUBTITLE_LANGUAGE: 'flashstream_subtitle_language',
  DEFAULT_VOLUME: 'flashstream_default_volume',
  
  // Content Settings
  CONTENT_FILTERS: 'flashstream_content_filters',
  GENRE_PREFERENCES: 'flashstream_genre_preferences',
  MATURITY_LEVEL: 'flashstream_maturity_level',
  HIDE_WATCHED: 'flashstream_hide_watched',
  
  // User Data
  USER_PROFILE: 'flashstream_user_profile',
  USER_PREFERENCES: 'flashstream_user_preferences',
  WATCH_HISTORY: 'flashstream_watch_history',
  WATCHLIST: 'flashstream_watchlist',
  CONTINUE_WATCHING: 'flashstream_continue_watching',
  
  // Authentication
  AUTH_TOKEN: 'flashstream_auth_token',
  REFRESH_TOKEN: 'flashstream_refresh_token',
  SESSION_ID: 'flashstream_session_id',
  USER_ID: 'flashstream_user_id',
  
  // Privacy & Consent
  COOKIE_CONSENT: 'flashstream_cookie_consent',
  ANALYTICS_CONSENT: 'flashstream_analytics_consent',
  DATA_SAVING_MODE: 'flashstream_data_saving_mode',
  
  // App State
  LAST_VISITED: 'flashstream_last_visited',
  ONBOARDING_COMPLETED: 'flashstream_onboarding_completed',
  APP_VERSION: 'flashstream_app_version',
  SIDEBAR_COLLAPSED: 'flashstream_sidebar_collapsed',
  
  // Playback
  PLAYBACK_SPEED: 'flashstream_playback_speed',
  SUBTITLE_OFFSET: 'flashstream_subtitle_offset',
  AUDIO_PREFERENCE: 'flashstream_audio_preference',
  
  // Notifications
  NOTIFICATION_SETTINGS: 'flashstream_notification_settings',
  LAST_NOTIFICATION_CHECK: 'flashstream_last_notification_check',
  
  // Download Management
  DOWNLOAD_QUALITY: 'flashstream_download_quality',
  DOWNLOAD_LOCATION: 'flashstream_download_location',
  AUTO_DOWNLOAD_EPISODES: 'flashstream_auto_download_episodes',
  
  // Parental Controls
  PARENTAL_PIN: 'flashstream_parental_pin',
  ALLOWED_CONTENT_RATINGS: 'flashstream_allowed_content_ratings',
  RESTRICTED_CATEGORIES: 'flashstream_restricted_categories',
  
  // Cache & Performance
  CACHE_SIZE_LIMIT: 'flashstream_cache_size_limit',
  IMAGE_QUALITY: 'flashstream_image_quality',
  PREFETCH_ENABLED: 'flashstream_prefetch_enabled'
};

// ========================================
// OLD KEY MAPPING FOR MIGRATION
// ========================================

const OLD_KEY_MAPPING = {
  // Old keys (from previous versions) -> New keys
  'theme': STORAGE_KEYS.THEME,
  'offlineMode': STORAGE_KEYS.OFFLINE_FIRST,
  'autoPlay': STORAGE_KEYS.AUTO_PLAY,
  'quality': STORAGE_KEYS.QUALITY_PREFERENCE,
  'volume': STORAGE_KEYS.DEFAULT_VOLUME,
  'filters': STORAGE_KEYS.CONTENT_FILTERS,
  'watchlist': STORAGE_KEYS.WATCHLIST,
  'history': STORAGE_KEYS.WATCH_HISTORY,
  'token': STORAGE_KEYS.AUTH_TOKEN,
  'userId': STORAGE_KEYS.USER_ID,
  'cookieConsent': STORAGE_KEYS.COOKIE_CONSENT,
  'onboardingDone': STORAGE_KEYS.ONBOARDING_COMPLETED,
  'sidebarCollapsed': STORAGE_KEYS.SIDEBAR_COLLAPSED,
  'playbackSpeed': STORAGE_KEYS.PLAYBACK_SPEED,
  'parentalPin': STORAGE_KEYS.PARENTAL_PIN
};

// ========================================
// DEFAULT VALUES
// ========================================

const DEFAULT_VALUES = {
  [STORAGE_KEYS.THEME]: 'dark',
  [STORAGE_KEYS.LANGUAGE]: 'en',
  [STORAGE_KEYS.OFFLINE_FIRST]: false,
  [STORAGE_KEYS.AUTO_PLAY]: true,
  [STORAGE_KEYS.QUALITY_PREFERENCE]: 'auto',
  [STORAGE_KEYS.SUBTITLE_LANGUAGE]: 'off',
  [STORAGE_KEYS.DEFAULT_VOLUME]: 70,
  [STORAGE_KEYS.MATURITY_LEVEL]: 'pg13',
  [STORAGE_KEYS.HIDE_WATCHED]: false,
  [STORAGE_KEYS.DATA_SAVING_MODE]: false,
  [STORAGE_KEYS.ONBOARDING_COMPLETED]: false,
  [STORAGE_KEYS.SIDEBAR_COLLAPSED]: false,
  [STORAGE_KEYS.PLAYBACK_SPEED]: 1.0,
  [STORAGE_KEYS.SUBTITLE_OFFSET]: 0,
  [STORAGE_KEYS.DOWNLOAD_QUALITY]: 'medium',
  [STORAGE_KEYS.IMAGE_QUALITY]: 'high',
  [STORAGE_KEYS.PREFETCH_ENABLED]: true,
  [STORAGE_KEYS.CACHE_SIZE_LIMIT]: 500, // MB
  [STORAGE_KEYS.NOTIFICATION_SETTINGS]: {
    enabled: true,
    showThumbnails: true,
    sound: true
  }
};

// ========================================
// CORE STORAGE FUNCTIONS
// ========================================

/**
 * Get an item from localStorage with type safety
 * @param {string} key - The storage key
 * @param {any} defaultValue - Optional default value if key doesn't exist
 * @returns {any} - Parsed value or default
 */
export function getItem(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    
    if (item === null) {
      // Return default from DEFAULT_VALUES if available
      if (defaultValue === null && key in DEFAULT_VALUES) {
        return DEFAULT_VALUES[key];
      }
      return defaultValue;
    }
    
    // Try to parse JSON, fallback to raw string
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  } catch (error) {
    console.error(`[Store] Error getting item "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Set an item in localStorage with JSON serialization
 * @param {string} key - The storage key
 * @param {any} value - Value to store (automatically serialized)
 * @returns {boolean} - Success status
 */
export function setItem(key, value) {
  try {
    const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
    localStorage.setItem(key, serialized);
    
    // Dispatch storage event for cross-tab synchronization
    window.dispatchEvent(new StorageEvent('storage', {
      key: key,
      newValue: serialized,
      oldValue: localStorage.getItem(key),
      storageArea: localStorage
    }));
    
    return true;
  } catch (error) {
    console.error(`[Store] Error setting item "${key}":`, error);
    
    // Handle quota exceeded error
    if (error.name === 'QuotaExceededError') {
      console.warn('[Store] Storage quota exceeded, attempting cleanup...');
      cleanupOldData();
      return false;
    }
    
    return false;
  }
}

/**
 * Remove an item from localStorage
 * @param {string} key - The storage key
 * @returns {boolean} - Success status
 */
export function removeItem(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`[Store] Error removing item "${key}":`, error);
    return false;
  }
}

/**
 * Check if a key exists in localStorage
 * @param {string} key - The storage key
 * @returns {boolean} - True if key exists
 */
export function hasKey(key) {
  try {
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.error(`[Store] Error checking key "${key}":`, error);
    return false;
  }
}

/**
 * Clear all FlashStream-related data from localStorage
 * @param {boolean} preserveAuth - If true, preserves authentication tokens
 * @returns {boolean} - Success status
 */
export function clearAll(preserveAuth = false) {
  try {
    const keysToPreserve = preserveAuth ? [
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.SESSION_ID,
      STORAGE_KEYS.USER_ID,
      STORAGE_KEYS.USER_PROFILE
    ] : [];
    
    // Get all FlashStream keys
    const allKeys = Object.values(STORAGE_KEYS);
    
    for (const key of allKeys) {
      if (!keysToPreserve.includes(key)) {
        localStorage.removeItem(key);
      }
    }
    
    console.log('[Store] Cleared all data, preserveAuth:', preserveAuth);
    return true;
  } catch (error) {
    console.error('[Store] Error clearing all data:', error);
    return false;
  }
}

/**
 * Get all FlashStream-related storage keys and their values
 * @returns {Object} - Object containing all stored data
 */
export function getAllItems() {
  const result = {};
  try {
    for (const key of Object.values(STORAGE_KEYS)) {
      result[key] = getItem(key);
    }
  } catch (error) {
    console.error('[Store] Error getting all items:', error);
  }
  return result;
}

/**
 * Get the total size of stored data in bytes
 * @returns {number} - Total size in bytes
 */
export function getStorageSize() {
  try {
    let total = 0;
    for (const key of Object.values(STORAGE_KEYS)) {
      const value = localStorage.getItem(key);
      if (value) {
        total += key.length + value.length;
      }
    }
    return total;
  } catch (error) {
    console.error('[Store] Error calculating storage size:', error);
    return 0;
  }
}

// ========================================
// MIGRATION UTILITIES
// ========================================

/**
 * Migrate data from old storage keys to new ones
 * @returns {Object} - Migration report
 */
export function migrateFromOldKeys() {
  const report = {
    migrated: [],
    failed: [],
    skipped: []
  };
  
  for (const [oldKey, newKey] of Object.entries(OLD_KEY_MAPPING)) {
    try {
      const oldValue = localStorage.getItem(oldKey);
      
      if (oldValue !== null && !hasKey(newKey)) {
        // Parse old value if it looks like JSON
        let parsedValue;
        try {
          parsedValue = JSON.parse(oldValue);
        } catch {
          parsedValue = oldValue;
        }
        
        // Migrate to new key
        setItem(newKey, parsedValue);
        report.migrated.push({ from: oldKey, to: newKey, value: parsedValue });
        
        // Optionally remove old key after successful migration
        // Uncomment to clean up old keys automatically
        // localStorage.removeItem(oldKey);
      } else if (hasKey(newKey)) {
        report.skipped.push({ from: oldKey, to: newKey, reason: 'New key already exists' });
      }
    } catch (error) {
      console.error(`[Store] Migration failed for ${oldKey} -> ${newKey}:`, error);
      report.failed.push({ from: oldKey, to: newKey, error: error.message });
    }
  }
  
  // Set migration version marker
  setItem('flashstream_migration_version', '2.0.0');
  
  console.log('[Store] Migration completed:', report);
  return report;
}

/**
 * Check if migration is needed and perform it if necessary
 * @returns {boolean} - True if migration was performed
 */
export function checkAndMigrate() {
  const migrationVersion = getItem('flashstream_migration_version');
  
  if (!migrationVersion || migrationVersion !== '2.0.0') {
    console.log('[Store] Migration needed, current version:', migrationVersion);
    migrateFromOldKeys();
    return true;
  }
  
  console.log('[Store] No migration needed, version:', migrationVersion);
  return false;
}

// ========================================
// CLEANUP UTILITIES
// ========================================

/**
 * Clean up old or expired data to free up storage space
 * @returns {number} - Number of items cleaned
 */
export function cleanupOldData() {
  let cleanedCount = 0;
  
  try {
    // Clean up old watch history (keep last 100 items)
    const history = getItem(STORAGE_KEYS.WATCH_HISTORY, []);
    if (Array.isArray(history) && history.length > 100) {
      const trimmed = history.slice(-100);
      setItem(STORAGE_KEYS.WATCH_HISTORY, trimmed);
      cleanedCount += history.length - 100;
    }
    
    // Clean up expired tokens if they exist
    const token = getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token && typeof token === 'object' && token.expiry && token.expiry < Date.now()) {
      removeItem(STORAGE_KEYS.AUTH_TOKEN);
      removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      cleanedCount++;
    }
    
    // Clean up old notification checks (keep last 30 days)
    const lastCheck = getItem(STORAGE_KEYS.LAST_NOTIFICATION_CHECK);
    if (lastCheck && typeof lastCheck === 'number') {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      if (lastCheck < thirtyDaysAgo) {
        setItem(STORAGE_KEYS.LAST_NOTIFICATION_CHECK, Date.now());
      }
    }
    
    console.log(`[Store] Cleaned up ${cleanedCount} items`);
  } catch (error) {
    console.error('[Store] Error during cleanup:', error);
  }
  
  return cleanedCount;
}

/**
 * Export all stored data as a JSON object (for backup)
 * @returns {Object} - All stored data
 */
export function exportData() {
  const data = {};
  for (const key of Object.values(STORAGE_KEYS)) {
    if (hasKey(key)) {
      data[key] = getItem(key);
    }
  }
  return {
    version: '2.0.0',
    exportDate: new Date().toISOString(),
    data: data
  };
}

/**
 * Import data from a backup (overwrites existing data)
 * @param {Object} backupData - Backup data from exportData()
 * @returns {boolean} - Success status
 */
export function importData(backupData) {
  try {
    if (!backupData || backupData.version !== '2.0.0') {
      console.error('[Store] Invalid backup data or version mismatch');
      return false;
    }
    
    for (const [key, value] of Object.entries(backupData.data)) {
      setItem(key, value);
    }
    
    console.log('[Store] Data imported successfully');
    return true;
  } catch (error) {
    console.error('[Store] Error importing data:', error);
    return false;
  }
}

// ========================================
// CONVENIENCE METHODS FOR COMMON OPERATIONS
// ========================================

/**
 * Update a specific property of an object stored at a key
 * @param {string} key - Storage key
 * @param {string} property - Property name to update
 * @param {any} value - New value for the property
 * @returns {boolean} - Success status
 */
export function updateProperty(key, property, value) {
  try {
    const obj = getItem(key, {});
    if (typeof obj === 'object' && obj !== null) {
      obj[property] = value;
      return setItem(key, obj);
    }
    return false;
  } catch (error) {
    console.error(`[Store] Error updating property ${property} in ${key}:`, error);
    return false;
  }
}

/**
 * Get a specific property from an object stored at a key
 * @param {string} key - Storage key
 * @param {string} property - Property name to get
 * @param {any} defaultValue - Default value if property doesn't exist
 * @returns {any} - Property value
 */
export function getProperty(key, property, defaultValue = null) {
  try {
    const obj = getItem(key, {});
    if (typeof obj === 'object' && obj !== null && property in obj) {
      return obj[property];
    }
    return defaultValue;
  } catch (error) {
    console.error(`[Store] Error getting property ${property} from ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Listen to changes for a specific storage key
 * @param {string} key - Storage key to watch
 * @param {Function} callback - Callback function (newValue, oldValue)
 * @returns {Function} - Unsubscribe function
 */
export function onStorageChange(key, callback) {
  const handler = (event) => {
    if (event.key === key && callback) {
      let newValue = null;
      let oldValue = null;
      
      try {
        newValue = event.newValue ? JSON.parse(event.newValue) : null;
        oldValue = event.oldValue ? JSON.parse(event.oldValue) : null;
      } catch {
        newValue = event.newValue;
        oldValue = event.oldValue;
      }
      
      callback(newValue, oldValue);
    }
  };
  
  window.addEventListener('storage', handler);
  
  // Return unsubscribe function
  return () => window.removeEventListener('storage', handler);
}

// ========================================
// INITIALIZATION
// ========================================

// Run migration check when the module loads
if (typeof window !== 'undefined') {
  // Delay migration to avoid blocking initial render
  setTimeout(() => {
    checkAndMigrate();
    // Clean up old data on init
    cleanupOldData();
  }, 0);
}

// Default export for convenience
export default {
  STORAGE_KEYS,
  getItem,
  setItem,
  removeItem,
  hasKey,
  clearAll,
  getAllItems,
  getStorageSize,
  migrateFromOldKeys,
  checkAndMigrate,
  cleanupOldData,
  exportData,
  importData,
  updateProperty,
  getProperty,
  onStorageChange
};