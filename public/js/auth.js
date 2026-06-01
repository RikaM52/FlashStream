/**
 * FlashStream Auth Module - UMD/Global Version
 */

(function(global) {
    'use strict';
    
    var AUTH_KEYS = {
        TOKEN: 'flashstream_auth_token',
        REFRESH_TOKEN: 'flashstream_refresh_token',
        USER: 'flashstream_user_profile',
        SESSION_ID: 'flashstream_session_id',
        USER_ID: 'flashstream_user_id',
        TOKEN_EXPIRY: 'flashstream_token_expiry'
    };
    
    var API_BASE = '/api/auth';
    var authSubscribers = [];
    
    function getStore() {
        if (typeof global.Store !== 'undefined') {
            return global.Store;
        }
        return {
            getItem: function(key, def) {
                try {
                    var val = localStorage.getItem(key);
                    return val ? JSON.parse(val) : def;
                } catch(e) { return def; }
            },
            setItem: function(key, val) {
                try {
                    localStorage.setItem(key, JSON.stringify(val));
                    return true;
                } catch(e) { return false; }
            },
            removeItem: function(key) {
                localStorage.removeItem(key);
            },
            hasKey: function(key) {
                return localStorage.getItem(key) !== null;
            }
        };
    }
    
    function getSessionToken() {
        return getStore().getItem(AUTH_KEYS.TOKEN);
    }
    
    function getTokenExpiry(token) {
        try {
            var payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp ? payload.exp * 1000 : null;
        } catch(e) {
            return null;
        }
    }
    
    function isLoggedIn() {
        var token = getSessionToken();
        var user = getStore().getItem(AUTH_KEYS.USER);
        if (!token || !user) return false;
        var expiry = getTokenExpiry(token);
        if (expiry && expiry <= Date.now()) return false;
        return true;
    }
    
    function getCurrentUser() {
        if (!isLoggedIn()) return null;
        return getStore().getItem(AUTH_KEYS.USER);
    }
    
    function notifyAuthSubscribers(user) {
        for (var i = 0; i < authSubscribers.length; i++) {
            try {
                authSubscribers[i](user);
            } catch(e) {}
        }
    }
    
    function onAuthChange(callback) {
        if (typeof callback === 'function') {
            authSubscribers.push(callback);
            return function() {
                var index = authSubscribers.indexOf(callback);
                if (index > -1) authSubscribers.splice(index, 1);
            };
        }
        return function() {};
    }
    
    async function login(email, password) {
        try {
            var response = await fetch(API_BASE + '/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password })
            });
            
            var data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }
            
            var store = getStore();
            store.setItem(AUTH_KEYS.TOKEN, data.token);
            store.setItem(AUTH_KEYS.REFRESH_TOKEN, data.refreshToken);
            store.setItem(AUTH_KEYS.USER, data.user);
            store.setItem(AUTH_KEYS.USER_ID, data.user.id);
            store.setItem(AUTH_KEYS.SESSION_ID, data.sessionId);
            
            notifyAuthSubscribers(data.user);
            console.log('[Auth] Login successful');
            return { success: true, user: data.user };
        } catch(error) {
            console.error('[Auth] Login failed:', error);
            throw error;
        }
    }
    
    async function logout(notifyServer) {
        notifyServer = notifyServer !== false;
        console.log('[Auth] Logging out...');
        
        var store = getStore();
        store.removeItem(AUTH_KEYS.TOKEN);
        store.removeItem(AUTH_KEYS.REFRESH_TOKEN);
        store.removeItem(AUTH_KEYS.USER);
        store.removeItem(AUTH_KEYS.USER_ID);
        store.removeItem(AUTH_KEYS.SESSION_ID);
        store.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
        
        notifyAuthSubscribers(null);
        console.log('[Auth] Logout complete');
    }
    
    async function refreshToken() {
        var store = getStore();
        var refreshToken = store.getItem(AUTH_KEYS.REFRESH_TOKEN);
        
        if (!refreshToken) return false;
        
        try {
            var response = await fetch(API_BASE + '/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: refreshToken })
            });
            
            var data = await response.json();
            
            if (!response.ok) return false;
            
            store.setItem(AUTH_KEYS.TOKEN, data.token);
            if (data.refreshToken) {
                store.setItem(AUTH_KEYS.REFRESH_TOKEN, data.refreshToken);
            }
            return true;
        } catch(error) {
            console.error('[Auth] Token refresh failed:', error);
            return false;
        }
    }
    
    async function initAuth() {
        console.log('[Auth] Initializing...');
        var token = getSessionToken();
        var storedUser = getStore().getItem(AUTH_KEYS.USER);
        
        if (!token || !storedUser) {
            console.log('[Auth] No existing session');
            notifyAuthSubscribers(null);
            return null;
        }
        
        // Validate token locally first
        var expiry = getTokenExpiry(token);
        if (expiry && expiry <= Date.now()) {
            console.log('[Auth] Token expired, attempting refresh');
            var refreshed = await refreshToken();
            if (refreshed) {
                notifyAuthSubscribers(storedUser);
                return storedUser;
            } else {
                await logout(false);
                return null;
            }
        }
        
        console.log('[Auth] Session valid');
        notifyAuthSubscribers(storedUser);
        return storedUser;
    }
    
    function socialLogin(provider) {
        var redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
        window.location.href = API_BASE + '/' + provider + '?redirect=' + redirectUri;
    }
    
    async function requireAuth(redirectUrl) {
        if (isLoggedIn()) {
            var valid = await initAuth();
            if (valid) return true;
        }
        var returnUrl = redirectUrl || window.location.pathname + window.location.search;
        window.location.href = '/login?return=' + encodeURIComponent(returnUrl);
        return false;
    }
    
    async function syncLocalToAccount() {
        if (!isLoggedIn()) {
            console.log('[Auth] Not logged in, skipping sync');
            return { synced: false, reason: 'not_logged_in' };
        }
        console.log('[Auth] Sync not implemented - placeholder');
        return { synced: true };
    }
    
    // Expose globally
    global.FlashStreamAuth = {
        AUTH_KEYS: AUTH_KEYS,
        initAuth: initAuth,
        isLoggedIn: isLoggedIn,
        getCurrentUser: getCurrentUser,
        getSessionToken: getSessionToken,
        login: login,
        logout: logout,
        socialLogin: socialLogin,
        refreshToken: refreshToken,
        requireAuth: requireAuth,
        syncLocalToAccount: syncLocalToAccount,
        onAuthChange: onAuthChange
    };
    
    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initAuth().catch(console.warn);
        });
    } else {
        initAuth().catch(console.warn);
    }
    
    console.log('[Auth] Module initialized');
    
})(typeof window !== 'undefined' ? window : this);