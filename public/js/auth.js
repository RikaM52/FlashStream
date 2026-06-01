/**
 * FlashStream Authentication Module
 * Complete auth system with JWT tokens, session management, and local sync
 * Version: 1.0.0
 * 
 * Dependencies:
 * - /js/store.js (for local storage)
 * - /js/consent.js (for analytics consent)
 */

// ========================================
// DEPENDENCIES & CONFIGURATION
// ========================================

// Import store module (with fallback)
let store;
try {
  if (typeof window.Store !== 'undefined') {
    store = window.Store;
  } else if (typeof window.store !== 'undefined') {
    store = window.store;
  } else {
    store = {
      getItem: (key, def) => {
        try {
          const val = localStorage.getItem(key);
          return val ? JSON.parse(val) : def;
        } catch { return def; }
      },
      setItem: (key, val) => {
        try {
          localStorage.setItem(key, JSON.stringify(val));
          return true;
        } catch { return false; }
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
          return true;
        } catch { return false; }
      },
      hasKey: (key) => localStorage.getItem(key) !== null
    };
  }
} catch (e) {
  console.warn('[Auth] Store module not available, using localStorage fallback');
  store = {
    getItem: (key, def) => {
      try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : def;
      } catch { return def; }
    },
    setItem: (key, val) => {
      try {
        localStorage.setItem(key, JSON.stringify(val));
        return true;
      } catch { return false; }
    },
    removeItem: (key) => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch { return false; }
    },
    hasKey: (key) => localStorage.getItem(key) !== null
  };
}

// Import consent module (for analytics tracking)
let consent;
try {
  if (typeof window.FlashStreamConsent !== 'undefined') {
    consent = window.FlashStreamConsent;
  }
} catch (e) {
  consent = { isAnalyticsAllowed: () => false };
}

// ========================================
// AUTH KEYS & CONFIGURATION
// ========================================

const AUTH_KEYS = {
  TOKEN: 'flashstream_auth_token',
  REFRESH_TOKEN: 'flashstream_refresh_token',
  USER: 'flashstream_user_profile',
  SESSION_ID: 'flashstream_session_id',
  USER_ID: 'flashstream_user_id',
  TOKEN_EXPIRY: 'flashstream_token_expiry'
};

const API_BASE = '/api/auth';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry
let refreshTimer = null;
let authSubscribers = [];

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Make authenticated API request
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
async function authFetch(url, options = {}) {
  const token = getSessionToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  // Handle token expiration
  if (response.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      // Retry with new token
      const newToken = getSessionToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      return fetch(url, {
        ...options,
        headers
      });
    } else {
      // Token refresh failed, logout
      await logout();
      throw new Error('Session expired. Please log in again.');
    }
  }
  
  return response;
}

/**
 * Parse JWT token to get expiry
 * @param {string} token - JWT token
 * @returns {number|null} - Expiry timestamp in ms
 */
function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Schedule token refresh before expiry
 * @param {string} token - JWT token
 */
function scheduleTokenRefresh(token) {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  
  const expiry = getTokenExpiry(token);
  if (!expiry) return;
  
  const refreshTime = expiry - TOKEN_REFRESH_BUFFER_MS - Date.now();
  if (refreshTime > 0) {
    refreshTimer = setTimeout(() => {
      refreshToken().catch(console.warn);
    }, refreshTime);
  }
}

/**
 * Notify all auth subscribers of state change
 * @param {object|null} user - User object or null if logged out
 */
function notifyAuthSubscribers(user) {
  authSubscribers.forEach(callback => {
    try {
      callback(user);
    } catch (err) {
      console.error('[Auth] Subscriber callback error:', err);
    }
  });
}

// ========================================
// CORE AUTH FUNCTIONS
// ========================================

/**
 * Initialize authentication module
 * Checks existing session and validates with worker
 * @returns {Promise<object|null>} - Current user or null
 */
export async function initAuth() {
  console.log('[Auth] Initializing...');
  
  // Check for existing session in storage
  const token = getSessionToken();
  const storedUser = store.getItem(AUTH_KEYS.USER);
  
  if (!token || !storedUser) {
    console.log('[Auth] No existing session found');
    notifyAuthSubscribers(null);
    return null;
  }
  
  // Validate token with worker
  try {
    const response = await authFetch(`${API_BASE}/validate`);
    if (response.ok) {
      const data = await response.json();
      if (data.valid) {
        console.log('[Auth] Session validated');
        scheduleTokenRefresh(token);
        notifyAuthSubscribers(storedUser);
        return storedUser;
      }
    }
    throw new Error('Invalid session');
  } catch (error) {
    console.warn('[Auth] Session validation failed:', error);
    // Attempt token refresh
    const refreshed = await refreshToken();
    if (refreshed) {
      const user = store.getItem(AUTH_KEYS.USER);
      notifyAuthSubscribers(user);
      return user;
    }
    // Clear invalid session
    await logout(false);
    return null;
  }
}

