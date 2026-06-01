/**
 * FlashStream Consent Management Module
 * Unified consent handling for GDPR, CCPA, and privacy compliance
 * Version: 1.0.0
 * 
 * This module works with:
 * - /js/store.js for persistent storage
 * - /sw.js for offline consent synchronization
 * - All pages for consistent consent experience
 */

// ========================================
// DEPENDENCIES
// ========================================

// Import store module (assumes store.js is loaded before consent.js)
// Fallback to localStorage if store.js isn't loaded yet
let store;
try {
  if (typeof window.Store !== 'undefined') {
    store = window.Store;
  } else {
    // Minimal store fallback
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
      hasKey: (key) => localStorage.getItem(key) !== null
    };
  }
} catch (e) {
  console.warn('[Consent] Store module not available, using localStorage fallback');
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
    hasKey: (key) => localStorage.getItem(key) !== null
  };
}

// ========================================
// CONSENT KEYS & CONFIGURATION
// ========================================

const CONSENT_KEYS = {
  ANALYTICS: 'flashstream_analytics_consent',
  MARKETING: 'flashstream_marketing_consent',
  FUNCTIONAL: 'flashstream_functional_consent',
  COOKIE_CONSENT: 'flashstream_cookie_consent',
  DO_NOT_SELL: 'flashstream_do_not_sell',
  LAST_UPDATED: 'flashstream_consent_last_updated',
  CONSENT_VERSION: 'flashstream_consent_version'
};

const CONSENT_VERSION = '1.0.0';
const CONSENT_EXPIRY_DAYS = 365; // EU requires renewal after 12 months

// Default consent states (strictest by default)
const DEFAULT_CONSENT = {
  [CONSENT_KEYS.ANALYTICS]: false,
  [CONSENT_KEYS.MARKETING]: false,
  [CONSENT_KEYS.FUNCTIONAL]: true, // Functional cookies are essential
  [CONSENT_KEYS.COOKIE_CONSENT]: null, // null = not decided yet
  [CONSENT_KEYS.DO_NOT_SELL]: false
};

// CCPA regions (California jurisdiction)
const CCPA_REGIONS = ['CA', 'California', 'US-CA'];

