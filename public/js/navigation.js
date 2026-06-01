// ========== FLASHSTREAM NAVIGATION COMPONENT ==========
// Version: 2.6 - Fixed rendering

(function(global) {
    'use strict';
    
    console.log('[NAV] Navigation module loading...');
    
    // Helper functions
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    function isUserLoggedIn() {
        return !!(localStorage.getItem('flashstream_auth_token') || sessionStorage.getItem('auth_session'));
    }
    
    function getCurrentUser() {
        try {
            const userStr = localStorage.getItem('flashstream_user_profile');
            if (userStr) {
                return JSON.parse(userStr);
            }
        } catch(e) {}
        const email = localStorage.getItem('user_email') || '';
        return {
            email: email,
            name: email.split('@')[0] || 'User',
            isLoggedIn: isUserLoggedIn()
        };
    }
    
    function getUserRegion() {
        return localStorage.getItem('user_region') || 'US';
    }
    
    // Navbar HTML generator
    function getNavbarHTML(isLoggedIn, user, region) {
        const userEmail = user?.email || '';
        const userName = user?.name || userEmail.split('@')[0] || 'User';
        
        return `
        <nav class="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/5" role="navigation" aria-label="Main navigation">
            <div class="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
                <!-- Logo -->
                <a href="/" class="flex items-center gap-2 text-xl font-bold text-white flex-shrink-0" data-nav-link data-nav-path="/">
                    <img src="/icons/icon-192.png" alt="FlashStream logo" width="32" height="32" class="w-8 h-8">
                    <span class="hidden sm:block">FlashStream</span>
                </a>
                
                <!-- Search Bar -->
                <div class="flex-1 relative max-w-xl mx-auto" id="nav-search-wrap">
                    <div class="relative">
                        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                            <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <input type="search" id="nav-search-input" placeholder="Search movies, TV shows, people…" 
                               class="w-full bg-gray-900 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-accent focus:bg-gray-800 transition-all" 
                               aria-label="Search FlashStream" autocomplete="off">
                    </div>
                    <div id="search-dropdown" hidden class="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-white/10 rounded-xl overflow-hidden z-50 shadow-xl"></div>
                </div>
                
                <!-- Desktop Navigation Links -->
                <div class="hidden md:flex items-center gap-4 text-sm font-medium flex-shrink-0">
                    <a href="/discover" class="text-gray-400 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/discover">Discover</a>
                    <a href="/watchlist" class="text-gray-400 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/watchlist">Watchlist</a>
                    <a href="/leaving-soon" class="text-gray-400 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/leaving-soon">Leaving Soon</a>
                    <a href="/coming-soon" class="text-gray-400 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/coming-soon">Coming Soon</a>
                    <a href="/community" class="text-gray-400 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/community">Community</a>
                    <a href="/about" class="text-gray-400 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/about">About</a>
                </div>
                
                <!-- Right Side Controls -->
                <div class="flex items-center gap-2 flex-shrink-0">
                    <a href="/settings" class="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                        <span class="font-mono text-gray-300" id="region-code">${escapeHtml(region)}</span>
                    </a>
                    
                    <button id="theme-toggle" aria-label="Toggle dark/light mode" class="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                    
                    <button id="mobile-menu-btn" class="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10" aria-label="Menu">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                        </svg>
                    </button>
                </div>
                
                <!-- Desktop Auth Buttons -->
                <div class="hidden md:flex items-center gap-3 ml-2">
                    ${isLoggedIn ? `
                        <span class="text-xs text-gray-400">${escapeHtml(userEmail)}</span>
                        <button id="logout-btn" class="text-sm text-gray-400 hover:text-red-400 transition-colors">Logout</button>
                    ` : `
                        <a href="/login" class="text-sm text-gray-300 hover:text-white transition-colors" data-nav-link data-nav-path="/login">Log In</a>
                        <a href="/signup" class="px-4 py-1.5 text-sm bg-accent text-black font-semibold rounded-lg hover:bg-teal-700 transition-colors" data-nav-link data-nav-path="/signup">Sign Up</a>
                    `}
                </div>
            </div>
            
            <!-- Mobile Menu -->
            <div id="mobile-menu" hidden class="md:hidden border-t border-white/5 bg-black/95 px-4 py-3 flex flex-col gap-3 text-sm font-medium">
                <a href="/discover" class="text-gray-300 hover:text-white py-1.5" data-nav-link data-nav-path="/discover">Discover</a>
                <a href="/watchlist" class="text-gray-300 hover:text-white py-1.5" data-nav-link data-nav-path="/watchlist">Watchlist</a>
                <a href="/leaving-soon" class="text-gray-300 hover:text-white py-1.5" data-nav-link data-nav-path="/leaving-soon">Leaving Soon</a>
                <a href="/coming-soon" class="text-gray-300 hover:text-white py-1.5" data-nav-link data-nav-path="/coming-soon">Coming Soon</a>
                <a href="/community" class="text-gray-300 hover:text-white py-1.5" data-nav-link data-nav-path="/community">Community</a>
                <a href="/about" class="text-gray-300 hover:text-white py-1.5" data-nav-link data-nav-path="/about">About</a>
                <div id="mobile-auth-buttons" class="flex flex-col gap-2 pt-2 border-t border-white/10 mt-1">
                    ${isLoggedIn ? `
                        <span class="text-gray-400 text-center py-1.5 text-sm">${escapeHtml(userEmail)}</span>
                        <button id="logout-btn-mobile" class="text-red-400 hover:text-red-300 py-1.5 text-center">Logout</button>
                    ` : `
                        <a href="/login" class="text-gray-300 hover:text-white py-1.5 text-center">Log In</a>
                        <a href="/signup" class="bg-accent text-black font-semibold py-2 rounded-lg text-center hover:bg-teal-700">Sign Up</a>
                    `}
                </div>
            </div>
        </nav>
        `;
    }
    
    // Logout handler
    function logoutHandler(e) {
        if (e) e.preventDefault();
        localStorage.removeItem('flashstream_auth_token');
        localStorage.removeItem('flashstream_refresh_token');
        localStorage.removeItem('flashstream_user_profile');
        localStorage.removeItem('user_email');
        sessionStorage.removeItem('auth_session');
        window.dispatchEvent(new CustomEvent('auth:logout'));
        window.location.href = '/';
    }
    
    // Render navbar
    function renderNavbar() {
        console.log('[NAV] renderNavbar called');
        
        const navContainer = document.getElementById('app-nav');
        if (!navContainer) {
            console.error('[NAV] #app-nav container not found');
            return;
        }
        
        const isLoggedIn = isUserLoggedIn();
        const user = getCurrentUser();
        const region = getUserRegion();
        
        console.log('[NAV] isLoggedIn:', isLoggedIn);
        console.log('[NAV] region:', region);
        
        navContainer.innerHTML = getNavbarHTML(isLoggedIn, user, region);
        console.log('[NAV] Navbar HTML inserted');
        
        // Attach logout handlers
        const logoutBtn = document.getElementById('logout-btn');
        const logoutBtnMobile = document.getElementById('logout-btn-mobile');
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logoutHandler);
        }
        if (logoutBtnMobile) {
            logoutBtnMobile.addEventListener('click', logoutHandler);
        }
        
        // Mobile menu toggle
        const mobileBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        
        if (mobileBtn && mobileMenu) {
            mobileBtn.addEventListener('click', function() {
                mobileMenu.hidden = !mobileMenu.hidden;
            });
        }
        
        // Theme toggle
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', function() {
                const isDark = document.documentElement.classList.contains('dark');
                if (isDark) {
                    document.documentElement.classList.remove('dark');
                    localStorage.setItem('cs-theme', 'light');
                } else {
                    document.documentElement.classList.add('dark');
                    localStorage.setItem('cs-theme', 'dark');
                }
            });
        }
        
        // Set initial theme
        const savedTheme = localStorage.getItem('cs-theme') || 'dark';
        if (savedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        console.log('[NAV] Navigation initialization complete');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderNavbar);
    } else {
        renderNavbar();
    }
    
    // Export for global use
    global.FlashStreamNav = {
        renderNavbar,
        logoutHandler
    };
    
    console.log('[NAV] Navigation module loaded');
    
})(window);