/**
 * Check if user is logged in
 * @returns {boolean} - True if logged in
 */
export function isLoggedIn() {
  const token = getSessionToken();
  const user = store.getItem(AUTH_KEYS.USER);
  
  if (!token || !user) return false;
  
  const expiry = getTokenExpiry(token);
  if (expiry && expiry <= Date.now()) return false;
  
  return true;
}

/**
 * Get current user object
 * @returns {object|null} - User object or null
 */
export function getCurrentUser() {
  if (!isLoggedIn()) return null;
  return store.getItem(AUTH_KEYS.USER);
}

/**
 * Get session token (JWT)
 * @returns {string|null} - JWT token or null
 */
export function getSessionToken() {
  return store.getItem(AUTH_KEYS.TOKEN);
}

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<object>} - Login result with user data
 */
export async function login(email, password) {
  console.log('[Auth] Logging in...');
  
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }
    
    // Store auth data
    store.setItem(AUTH_KEYS.TOKEN, data.token);
    store.setItem(AUTH_KEYS.REFRESH_TOKEN, data.refreshToken);
    store.setItem(AUTH_KEYS.USER, data.user);
    store.setItem(AUTH_KEYS.USER_ID, data.user.id);
    store.setItem(AUTH_KEYS.SESSION_ID, data.sessionId);
    
    const expiry = getTokenExpiry(data.token);
    if (expiry) {
      store.setItem(AUTH_KEYS.TOKEN_EXPIRY, expiry);
    }
    
    scheduleTokenRefresh(data.token);
    notifyAuthSubscribers(data.user);
    
    // Sync local data with account
    await syncLocalToAccount();
    
    // Track login if analytics allowed
    if (consent.isAnalyticsAllowed && consent.isAnalyticsAllowed()) {
      if (typeof gtag !== 'undefined') {
        gtag('event', 'login', { method: 'email' });
      }
    }
    
    console.log('[Auth] Login successful');
    return { success: true, user: data.user };
  } catch (error) {
    console.error('[Auth] Login failed:', error);
    throw error;
  }
}

/**
 * Register new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {number} birthYear - User birth year (for age verification)
 * @returns {Promise<object>} - Registration result
 */
export async function register(email, password, birthYear) {
  console.log('[Auth] Registering...');
  
  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, birthYear })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }
    
    // Auto-login after registration
    store.setItem(AUTH_KEYS.TOKEN, data.token);
    store.setItem(AUTH_KEYS.REFRESH_TOKEN, data.refreshToken);
    store.setItem(AUTH_KEYS.USER, data.user);
    store.setItem(AUTH_KEYS.USER_ID, data.user.id);
    store.setItem(AUTH_KEYS.SESSION_ID, data.sessionId);
    
    scheduleTokenRefresh(data.token);
    notifyAuthSubscribers(data.user);
    
    if (consent.isAnalyticsAllowed && consent.isAnalyticsAllowed()) {
      if (typeof gtag !== 'undefined') {
        gtag('event', 'sign_up', { method: 'email' });
      }
    }
    
    console.log('[Auth] Registration successful');
    return { success: true, user: data.user };
  } catch (error) {
    console.error('[Auth] Registration failed:', error);
    throw error;
  }
}

/**
 * Logout user
 * @param {boolean} notifyServer - Whether to notify server (default true)
 * @returns {Promise<void>}
 */
export async function logout(notifyServer = true) {
  console.log('[Auth] Logging out...');
  
  if (notifyServer && isLoggedIn()) {
    try {
      await authFetch(`${API_BASE}/logout`, {
        method: 'POST',
        body: JSON.stringify({ sessionId: store.getItem(AUTH_KEYS.SESSION_ID) })
      });
    } catch (error) {
      console.warn('[Auth] Server logout failed:', error);
    }
  }
  
  // Clear local storage
  store.removeItem(AUTH_KEYS.TOKEN);
  store.removeItem(AUTH_KEYS.REFRESH_TOKEN);
  store.removeItem(AUTH_KEYS.USER);
  store.removeItem(AUTH_KEYS.USER_ID);
  store.removeItem(AUTH_KEYS.SESSION_ID);
  store.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
  
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  
  notifyAuthSubscribers(null);
  console.log('[Auth] Logout complete');
}

/**
 * Social login redirect
 * @param {string} provider - 'google', 'facebook', 'apple'
 */
export function socialLogin(provider) {
  const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
  window.location.href = `${API_BASE}/${provider}?redirect=${redirectUri}`;
}

/**
 * Refresh expired token
 * @returns {Promise<boolean>} - True if refresh succeeded
 */