// Modal HTML template
const consentModalHTML = `
<div id="consent-manager-modal" class="consent-modal" role="dialog" aria-labelledby="consent-title" aria-modal="true" style="display: none;">
  <div class="consent-modal-content modal-animate" style="max-width: 600px; width: 90%;">
    <div class="modal-header">
      <h2 id="consent-title" style="font-size: 1.5rem; font-weight: 700;">Privacy Settings</h2>
      <button id="consent-close-btn" class="consent-close" aria-label="Close" style="background: none; border: none; color: #9ca3af; font-size: 24px; cursor: pointer;">&times;</button>
    </div>
    
    <div style="margin-bottom: 20px;">
      <p style="margin-bottom: 16px; color: #9ca3af;">
        We value your privacy. Please choose which data you're comfortable sharing with us.
        You can change these settings at any time via the cookie preferences link in the footer.
      </p>
      <p style="font-size: 0.875rem; color: #6b7280;">
        <strong>Last updated:</strong> ${new Date().toLocaleDateString()}
      </p>
    </div>
    
    <div class="consent-options" style="margin-bottom: 24px;">
      <!-- Functional (Required) -->
      <div class="consent-option" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
        <div>
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 4px;">Functional Cookies (Required)</h3>
          <p style="font-size: 0.75rem; color: #6b7280;">Essential for the website to function properly. These cannot be disabled.</p>
        </div>
        <div class="toggle-switch">
          <input type="checkbox" id="consent-functional" checked disabled>
          <span class="toggle-track"></span>
        </div>
      </div>
      
      <!-- Analytics -->
      <div class="consent-option" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
        <div>
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 4px;">Analytics Cookies</h3>
          <p style="font-size: 0.75rem; color: #6b7280;">Help us understand how visitors interact with our site.</p>
        </div>
        <div class="toggle-switch">
          <input type="checkbox" id="consent-analytics">
          <span class="toggle-track"></span>
        </div>
      </div>
      
      <!-- Marketing -->
      <div class="consent-option" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
        <div>
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 4px;">Marketing Cookies</h3>
          <p style="font-size: 0.75rem; color: #6b7280;">Used to deliver personalized ads and track campaign performance.</p>
        </div>
        <div class="toggle-switch">
          <input type="checkbox" id="consent-marketing">
          <span class="toggle-track"></span>
        </div>
      </div>
      
      <!-- CCPA Do Not Sell (shown only for California) -->
      <div id="ccpa-option" class="consent-option" style="display: none; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">
        <div>
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 4px;">Do Not Sell My Personal Information</h3>
          <p style="font-size: 0.75rem; color: #6b7280;">Under CCPA, you have the right to opt out of the sale of your personal information.</p>
        </div>
        <div class="toggle-switch">
          <input type="checkbox" id="consent-do-not-sell">
          <span class="toggle-track"></span>
        </div>
      </div>
    </div>
    
    <div class="consent-actions" style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
      <button id="consent-reject-all" class="btn-secondary" style="padding: 8px 16px;">Reject All</button>
      <button id="consent-accept-necessary" class="btn-secondary" style="padding: 8px 16px;">Accept Necessary Only</button>
      <button id="consent-accept-all" class="btn-primary" style="padding: 8px 16px;">Accept All</button>
    </div>
    
    <div style="margin-top: 16px; text-align: center; font-size: 0.75rem; color: #4b5563;">
      <a href="/privacy" target="_blank" style="color: #00C4BC;">Privacy Policy</a> &nbsp;|&nbsp;
      <a href="/terms" target="_blank" style="color: #00C4BC;">Terms of Service</a>
    </div>
  </div>
</div>

<style>
  .consent-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.95);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  
  .consent-modal-content {
    max-width: 600px;
    width: 90%;
    background: #1a1a24;
    border-radius: 24px;
    padding: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .consent-close {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 24px;
    cursor: pointer;
    transition: color 0.15s;
  }
  
  .consent-close:hover {
    color: #ffffff;
  }
  
  .btn-primary {
    background-color: #00C4BC;
    color: #000000;
    font-weight: 500;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
  }
  
  .btn-secondary {
    background-color: transparent;
    color: #ffffff;
    font-weight: 500;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
  }
  
  .btn-secondary:hover {
    border-color: #00C4BC;
    color: #00C4BC;
  }
  
  @keyframes slideIn {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  .modal-animate {
    animation: slideIn 0.3s ease-out;
  }
</style>
`;

// ========================================
// CORE CONSENT FUNCTIONS
// ========================================

/**
 * Initialize consent system
 * Checks if consent exists, shows modal if not
 * @returns {Promise<boolean>} - True if consent is already set
 */
export async function initConsent() {
  console.log('[Consent] Initializing consent system...');
  
  // Inject modal HTML into DOM
  if (!document.getElementById('consent-manager-modal')) {
    document.body.insertAdjacentHTML('beforeend', consentModalHTML);
  }
  
  // Check if consent has been given
  const hasConsent = store.hasKey(CONSENT_KEYS.COOKIE_CONSENT);
  const consentValue = store.getItem(CONSENT_KEYS.COOKIE_CONSENT);
  const isExpired = isConsentExpired();
  
  if (!hasConsent || consentValue !== true || isExpired) {
    console.log('[Consent] No valid consent found, showing modal');
    showConsentModal();
    return false;
  }
  
  console.log('[Consent] Valid consent found, applying stored preferences');
  applyStoredConsent();
  return true;
}

/**
 * Show the consent modal (blocks interaction)
 * @param {boolean} isUpdate - Whether this is an update (not first visit)
 */
