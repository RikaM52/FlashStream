/**
 * FlashStream API Client
 * Centralized API communication with auth handling
 * Version: 1.0.0
 */

(function(global) {
    'use strict';

    // ========================================
    // CONFIGURATION
    // ========================================
    
    const WORKER_URL = 'https://flashstream-worker.arirweb.workers.dev';
    const API_BASE = '/api';
    const TMDB_IMG = 'https://image.tmdb.org/t/p/';
    
    // Token refresh state
    let isRefreshing = false;
    let refreshSubscribers = [];

    // ========================================
    // HELPER FUNCTIONS
    // ========================================
    
    function getAuthToken() {
        return localStorage.getItem('flashstream_auth_token') || 
               sessionStorage.getItem('auth_session');
    }

    function setAuthToken(token) {
        if (token) {
            localStorage.setItem('flashstream_auth_token', token);
        }
    }

    function clearAuthToken() {
        localStorage.removeItem('flashstream_auth_token');
        localStorage.removeItem('flashstream_refresh_token');
        localStorage.removeItem('flashstream_user_profile');
        sessionStorage.removeItem('auth_session');
    }

    function onTokenRefreshed(newToken) {
        setAuthToken(newToken);
        refreshSubscribers.forEach(callback => callback(newToken));
        refreshSubscribers = [];
    }

    async function refreshToken() {
        const refreshToken = localStorage.getItem('flashstream_refresh_token');
        if (!refreshToken) return null;
        
        try {
            const response = await fetch(`${WORKER_URL}${API_BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    onTokenRefreshed(data.token);
                    return data.token;
                }
            }
        } catch (e) {
            console.error('[API] Token refresh failed:', e);
        }
        
        clearAuthToken();
        return null;
    }

    // ========================================
    // CORE REQUEST FUNCTION
    // ========================================
    
    /**
     * Core API request function with auth headers and retry logic
     * @param {string} endpoint - API endpoint (starting with /)
     * @param {string} method - HTTP method (GET, POST, PATCH, DELETE)
     * @param {object} body - Request body (for POST/PATCH)
     * @param {object} options - Additional fetch options
     * @returns {Promise<object>} - Response data
     */
    async function apiRequest(endpoint, method = 'GET', body = null, options = {}) {
        const url = `${WORKER_URL}${API_BASE}${endpoint}`;
        const token = getAuthToken();
        
                const headers = {
            'Content-Type': 'application/json',
            'X-FlashStream-Client': 'web',  // Required by worker security
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const fetchOptions = {
            method,
            headers,
            ...options
        };
        
        if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
            fetchOptions.body = JSON.stringify(body);
        }
        
        try {
            let response = await fetch(url, fetchOptions);
            
            // Handle token expiration
            if (response.status === 401 && token) {
                if (!isRefreshing) {
                    isRefreshing = true;
                    const newToken = await refreshToken();
                    isRefreshing = false;
                    
                    if (newToken) {
                        headers['Authorization'] = `Bearer ${newToken}`;
                        fetchOptions.headers = headers;
                        response = await fetch(url, fetchOptions);
                    } else {
                        // Token refresh failed - clear and redirect to login
                        clearAuthToken();
                        window.dispatchEvent(new CustomEvent('auth:expired'));
                        throw new Error('Session expired. Please log in again.');
                    }
                } else {
                    // Wait for token refresh to complete
                    return new Promise((resolve, reject) => {
                        refreshSubscribers.push(async (newToken) => {
                            try {
                                headers['Authorization'] = `Bearer ${newToken}`;
                                fetchOptions.headers = headers;
                                const retryResponse = await fetch(url, fetchOptions);
                                const data = await retryResponse.json();
                                resolve(data);
                            } catch (err) {
                                reject(err);
                            }
                        });
                    });
                }
            }
            
            // Handle empty responses (204 No Content)
            if (response.status === 204) {
                return { success: true };
            }
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || data.error || `API Error: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error(`[API] ${method} ${endpoint} failed:`, error);
            throw error;
        }
    }

    // ========================================
    // HTTP METHOD HELPERS
    // ========================================
    
    async function get(endpoint, params = {}) {
        let url = endpoint;
        if (Object.keys(params).length > 0) {
            const queryParams = new URLSearchParams(params).toString();
            url = `${endpoint}?${queryParams}`;
        }
        return apiRequest(url, 'GET');
    }
    
    async function post(endpoint, body = {}) {
        return apiRequest(endpoint, 'POST', body);
    }
    
    async function patch(endpoint, body = {}) {
        return apiRequest(endpoint, 'PATCH', body);
    }
    
    async function del(endpoint) {
        return apiRequest(endpoint, 'DELETE');
    }

    // ========================================
    // TELEMETRY (Renamed from analytics)
    // ========================================
    
    /**
     * Send telemetry data (soft name for analytics)
     * @param {string} event - Event name
     * @param {object} data - Event data
     */
    async function sendTelemetry(event, data = {}) {
        // Only send if user has consented to analytics
        const consent = global.FlashStreamConsent;
        if (consent && typeof consent.isAnalyticsAllowed === 'function') {
            if (!consent.isAnalyticsAllowed()) {
                return;
            }
        }
        
        try {
            // Fire-and-forget - don't await
            fetch(`${WORKER_URL}${API_BASE}/telemetry`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event, data, timestamp: Date.now() })
            }).catch(() => {});
        } catch (e) {
            // Silent fail
        }
    }

    // ========================================
    // SEARCH & DISCOVERY
    // ========================================
    
    async function search(query, type = 'multi') {
        if (!query || query.length < 2) return { results: [] };
        return get('/search', { q: query, type });
    }
    
    async function discover(filters = {}) {
        return get('/discover', filters);
    }
    
    async function getMovieDetail(id, region = 'US') {
        return get(`/movie/${id}`, { region });
    }
    
    async function getTvDetail(id, region = 'US') {
        return get(`/tv/${id}`, { region });
    }
    
    async function getPersonDetail(id) {
        return get(`/person/${id}`);
    }
    
    async function getCollection(id) {
        return get(`/collection/${id}`);
    }
    
    async function getTrending(type = 'all', window = 'week') {
        return get(`/trending/${type}/${window}`);
    }
    
    async function getUpcoming(page = 1, filters = {}) {
        return get('/upcoming', { page, ...filters });
    }
    
    async function getLeavingSoon(region = 'US', platform = null) {
        const params = { region };
        if (platform) params.platform = platform;
        return get('/leaving-soon', params);
    }
    
    async function getRecommendations(tmdbId, type = 'movie') {
        return get(`/recommendations/${tmdbId}`, { type });
    }

    // ========================================
    // WATCHLIST
    // ========================================
    
    async function getWatchlist() {
        const token = getAuthToken();
        if (!token) return [];
        
        try {
            const data = await get('/watchlist');
            return data.items || [];
        } catch (e) {
            return [];
        }
    }
    
    async function addToWatchlist(tmdbId, type, title, poster, status = 'plan_to_watch') {
        return post('/watchlist', {
            tmdb_id: String(tmdbId),
            type,
            title,
            poster_path: poster,
            status
        });
    }
    
    async function updateWatchlistStatus(tmdbId, status) {
        return patch(`/watchlist/${tmdbId}`, { status });
    }
    
    async function removeFromWatchlist(tmdbId) {
        return del(`/watchlist/${tmdbId}`);
    }

    // ========================================
    // RATINGS
    // ========================================
    
    async function submitRating(tmdbId, rating) {
        if (rating < 0.5 || rating > 10) {
            throw new Error('Rating must be between 0.5 and 10');
        }
        return post('/ratings', { tmdb_id: String(tmdbId), rating });
    }
    
    async function getRatings() {
        return get('/ratings');
    }

    // ========================================
    // FOLLOWS (People/Directors/Actors)
    // ========================================
    
    async function followPerson(personId, personType = 'actor') {
        return post(`/follows/${personId}`, { person_type: personType });
    }
    
    async function unfollowPerson(personId, personType = 'actor') {
        return del(`/follows/${personId}`);
    }
    
    async function getFollowedPeople() {
        return get('/follows');
    }
    
    async function getNewFromFollowed() {
        return get('/new-from-followed');
    }

    // ========================================
    // RECOMMENDATIONS (User-to-User)
    // ========================================
    
    async function submitRecommendation(tmdbId, value = 1) {
        return post(`/recommendations/${tmdbId}`, { value });
    }
    
    async function getRecommendationStats(tmdbId) {
        return get(`/recommendations/${tmdbId}/stats`);
    }

    // ========================================
    // TAGS
    // ========================================
    
    async function submitTag(tmdbId, tagName) {
        return post('/tags', { tmdb_id: String(tmdbId), tag: tagName });
    }
    
    async function voteTag(tagId, voteValue) {
        if (voteValue !== 1 && voteValue !== -1) {
            throw new Error('Vote value must be 1 (up) or -1 (down)');
        }
        return post(`/tags/vote`, { tag_id: tagId, vote: voteValue });
    }
    
    async function getTags(tmdbId) {
        return get(`/tags/${tmdbId}`);
    }

    // ========================================
    // COMMUNITY
    // ========================================
    
    async function submitSentiment(data) {
        return post('/community/sentiment', data);
    }
    
    async function getCommunityPicks(region = null, genre = null) {
        const params = {};
        if (region) params.region = region;
        if (genre) params.genre = genre;
        return get('/community/picks', params);
    }
    
    async function getRegionalSentiment() {
        return get('/community/regional');
    }
    
    async function getActivityFeed(limit = 20, offset = 0) {
        return get('/community/activity', { limit, offset });
    }

    // ========================================
    // METRICS (For analytics - soft names)
    // ========================================
    
    async function recordFilterChange(filters) {
        return sendTelemetry('filter_change', { filters });
    }
    
    async function recordDeadEnd(filters, query) {
        return sendTelemetry('dead_end', { filters, query });
    }
    
    async function recordOutboundClick(platform, tmdbId, position, filters = {}) {
        return sendTelemetry('outbound_click', { platform, tmdb_id: tmdbId, position, filters });
    }
    
    async function recordDwellTime(tmdbId, seconds) {
        if (seconds >= 1) {
            return sendTelemetry('dwell_time', { tmdb_id: tmdbId, seconds });
        }
    }
    
    async function recordTrailerPlay(tmdbId, duration, completed = false) {
        return sendTelemetry('trailer_play', { tmdb_id: tmdbId, duration, completed });
    }
    
    async function recordEpisodeProgress(tmdbId, season, episode, progressPercent = 0) {
        const token = getAuthToken();
        if (!token) return;
        
        try {
            await post('/metrics/episode', {
                tmdb_id: String(tmdbId),
                season,
                episode,
                progress_percent: progressPercent,
                timestamp: Date.now()
            });
        } catch (e) {
            // Silent fail - don't block user experience
        }
    }

    // ========================================
    // AUTH RELATED
    // ========================================
    
    async function login(email, password) {
        const data = await post('/auth/login', { email, password });
        if (data.token) {
            setAuthToken(data.token);
            if (data.refreshToken) {
                localStorage.setItem('flashstream_refresh_token', data.refreshToken);
            }
            if (data.user) {
                localStorage.setItem('flashstream_user_profile', JSON.stringify(data.user));
            }
            window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: data.user } }));
        }
        return data;
    }
    
    async function register(email, password, birthYear) {
        const data = await post('/auth/register', { email, password, birthYear });
        if (data.token) {
            setAuthToken(data.token);
            if (data.refreshToken) {
                localStorage.setItem('flashstream_refresh_token', data.refreshToken);
            }
            if (data.user) {
                localStorage.setItem('flashstream_user_profile', JSON.stringify(data.user));
            }
            window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: data.user } }));
        }
        return data;
    }
    
    async function logout() {
        try {
            await post('/auth/logout');
        } catch (e) {
            // Ignore logout errors
        }
        clearAuthToken();
        window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    
    async function validateSession() {
        const token = getAuthToken();
        if (!token) return false;
        
        try {
            const data = await get('/auth/validate');
            return data.valid === true;
        } catch (e) {
            return false;
        }
    }

    // ========================================
    // VIEWING HISTORY
    // ========================================
    
    async function getViewingHistory() {
        const token = getAuthToken();
        if (!token) return [];
        
        try {
            const data = await get('/history');
            return data.history || [];
        } catch (e) {
            return [];
        }
    }
    
    async function recordView(tmdbId, type, progressSeconds = 0, completed = false) {
        const token = getAuthToken();
        if (!token) return;
        
        try {
            await post('/history', {
                tmdb_id: String(tmdbId),
                type,
                progress_seconds: progressSeconds,
                completed,
                timestamp: Date.now()
            });
        } catch (e) {
            // Silent fail
        }
    }

    // ========================================
    // PERSONALIZED RECOMMENDATIONS
    // ========================================
    
    async function getPersonalizedRecs(options = {}) {
        const token = getAuthToken();
        if (!token) return [];
        
        const params = { limit: options.limit || 12 };
        if (options.includeWatched) params.include_watched = options.includeWatched;
        
        try {
            const data = await get('/personalized', params);
            return data.results || [];
        } catch (e) {
            return [];
        }
    }

    // ========================================
    // EXPORTS
    // ========================================
    
    const apiClient = {
        // Core
        apiRequest,
        get,
        post,
        patch,
        delete: del,
        
        // Telemetry
        sendTelemetry,
        
        // Search & Discovery
        search,
        discover,
        getMovieDetail,
        getTvDetail,
        getPersonDetail,
        getCollection,
        getTrending,
        getUpcoming,
        getLeavingSoon,
        getRecommendations,
        
        // Watchlist
        getWatchlist,
        addToWatchlist,
        updateWatchlistStatus,
        removeFromWatchlist,
        
        // Ratings
        submitRating,
        getRatings,
        
        // Follows
        followPerson,
        unfollowPerson,
        getFollowedPeople,
        getNewFromFollowed,
        
        // User Recommendations
        submitRecommendation,
        getRecommendationStats,
        
        // Tags
        submitTag,
        voteTag,
        getTags,
        
        // Community
        submitSentiment,
        getCommunityPicks,
        getRegionalSentiment,
        getActivityFeed,
        
        // Metrics (soft names)
        recordFilterChange,
        recordDeadEnd,
        recordOutboundClick,
        recordDwellTime,
        recordTrailerPlay,
        recordEpisodeProgress,
        
        // Auth
        login,
        register,
        logout,
        validateSession,
        
        // History
        getViewingHistory,
        recordView,
        
        // Personalized
        getPersonalizedRecs
    };
    
    // Expose globally
    global.apiClient = apiClient;
    global.ApiClient = apiClient;
    
    console.log('[API] Client initialized');
    
})(typeof window !== 'undefined' ? window : this);