export async function refreshToken() {
  const refreshToken = store.getItem(AUTH_KEYS.REFRESH_TOKEN);
  
  if (!refreshToken) {
    console.warn('[Auth] No refresh token available');
    return false;
  }
  
  try {
    const response = await fetch(`${API_BASE}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Token refresh failed');
    }
    
    store.setItem(AUTH_KEYS.TOKEN, data.token);
    if (data.refreshToken) {
      store.setItem(AUTH_KEYS.REFRESH_TOKEN, data.refreshToken);
    }
    
    scheduleTokenRefresh(data.token);
    console.log('[Auth] Token refreshed successfully');
    return true;
  } catch (error) {
    console.error('[Auth] Token refresh failed:', error);
    return false;
  }
}

/**
 * Require authentication for protected pages
 * @param {string} redirectUrl - URL to redirect after login (default: current page)
 * @returns {Promise<boolean>} - True if authenticated
 */
export async function requireAuth(redirectUrl = null) {
  if (isLoggedIn()) {
    // Validate with server
    const valid = await initAuth();
    if (valid) return true;
  }
  
  // Not authenticated, redirect to login
  const returnUrl = redirectUrl || window.location.pathname + window.location.search;
  const loginUrl = `/login?return=${encodeURIComponent(returnUrl)}`;
  window.location.href = loginUrl;
  return false;
}

// ========================================
// USER DATA FUNCTIONS
// ========================================

/**
 * Get user's watchlist
 * @param {boolean} forceRefresh - Force fetch from API instead of cache
 * @returns {Promise<Array>} - Watchlist items
 */
export async function getWatchlist(forceRefresh = false) {
  if (!isLoggedIn()) {
    // Return local watchlist for non-authenticated users
    return store.getItem('flashstream_watchlist', []);
  }
  
  const cacheKey = 'flashstream_cached_watchlist';
  const cacheTimeKey = 'flashstream_watchlist_cache_time';
  const cacheExpiry = 5 * 60 * 1000; // 5 minutes
  
  if (!forceRefresh) {
    const cached = store.getItem(cacheKey);
    const cacheTime = store.getItem(cacheTimeKey);
    if (cached && cacheTime && (Date.now() - cacheTime) < cacheExpiry) {
      return cached;
    }
  }
  
  try {
    const response = await authFetch(`${API_BASE}/watchlist`);
    if (response.ok) {
      const watchlist = await response.json();
      store.setItem(cacheKey, watchlist);
      store.setItem(cacheTimeKey, Date.now());
      return watchlist;
    }
    throw new Error('Failed to fetch watchlist');
  } catch (error) {
    console.error('[Auth] Failed to fetch watchlist:', error);
    return store.getItem(cacheKey, []);
  }
}

/**
 * Get user's ratings
 * @param {boolean} forceRefresh - Force fetch from API instead of cache
 * @returns {Promise<Array>} - User ratings
 */
export async function getRatings(forceRefresh = false) {
  if (!isLoggedIn()) {
    return store.getItem('flashstream_user_ratings', []);
  }
  
  const cacheKey = 'flashstream_cached_ratings';
  const cacheTimeKey = 'flashstream_ratings_cache_time';
  const cacheExpiry = 5 * 60 * 1000; // 5 minutes
  
  if (!forceRefresh) {
    const cached = store.getItem(cacheKey);
    const cacheTime = store.getItem(cacheTimeKey);
    if (cached && cacheTime && (Date.now() - cacheTime) < cacheExpiry) {
      return cached;
    }
  }
  
  try {
    const response = await authFetch(`${API_BASE}/ratings`);
    if (response.ok) {
      const ratings = await response.json();
      store.setItem(cacheKey, ratings);
      store.setItem(cacheTimeKey, Date.now());
      return ratings;
    }
    throw new Error('Failed to fetch ratings');
  } catch (error) {
    console.error('[Auth] Failed to fetch ratings:', error);
    return store.getItem(cacheKey, []);
  }
}

/**
 * Sync local storage data with user account
 * Merges watchlist, ratings, and watch history
 * @returns {Promise<object>} - Sync result
 */
export async function syncLocalToAccount() {
  if (!isLoggedIn()) {
    console.log('[Auth] Not logged in, skipping sync');
    return { synced: false, reason: 'not_logged_in' };
  }
  
  console.log('[Auth] Syncing local data to account...');
  
  const localWatchlist = store.getItem('flashstream_watchlist', []);
  const localRatings = store.getItem('flashstream_user_ratings', []);
  const localHistory = store.getItem('flashstream_watch_history', []);
  
  const results = {
    watchlist: 0,
    ratings: 0,
    history: 0,
    errors: []
  };
  
  // Sync watchlist
  if (localWatchlist.length > 0) {
    try {
      const response = await authFetch(`${API_BASE}/watchlist/sync`, {
        method: 'POST',
        body: JSON.stringify({ items: localWatchlist })
      });
      if (response.ok) {
        results.watchlist = localWatchlist.length;
        // Clear local watchlist after sync
        store.removeItem('flashstream_watchlist');
      }
    } catch (error) {
      results.errors.push({ type: 'watchlist', error: error.message });
    }
  }
  
  // Sync ratings
  if (localRatings.length > 0) {
    try {
      const response = await authFetch(`${API_BASE}/ratings/sync`, {
        method: 'POST',
        body: JSON.stringify({ ratings: localRatings })
      });
      if (response.ok) {
        results.ratings = localRatings.length;
        store.removeItem('flashstream_user_ratings');
      }
    } catch (error) {
      results.errors.push({ type: 'ratings', error: error.message });
    }
  }
  
  // Sync history
  if (localHistory.length > 0) {
    try {
      const response = await authFetch(`${API_BASE}/history/sync`, {
        method: 'POST',
        body: JSON.stringify({ history: localHistory })
      });
      if (response.ok) {
        results.history = localHistory.length;
        store.removeItem('flashstream_watch_history');
      }
    } catch (error) {
      results.errors.push({ type: 'history', error: error.message });
    }
  }
  
  console.log('[Auth] Sync complete:', results);
  
  // Invalidate caches after sync
  await getWatchlist(true);
  await getRatings(true);
  
  return results;
}

// ========================================
// AUTH STATE SUBSCRIPTION
// ========================================

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Function called with user object or null
 * @returns {Function} - Unsubscribe function
 */
export function onAuthChange(callback) {
  if (typeof callback !== 'function') {
    console.warn('[Auth] onAuthChange requires a function');
    return () => {};
  }
  
  authSubscribers.push(callback);
  
  // Return unsubscribe function
  return () => {
    const index = authSubscribers.indexOf(callback);
    if (index > -1) {
      authSubscribers.splice(index, 1);
    }
  };
}

// ========================================
// ADDITIONAL USER ACTIONS
// ========================================

/**
 * Update user profile
 * @param {object} updates - Profile fields to update
 * @returns {Promise<object>} - Updated user
 */
export async function updateProfile(updates) {
  if (!isLoggedIn()) {
    throw new Error('Not logged in');
  }
  
  try {
    const response = await authFetch(`${API_BASE}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Profile update failed');
    }
    
    const updatedUser = await response.json();
    store.setItem(AUTH_KEYS.USER, updatedUser);
    notifyAuthSubscribers(updatedUser);
    
    return updatedUser;
  } catch (error) {
    console.error('[Auth] Profile update failed:', error);
    throw error;
  }
}

