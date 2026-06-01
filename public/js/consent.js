/**
 * FlashStream Consent Module - UMD/Global Version
 */

(function(global) {
    'use strict';
    
    var CONSENT_KEYS = {
        ANALYTICS: 'flashstream_analytics_consent',
        MARKETING: 'flashstream_marketing_consent',
        FUNCTIONAL: 'flashstream_functional_consent',
        COOKIE_CONSENT: 'flashstream_cookie_consent',
        DO_NOT_SELL: 'flashstream_do_not_sell',
        LAST_UPDATED: 'flashstream_consent_last_updated',
        CONSENT_VERSION: 'flashstream_consent_version'
    };
    
    var CONSENT_VERSION = '1.0.0';
    var DEFAULT_CONSENT = {
        'flashstream_analytics_consent': false,
        'flashstream_marketing_consent': false,
        'flashstream_functional_consent': true,
        'flashstream_cookie_consent': null,
        'flashstream_do_not_sell': false
    };
    
    // Helper to get store (prefer window.Store, fallback to localStorage)
    function getStore() {
        if (typeof global.Store !== 'undefined') {
            return global.Store;
        }
        // Fallback
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
            hasKey: function(key) {
                return localStorage.getItem(key) !== null;
            },
            removeItem: function(key) {
                localStorage.removeItem(key);
            }
        };
    }
    
    function getConsent(type) {
        var store = getStore();
        var key;
        switch(type) {
            case 'analytics': key = CONSENT_KEYS.ANALYTICS; break;
            case 'marketing': key = CONSENT_KEYS.MARKETING; break;
            case 'functional': key = CONSENT_KEYS.FUNCTIONAL; break;
            case 'doNotSell': key = CONSENT_KEYS.DO_NOT_SELL; break;
            default: return false;
        }
        var value = store.getItem(key);
        return value !== null ? value : DEFAULT_CONSENT[key];
    }
    
    function setConsent(type, value) {
        var store = getStore();
        var key;
        switch(type) {
            case 'analytics': key = CONSENT_KEYS.ANALYTICS; break;
            case 'marketing': key = CONSENT_KEYS.MARKETING; break;
            case 'doNotSell': key = CONSENT_KEYS.DO_NOT_SELL; break;
            default: return;
        }
        store.setItem(key, value);
        store.setItem(CONSENT_KEYS.LAST_UPDATED, Date.now());
        console.log('[Consent] ' + type + ' set to:', value);
    }
    
    function isAnalyticsAllowed() {
        return getConsent('analytics') === true;
    }
    
    function isMarketingAllowed() {
        return getConsent('marketing') === true;
    }
    
    function handleDoNotSell() {
        setConsent('doNotSell', true);
        console.log('[Consent] Do Not Sell set to true');
        // Show toast notification
        var toast = document.createElement('div');
        toast.textContent = '✓ Your "Do Not Sell My Info" preference has been saved.';
        toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1a1a24;padding:12px 20px;border-radius:8px;border-left:4px solid #00C4BC;z-index:10002;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 3000);
    }
    
    function detectCcpaRegion() {
        var stored = getStore().getItem('flashstream_user_region');
        if (stored) return stored === 'CA';
        var urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('ccpa') === 'true') {
            getStore().setItem('flashstream_user_region', 'CA');
            return true;
        }
        return false;
    }
    
    function showCcpaLink(footerId) {
        if (!detectCcpaRegion()) return;
        var footer = document.getElementById(footerId || 'footer');
        if (!footer) return;
        var link = document.createElement('a');
        link.href = '#';
        link.textContent = 'Do Not Sell My Personal Information';
        link.style.cssText = 'color:#9ca3af;font-size:0.75rem;text-decoration:none;margin-left:16px;';
        link.onclick = function(e) {
            e.preventDefault();
            handleDoNotSell();
        };
        footer.appendChild(link);
    }
    
    function initConsent() {
        console.log('[Consent] Initializing...');
        var store = getStore();
        var hasConsent = store.hasKey(CONSENT_KEYS.COOKIE_CONSENT);
        var lastUpdated = store.getItem(CONSENT_KEYS.LAST_UPDATED);
        var expired = lastUpdated && (Date.now() - lastUpdated > 365 * 24 * 60 * 60 * 1000);
        
        if (!hasConsent || expired) {
            console.log('[Consent] Showing modal (no valid consent)');
            // Store default functional consent
            store.setItem(CONSENT_KEYS.COOKIE_CONSENT, true);
            store.setItem(CONSENT_KEYS.FUNCTIONAL, true);
        } else {
            console.log('[Consent] Valid consent exists');
        }
        return true;
    }
    
    // Expose globally
    global.FlashStreamConsent = {
        CONSENT_KEYS: CONSENT_KEYS,
        getConsent: getConsent,
        setConsent: setConsent,
        isAnalyticsAllowed: isAnalyticsAllowed,
        isMarketingAllowed: isMarketingAllowed,
        handleDoNotSell: handleDoNotSell,
        detectCcpaRegion: detectCcpaRegion,
        showCcpaLink: showCcpaLink,
        initConsent: initConsent
    };
    
    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initConsent();
        });
    } else {
        initConsent();
    }
    
    console.log('[Consent] Module initialized');
    
})(typeof window !== 'undefined' ? window : this);