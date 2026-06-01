/**
 * FlashStream Store Module - UMD/Global Version
 * No ES6 modules - works in all browsers
 */

(function(global) {
    'use strict';
    
    // STORAGE KEYS
    var STORAGE_KEYS = {
        THEME: 'flashstream_theme',
        LANGUAGE: 'flashstream_language',
        OFFLINE_FIRST: 'flashstream_offline_first',
        AUTO_PLAY: 'flashstream_auto_play',
        QUALITY_PREFERENCE: 'flashstream_quality_preference',
        SUBTITLE_LANGUAGE: 'flashstream_subtitle_language',
        DEFAULT_VOLUME: 'flashstream_default_volume',
        USER_PROFILE: 'flashstream_user_profile',
        WATCH_HISTORY: 'flashstream_watch_history',
        WATCHLIST: 'flashstream_watchlist',
        CONTINUE_WATCHING: 'flashstream_continue_watching',
        AUTH_TOKEN: 'flashstream_auth_token',
        REFRESH_TOKEN: 'flashstream_refresh_token',
        SESSION_ID: 'flashstream_session_id',
        USER_ID: 'flashstream_user_id',
        COOKIE_CONSENT: 'flashstream_cookie_consent',
        ANALYTICS_CONSENT: 'flashstream_analytics_consent',
        DATA_SAVING_MODE: 'flashstream_data_saving_mode',
        LAST_VISITED: 'flashstream_last_visited',
        ONBOARDING_COMPLETED: 'flashstream_onboarding_completed',
        APP_VERSION: 'flashstream_app_version',
        SIDEBAR_COLLAPSED: 'flashstream_sidebar_collapsed'
    };
    
    // DEFAULT VALUES
    var DEFAULT_VALUES = {
        'flashstream_theme': 'dark',
        'flashstream_language': 'en',
        'flashstream_offline_first': false,
        'flashstream_auto_play': true,
        'flashstream_quality_preference': 'auto',
        'flashstream_default_volume': 70,
        'flashstream_data_saving_mode': false,
        'flashstream_onboarding_completed': false,
        'flashstream_sidebar_collapsed': false
    };
    
    // Get item with type safety
    function getItem(key, defaultValue) {
        try {
            var item = localStorage.getItem(key);
            if (item === null) {
                if (defaultValue !== undefined) return defaultValue;
                if (DEFAULT_VALUES[key] !== undefined) return DEFAULT_VALUES[key];
                return null;
            }
            try {
                return JSON.parse(item);
            } catch(e) {
                return item;
            }
        } catch(e) {
            console.error('[Store] Error getting', key, e);
            return defaultValue !== undefined ? defaultValue : null;
        }
    }
    
    // Set item with JSON serialization
    function setItem(key, value) {
        try {
            var serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
            localStorage.setItem(key, serialized);
            return true;
        } catch(e) {
            console.error('[Store] Error setting', key, e);
            return false;
        }
    }
    
    // Remove item
    function removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch(e) {
            return false;
        }
    }
    
    // Check if key exists
    function hasKey(key) {
        try {
            return localStorage.getItem(key) !== null;
        } catch(e) {
            return false;
        }
    }
    
    // Clear all FlashStream data
    function clearAll(preserveAuth) {
        var preserveKeys = preserveAuth ? [
            STORAGE_KEYS.AUTH_TOKEN,
            STORAGE_KEYS.REFRESH_TOKEN,
            STORAGE_KEYS.USER_PROFILE,
            STORAGE_KEYS.USER_ID,
            STORAGE_KEYS.SESSION_ID
        ] : [];
        
        for (var key in STORAGE_KEYS) {
            if (STORAGE_KEYS.hasOwnProperty(key)) {
                var storageKey = STORAGE_KEYS[key];
                if (preserveKeys.indexOf(storageKey) === -1) {
                    localStorage.removeItem(storageKey);
                }
            }
        }
        return true;
    }
    
    // Get all items
    function getAllItems() {
        var result = {};
        for (var key in STORAGE_KEYS) {
            if (STORAGE_KEYS.hasOwnProperty(key)) {
                result[STORAGE_KEYS[key]] = getItem(STORAGE_KEYS[key]);
            }
        }
        return result;
    }
    
    // Migration from old keys
    function migrateFromOldKeys() {
        var migrations = {
            'theme': STORAGE_KEYS.THEME,
            'offlineMode': STORAGE_KEYS.OFFLINE_FIRST,
            'autoPlay': STORAGE_KEYS.AUTO_PLAY,
            'watchlist': STORAGE_KEYS.WATCHLIST,
            'history': STORAGE_KEYS.WATCH_HISTORY,
            'token': STORAGE_KEYS.AUTH_TOKEN,
            'userId': STORAGE_KEYS.USER_ID
        };
        
        var migrated = [];
        for (var oldKey in migrations) {
            if (migrations.hasOwnProperty(oldKey)) {
                var oldValue = localStorage.getItem(oldKey);
                if (oldValue !== null && !hasKey(migrations[oldKey])) {
                    var parsed;
                    try { parsed = JSON.parse(oldValue); } catch(e) { parsed = oldValue; }
                    setItem(migrations[oldKey], parsed);
                    migrated.push({ from: oldKey, to: migrations[oldKey] });
                }
            }
        }
        return migrated;
    }
    
    // Check and run migration
    function checkAndMigrate() {
        if (!getItem('flashstream_migration_version')) {
            migrateFromOldKeys();
            setItem('flashstream_migration_version', '2.0.0');
            return true;
        }
        return false;
    }
    
    // Expose globally
    global.Store = {
        STORAGE_KEYS: STORAGE_KEYS,
        getItem: getItem,
        setItem: setItem,
        removeItem: removeItem,
        hasKey: hasKey,
        clearAll: clearAll,
        getAllItems: getAllItems,
        migrateFromOldKeys: migrateFromOldKeys,
        checkAndMigrate: checkAndMigrate
    };
    
    // Run migration on load
    setTimeout(checkAndMigrate, 0);
    
    console.log('[Store] Module initialized');
    
})(typeof window !== 'undefined' ? window : this);