/**
 * Change user password
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} - Success status
 */
export async function changePassword(currentPassword, newPassword) {
  if (!isLoggedIn()) {
    throw new Error('Not logged in');
  }
  
  try {
    const response = await authFetch(`${API_BASE}/change-password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Password change failed');
    }
    
    return true;
  } catch (error) {
    console.error('[Auth] Password change failed:', error);
    throw error;
  }
}

/**
 * Request password reset email
 * @param {string} email - User email
 * @returns {Promise<boolean>} - Success status
 */
export async function requestPasswordReset(email) {
  try {
    const response = await fetch(`${API_BASE}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    return response.ok;
  } catch (error) {
    console.error('[Auth] Password reset request failed:', error);
    return false;
  }
}

/**
 * Reset password with token
 * @param {string} token - Reset token from email
 * @param {string} newPassword - New password
 * @returns {Promise<boolean>} - Success status
 */
export async function resetPassword(token, newPassword) {
  try {
    const response = await fetch(`${API_BASE}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    
    return response.ok;
  } catch (error) {
    console.error('[Auth] Password reset failed:', error);
    return false;
  }
}

// ========================================
// EXPORTS FOR BROWSER GLOBAL
// ========================================

// Create global auth object
window.FlashStreamAuth = {
  init: initAuth,
  isLoggedIn,
  getCurrentUser,
  getSessionToken,
  login,
  register,
  logout,
  socialLogin,
  refreshToken,
  requireAuth,
  getWatchlist,
  getRatings,
  syncLocalToAccount,
  onAuthChange,
  updateProfile,
  changePassword,
  requestPasswordReset,
  resetPassword
};

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initAuth().catch(console.warn);
    });
  } else {
    initAuth().catch(console.warn);
  }
}

// Default exports
export default {
  initAuth,
  isLoggedIn,
  getCurrentUser,
  getSessionToken,
  login,
  register,
  logout,
  socialLogin,
  refreshToken,
  requireAuth,
  getWatchlist,
  getRatings,
  syncLocalToAccount,
  onAuthChange,
  updateProfile,
  changePassword,
  requestPasswordReset,
  resetPassword
};