export function showConsentModal(isUpdate = false) {
  const modal = document.getElementById('consent-manager-modal');
  if (!modal) {
    console.error('[Consent] Modal element not found');
    return;
  }
  
  // Set current consent states in modal
  const analyticsCheckbox = document.getElementById('consent-analytics');
  const marketingCheckbox = document.getElementById('consent-marketing');
  const doNotSellCheckbox = document.getElementById('consent-do-not-sell');
  
  if (analyticsCheckbox) {
    analyticsCheckbox.checked = getConsent('analytics');
  }
  if (marketingCheckbox) {
    marketingCheckbox.checked = getConsent('marketing');
  }
  if (doNotSellCheckbox) {
    doNotSellCheckbox.checked = getConsent('doNotSell');
  }
  
  // Show CCPA option for California users
  if (detectCcpaRegion()) {
    const ccpaOption = document.getElementById('ccpa-option');
    if (ccpaOption) {
      ccpaOption.style.display = 'flex';
    }
  }
  
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  // Setup event listeners
  setupModalEventListeners(isUpdate);
}

/**
 * Hide the consent modal
 */
function hideConsentModal() {
  const modal = document.getElementById('consent-manager-modal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

/**
 * Setup modal event listeners
 * @param {boolean} isUpdate - Whether this is an update
 */
function setupModalEventListeners(isUpdate) {
  const modal = document.getElementById('consent-manager-modal');
  const closeBtn = document.getElementById('consent-close-btn');
  const acceptAllBtn = document.getElementById('consent-accept-all');
  const rejectAllBtn = document.getElementById('consent-reject-all');
  const acceptNecessaryBtn = document.getElementById('consent-accept-necessary');
  
  // Remove existing listeners to avoid duplicates
  const newCloseBtn = closeBtn?.cloneNode(true);
  const newAcceptAll = acceptAllBtn?.cloneNode(true);
  const newRejectAll = rejectAllBtn?.cloneNode(true);
  const newAcceptNecessary = acceptNecessaryBtn?.cloneNode(true);
  
  if (closeBtn && newCloseBtn) {
    closeBtn.parentNode?.replaceChild(newCloseBtn, closeBtn);
    newCloseBtn.addEventListener('click', () => {
      if (!isUpdate) {
        // On first visit, closing without choice defaults to necessary only
        setConsent('analytics', false);
        setConsent('marketing', false);
        saveConsentPreferences();
      }
      hideConsentModal();
    });
  }
  
  if (acceptAllBtn && newAcceptAll) {
    acceptAllBtn.parentNode?.replaceChild(newAcceptAll, acceptAllBtn);
    newAcceptAll.addEventListener('click', () => {
      setConsent('analytics', true);
      setConsent('marketing', true);
      saveConsentPreferences();
      hideConsentModal();
      if (typeof gtag !== 'undefined') {
        gtag('consent', 'update', {
          'analytics_storage': 'granted',
          'ad_storage': 'granted'
        });
      }
    });
  }
  
  if (rejectAllBtn && newRejectAll) {
    rejectAllBtn.parentNode?.replaceChild(newRejectAll, rejectAllBtn);
    newRejectAll.addEventListener('click', () => {
      setConsent('analytics', false);
      setConsent('marketing', false);
      saveConsentPreferences();
      hideConsentModal();
      if (typeof gtag !== 'undefined') {
        gtag('consent', 'update', {
          'analytics_storage': 'denied',
          'ad_storage': 'denied'
        });
      }
    });
  }
  
  if (acceptNecessaryBtn && newAcceptNecessary) {
    acceptNecessaryBtn.parentNode?.replaceChild(newAcceptNecessary, acceptNecessaryBtn);
    newAcceptNecessary.addEventListener('click', () => {
      setConsent('analytics', false);
      setConsent('marketing', false);
      saveConsentPreferences();
      hideConsentModal();
    });
  }
  
  // Handle checkbox changes for CCPA
  const doNotSellCheckbox = document.getElementById('consent-do-not-sell');
  if (doNotSellCheckbox) {
    doNotSellCheckbox.addEventListener('change', (e) => {
      setConsent('doNotSell', e.target.checked);
    });
  }
}

/**
 * Save consent preferences to storage
 */
function saveConsentPreferences() {
  const analyticsConsent = getConsent('analytics');
  const marketingConsent = getConsent('marketing');
  const doNotSell = getConsent('doNotSell');
  
  store.setItem(CONSENT_KEYS.ANALYTICS, analyticsConsent);
  store.setItem(CONSENT_KEYS.MARKETING, marketingConsent);
  store.setItem(CONSENT_KEYS.COOKIE_CONSENT, true);
  store.setItem(CONSENT_KEYS.DO_NOT_SELL, doNotSell);
  store.setItem(CONSENT_KEYS.LAST_UPDATED, Date.now());
  store.setItem(CONSENT_KEYS.CONSENT_VERSION, CONSENT_VERSION);
  
  console.log('[Consent] Preferences saved:', {
    analytics: analyticsConsent,
    marketing: marketingConsent,
    doNotSell: doNotSell
  });
  
  // Dispatch event for other scripts
  window.dispatchEvent(new CustomEvent('consent-updated', {
    detail: { analytics: analyticsConsent, marketing: marketingConsent }
  }));
}

/**
 * Apply stored consent preferences to the page
 */
function applyStoredConsent() {
  const analytics = getConsent('analytics');
  const marketing = getConsent('marketing');
  const doNotSell = getConsent('doNotSell');
  
  console.log('[Consent] Applying stored preferences:', { analytics, marketing, doNotSell });
  
  // Apply to Google Analytics if present
  if (typeof gtag !== 'undefined') {
    gtag('consent', 'update', {
      'analytics_storage': analytics ? 'granted' : 'denied',
      'ad_storage': marketing ? 'granted' : 'denied',
      'ad_user_data': marketing ? 'granted' : 'denied',
      'ad_personalization': marketing ? 'granted' : 'denied'
    });
  }
  
  // Dispatch event for other tracking scripts
  window.dispatchEvent(new CustomEvent('consent-applied', {
    detail: { analytics, marketing, doNotSell }
  }));
}

/**
 * Check if consent has expired (older than CONSENT_EXPIRY_DAYS)
 * @returns {boolean} - True if expired
 */
function isConsentExpired() {
  const lastUpdated = store.getItem(CONSENT_KEYS.LAST_UPDATED);
  if (!lastUpdated) return true;
  
  const expiryMs = CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - lastUpdated > expiryMs;
}

// ========================================
// PUBLIC API FUNCTIONS
// ========================================

/**
 * Get consent status for a specific type
 * @param {string} type - 'analytics', 'marketing', 'functional', 'doNotSell'
 * @returns {boolean} - True if consented
 */
export function getConsent(type) {
  let key;
  switch (type) {
    case 'analytics':
      key = CONSENT_KEYS.ANALYTICS;
      break;
    case 'marketing':
      key = CONSENT_KEYS.MARKETING;
      break;
    case 'functional':
      key = CONSENT_KEYS.FUNCTIONAL;
      break;
    case 'doNotSell':
      key = CONSENT_KEYS.DO_NOT_SELL;
      break;
    default:
      return false;
  }
  
  const value = store.getItem(key);
  return value !== null ? value : DEFAULT_CONSENT[key];
}

/**
 * Set consent status for a specific type
 * @param {string} type - 'analytics', 'marketing', 'doNotSell'
 * @param {boolean} value - Consent value
 */
export function setConsent(type, value) {
  let key;
  switch (type) {
    case 'analytics':
      key = CONSENT_KEYS.ANALYTICS;
      break;
    case 'marketing':
      key = CONSENT_KEYS.MARKETING;
      break;
    case 'doNotSell':
      key = CONSENT_KEYS.DO_NOT_SELL;
      break;
    default:
      console.warn(`[Consent] Unknown consent type: ${type}`);
      return;
  }
  
  store.setItem(key, value);
  console.log(`[Consent] ${type} consent set to: ${value}`);
}

/**
 * Check if analytics are allowed
 * @returns {boolean} - True if analytics consent granted
 */
export function isAnalyticsAllowed() {
  return getConsent('analytics') === true;
}

/**
 * Check if marketing/tracking is allowed
 * @returns {boolean} - True if marketing consent granted
 */
export function isMarketingAllowed() {
  return getConsent('marketing') === true;
}

/**
 * Handle Do Not Sell request (CCPA)
 * This should be called when a user clicks "Do Not Sell My Info"
 */
export function handleDoNotSell() {
  setConsent('doNotSell', true);
  store.setItem(CONSENT_KEYS.DO_NOT_SELL, true);
  console.log('[Consent] Do Not Sell preference set to true');
  
  // Dispatch event for analytics/ad providers
  window.dispatchEvent(new CustomEvent('do-not-sell', {
    detail: { enabled: true }
  }));
  
  // Show confirmation to user
  showDoNotSellConfirmation();
}

/**
 * Show confirmation for Do Not Sell request
 */
function showDoNotSellConfirmation() {
  const toast = document.createElement('div');
  toast.className = 'consent-toast';
  toast.innerHTML = `
    <div style="position: fixed; bottom: 20px; right: 20px; background: #1a1a24; padding: 12px 20px; border-radius: 8px; border-left: 4px solid #00C4BC; z-index: 10002; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
      <p style="margin: 0; font-size: 14px;">✓ Your "Do Not Sell My Info" preference has been saved.</p>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ========================================
// CCPA FUNCTIONS
// ========================================

/**
 * Detect if user is in California (CCPA region)
 * Uses IP geolocation or browser language as fallback
 * @returns {boolean} - True if user is in California
 */
export function detectCcpaRegion() {
  // Check if region is already stored
  const storedRegion = store.getItem('flashstream_user_region');
  if (storedRegion) {
    return CCPA_REGIONS.includes(storedRegion);
  }
  
  // Check URL parameters for testing
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('ccpa') === 'true') {
    store.setItem('flashstream_user_region', 'CA');
    return true;
  }
  
  // Default to false (not in CCPA region)
  // In production, you would call a geolocation API
  return false;
}

/**
 * Conditionally show CCPA link in footer
 * Call this function to add the link if user is in California
 * @param {string} footerElementId - ID of footer element to append to
 */
export function showCcpaLink(footerElementId = 'footer') {
  if (!detectCcpaRegion()) return;
  
  const footer = document.getElementById(footerElementId);
  if (!footer) return;
  
  const ccpaLink = document.createElement('a');
  ccpaLink.href = '#';
  ccpaLink.textContent = 'Do Not Sell My Personal Information';
  ccpaLink.style.color = '#9ca3af';
  ccpaLink.style.fontSize = '0.75rem';
  ccpaLink.style.textDecoration = 'none';
  ccpaLink.style.marginLeft = '16px';
  ccpaLink.addEventListener('click', (e) => {
    e.preventDefault();
    showConsentModal(true);
    const doNotSellOption = document.getElementById('consent-do-not-sell');
    if (doNotSellOption) {
      doNotSellOption.scrollIntoView({ behavior: 'smooth' });
    }
  });
  
  footer.appendChild(ccpaLink);
}

// ========================================
// RESET CONSENT
// ========================================

/**
 * Reset all consent preferences (for testing or user request)
 */
export function resetConsent() {
  store.setItem(CONSENT_KEYS.ANALYTICS, DEFAULT_CONSENT[CONSENT_KEYS.ANALYTICS]);
  store.setItem(CONSENT_KEYS.MARKETING, DEFAULT_CONSENT[CONSENT_KEYS.MARKETING]);
  store.setItem(CONSENT_KEYS.COOKIE_CONSENT, null);
  store.setItem(CONSENT_KEYS.DO_NOT_SELL, DEFAULT_CONSENT[CONSENT_KEYS.DO_NOT_SELL]);
  store.removeItem(CONSENT_KEYS.LAST_UPDATED);
  
  console.log('[Consent] All consent preferences reset');
  
  // Show modal again
  showConsentModal();
}

// ========================================
// EXPORTS FOR BROWSER GLOBAL
// ========================================

// Create global consent object for use in other scripts
window.FlashStreamConsent = {
  init: initConsent,
  getConsent,
  setConsent,
  isAnalyticsAllowed,
  isMarketingAllowed,
  handleDoNotSell,
  detectCcpaRegion,
  showCcpaLink,
  resetConsent,
  showConsentModal
};

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initConsent();
    });
  } else {
    initConsent();
  }
}

// Default exports
export default {
  initConsent,
  showConsentModal,
  getConsent,
  setConsent,
  isAnalyticsAllowed,
  isMarketingAllowed,
  handleDoNotSell,
  detectCcpaRegion,
  showCcpaLink,
  resetConsent,
  CONSENT_KEYS
};