// ========== FLASHSTREAM NAVIGATION COMPONENT ==========
// Version: 2.5 - Unified navigation component

/**
 * Pure function: Returns navbar HTML based on login state, user, and region
 * @param {boolean} isLoggedIn - Whether user is authenticated
 * @param {object} user - User object with email, name, etc.
 * @param {string} region - User's region code (US, UK, etc.)
 * @returns {string} HTML string for the navbar
 */
function getNavbarHTML(isLoggedIn = false, user = null, region = 'US') {
    const userEmail = user?.email || localStorage.getItem('user_email') || '';
    const userName = user?.name || userEmail.split('@')[0] || 'User';
    
    return `
    <nav class="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/5" role="navigation" aria-label="Main navigation">
        <div class="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
            <!-- Logo -->
            <a href="/" class="flex items-center gap-2 text-xl font-bold text-white flex-shrink-0" aria-label="FlashStream home" data-nav-link data-nav-path="/">
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
                           aria-label="Search FlashStream" aria-autocomplete="list" aria-controls="search-dropdown" autocomplete="off">
                </div>
                <div id="search-dropdown" hidden class="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-white/10 rounded-xl overflow-hidden z-50 shadow-xl" role="listbox" aria-label="Search suggestions"></div>
            </div>
            
            <!-- Desktop Navigation Links -->
            <div class="hidden md:flex items-center gap-4 text-sm font-medium flex-shrink-0" id="desktop-nav-links">
                <a href="/discover" class="text-gray-400 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/discover">Discover</a>
                <a href="/watchlist" class="text-gray-400 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/watchlist">Watchlist</a>
                <a href="/leaving-soon" class="text-gray-400 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/leaving-soon">Leaving Soon</a>
                <a href="/coming-soon" class="text-gray-400 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/coming-soon">Coming Soon</a>
                <a href="/community" class="text-gray-400 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/community">Community</a>
                <a href="/about" class="text-gray-400 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/about">About</a>
            </div>
            
            <!-- Right Side Controls -->
            <div class="flex items-center gap-2 flex-shrink-0">
                <!-- Region Badge -->
                <a href="/settings" id="region-badge" class="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors" aria-label="Change region">
                    <span class="font-mono text-gray-300" id="region-code">${escapeHtml(region)}</span>
                </a>
                
                <!-- Theme Toggle -->
                <button id="theme-toggle" aria-label="Toggle dark/light mode" class="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                    <svg class="w-5 h-5 theme-icon-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    <svg class="w-5 h-5 theme-icon-light hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
                
                <!-- Mobile Menu Button -->
                <button id="mobile-menu-btn" class="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10" aria-label="Menu" aria-expanded="false" aria-controls="mobile-menu">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                    </svg>
                </button>
            </div>
        </div>
        
        <!-- Mobile Menu Panel -->
        <div id="mobile-menu" hidden class="md:hidden border-t border-white/5 bg-black/95 px-4 py-3 flex flex-col gap-3 text-sm font-medium">
            <a href="/discover" class="text-gray-300 hover:text-white py-1.5" data-nav-link data-nav-path="/discover">Discover</a>
            <a href="/watchlist" class="text-gray-300 hover:text-white py-1.5" data-nav-link data-nav-path="/watchlist">Watchlist</a>
            <a href="/leaving-soon" class="text-gray-300 hover:text-white py-1.5" data-nav-link data-nav-path="/leaving-soon">Leaving Soon</a>
            <a href="/coming-soon" class="text-gray-300 hover:text-white py-1.5" data-nav-link data-nav-path="/coming-soon">Coming Soon</a>
            <a href="/community" class="text-gray-300 hover:text-white py-1.5" data-nav-link data-nav-path="/community">Community</a>
            <a href="/about" class="text-gray-300 hover:text-white py-1.5" data-nav-link data-nav-path="/about">About</a>
            <div id="mobile-auth-buttons" class="flex flex-col gap-2 pt-2 border-t border-white/10 mt-1"></div>
        </div>
        
        <!-- Auth Buttons (Desktop) -->
        <div id="desktop-auth-buttons" class="hidden md:flex items-center gap-3 ml-2">
            ${isLoggedIn ? `
                <span class="text-xs text-gray-400" id="user-email-display">${escapeHtml(userEmail)}</span>
                <button id="logout-btn" class="text-sm text-gray-400 hover:text-red-400 transition-colors whitespace-nowrap">Logout</button>
            ` : `
                <a href="/login" class="text-sm text-gray-300 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/login">Log In</a>
                <a href="/signup" class="px-4 py-1.5 text-sm bg-accent text-black font-semibold rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap" data-nav-link data-nav-path="/signup">Sign Up</a>
            `}
        </div>
    </nav>
    `;
}

/**
 * Pure function: Returns footer HTML
 * @returns {string} HTML string for the footer
 */
function getFooterHTML() {
    const currentYear = new Date().getFullYear();
    const region = localStorage.getItem('user_region') || 'US';
    const showCCPA = region === 'US-CA';
    
    return `
    <footer class="border-t border-white/10 py-10 px-4 bg-black" role="contentinfo">
        <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
                <a href="/" class="flex items-center gap-2 text-lg font-bold text-white mb-2">
                    <img src="/icons/icon-192.png" alt="FlashStream logo" width="24" height="24" class="w-6 h-6">
                    <span>FlashStream</span>
                </a>
                <p class="text-xs text-gray-600">Global movie & TV discovery index. Free forever.</p>
            </div>
            <div>
                <h3 class="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Browse</h3>
                <ul class="space-y-2 text-sm">
                    <li><a href="/discover" class="text-gray-400 hover:text-white" data-footer-link>Discover</a></li>
                    <li><a href="/watchlist" class="text-gray-400 hover:text-white" data-footer-link>Watchlist</a></li>
                    <li><a href="/leaving-soon" class="text-gray-400 hover:text-white" data-footer-link>Leaving Soon</a></li>
                    <li><a href="/coming-soon" class="text-gray-400 hover:text-white" data-footer-link>Coming Soon</a></li>
                </ul>
            </div>
            <div>
                <h3 class="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Info</h3>
                <ul class="space-y-2 text-sm">
                    <li><a href="/about" class="text-gray-400 hover:text-white" data-footer-link>About FlashStream</a></li>
                    <li><a href="/vpn-disclaimer" class="text-gray-400 hover:text-white" data-footer-link>VPN Disclaimer</a></li>
                    ${showCCPA ? '<li id="ccpa-footer-link"><a href="/ccpa" class="text-gray-400 hover:text-white" data-footer-link>Do Not Sell My Data</a></li>' : ''}
                    <li><a href="/privacy" class="text-gray-400 hover:text-white" data-footer-link>Privacy Protocol</a></li>
                    <li><a href="/terms" class="text-gray-400 hover:text-white" data-footer-link>Terms of Service</a></li>
                    <li><a href="/settings" class="text-gray-400 hover:text-white" data-footer-link>Settings Dashboard</a></li>
                </ul>
                <p class="text-xs text-gray-600 mt-4">Data powered by TMDB. © ${currentYear} FlashStream</p>
            </div>
        </div>
    </footer>
    `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

/**
 * Check if user is logged in
 */
function isUserLoggedIn() {
    return !!(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_session'));
}

/**
 * Get current user data
 */
function getCurrentUser() {
    const email = localStorage.getItem('user_email') || '';
    return {
        email: email,
        name: email.split('@')[0] || 'User',
        isLoggedIn: isUserLoggedIn()
    };
}

/**
 * Get user region
 */
function getUserRegion() {
    return localStorage.getItem('user_region') || 'US';
}

/**
 * Update navigation for auth state
 * @param {object} user - User object with email, name, etc.
 */
function updateNavForAuth(user) {
    const isLoggedIn = !!(user?.isLoggedIn ?? isUserLoggedIn());
    const userEmail = user?.email || localStorage.getItem('user_email') || '';
    
    // Update desktop auth buttons
    const desktopAuthContainer = document.getElementById('desktop-auth-buttons');
    if (desktopAuthContainer) {
        if (isLoggedIn) {
            desktopAuthContainer.innerHTML = `
                <span class="text-xs text-gray-400" id="user-email-display">${escapeHtml(userEmail)}</span>
                <button id="logout-btn" class="text-sm text-gray-400 hover:text-red-400 transition-colors whitespace-nowrap">Logout</button>
            `;
        } else {
            desktopAuthContainer.innerHTML = `
                <a href="/login" class="text-sm text-gray-300 hover:text-white transition-colors whitespace-nowrap" data-nav-link data-nav-path="/login">Log In</a>
                <a href="/signup" class="px-4 py-1.5 text-sm bg-accent text-black font-semibold rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap" data-nav-link data-nav-path="/signup">Sign Up</a>
            `;
        }
    }
    
    // Update mobile auth buttons
    const mobileAuthContainer = document.getElementById('mobile-auth-buttons');
    if (mobileAuthContainer) {
        if (isLoggedIn) {
            mobileAuthContainer.innerHTML = `
                <span class="text-gray-400 text-center py-1.5 text-sm">${escapeHtml(userEmail)}</span>
                <button id="logout-btn-mobile" class="text-red-400 hover:text-red-300 py-1.5 text-center">Logout</button>
            `;
        } else {
            mobileAuthContainer.innerHTML = `
                <a href="/login" class="text-gray-300 hover:text-white py-1.5 text-center">Log In</a>
                <a href="/signup" class="bg-accent text-black font-semibold py-2 rounded-lg text-center hover:bg-teal-700 transition-colors">Sign Up</a>
            `;
        }
    }
    
    // Re-attach logout handlers
    attachLogoutHandlers();
}

/**
 * Logout handler - clears auth and redirects to home
 */
function logoutHandler() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_email');
    sessionStorage.removeItem('auth_session');
    // Dispatch event so other components know about logout
    window.dispatchEvent(new CustomEvent('auth:logout'));
    window.location.href = '/';
}

/**
 * Attach logout button event listeners
 */
function attachLogoutHandlers() {
    const logoutBtn = document.getElementById('logout-btn');
    const logoutBtnMobile = document.getElementById('logout-btn-mobile');
    
    if (logoutBtn) {
        logoutBtn.removeEventListener('click', logoutHandler);
        logoutBtn.addEventListener('click', logoutHandler);
    }
    
    if (logoutBtnMobile) {
        logoutBtnMobile.removeEventListener('click', logoutHandler);
        logoutBtnMobile.addEventListener('click', logoutHandler);
    }
}

/**
 * Show mobile menu
 */
function showMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileBtn = document.getElementById('mobile-menu-btn');
    
    if (mobileMenu) {
        mobileMenu.hidden = false;
        if (mobileBtn) {
            mobileBtn.setAttribute('aria-expanded', 'true');
        }
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Hide mobile menu
 */
function hideMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileBtn = document.getElementById('mobile-menu-btn');
    
    if (mobileMenu) {
        mobileMenu.hidden = true;
        if (mobileBtn) {
            mobileBtn.setAttribute('aria-expanded', 'false');
        }
        document.body.style.overflow = '';
    }
}

/**
 * Toggle mobile menu
 */
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && mobileMenu.hidden) {
        showMobileMenu();
    } else {
        hideMobileMenu();
    }
}

/**
 * Initialize mobile menu with hamburger and close-on-click-outside
 */
function initMobileMenu() {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (!mobileBtn || !mobileMenu) return;
    
    // Remove existing listeners to avoid duplicates
    const newBtn = mobileBtn.cloneNode(true);
    mobileBtn.parentNode.replaceChild(newBtn, mobileBtn);
    
    newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMobileMenu();
    });
    
    // Close on click outside
    document.addEventListener('click', function(e) {
        if (!mobileMenu.hidden && !mobileMenu.contains(e.target) && !newBtn.contains(e.target)) {
            hideMobileMenu();
        }
    });
    
    // Close on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !mobileMenu.hidden) {
            hideMobileMenu();
        }
    });
    
    // Close menu when a link is clicked
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hideMobileMenu();
        });
    });
}

/**
 * Initialize search dropdown with debounce and keyboard navigation
 */
function initSearchDropdown() {
    const searchInput = document.getElementById('nav-search-input');
    const dropdown = document.getElementById('search-dropdown');
    
    if (!searchInput || !dropdown) return;
    
    let searchDebounce = null;
    let currentResults = [];
    let selectedIndex = -1;
    const WORKER_URL = 'https://flashstream-worker.arirweb.workers.dev';
    const TMDB_IMG = 'https://image.tmdb.org/t/p/';
    const NO_POSTER = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22144%22%20height%3D%22216%22%20viewBox%3D%220%200%20144%20216%22%3E%3Crect%20width%3D%22144%22%20height%3D%22216%22%20fill%3D%22%231f1f29%22%2F%3E%3C%2Fsvg%3E';
    
    async function executeSearch(q) {
        if (q.length < 2) {
            dropdown.hidden = true;
            return;
        }
        
        try {
            const res = await fetch(`${WORKER_URL}/api/search?q=${encodeURIComponent(q)}&type=multi`);
            const data = await res.json();
            currentResults = (data.results || []).filter(r => r.media_type !== 'person').slice(0, 8);
            
            if (!currentResults.length) {
                dropdown.hidden = true;
                return;
            }
            
            let html = '<div class="max-h-96 overflow-y-auto">';
            currentResults.forEach((item, idx) => {
                const title = item.title || item.name || '';
                const year = (item.release_date || item.first_air_date || '').slice(0, 4);
                const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
                const poster = item.poster_path ? `${TMDB_IMG}w92${item.poster_path}` : NO_POSTER;
                
                html += `
                    <a href="/movie-detail?id=${item.id}&type=${type}" 
                       class="flex items-center gap-3 px-4 py-3 hover:bg-white/5 border-b border-white/10 transition-colors search-result"
                       data-index="${idx}"
                       data-id="${item.id}"
                       data-type="${type}">
                        <img src="${escapeHtml(poster)}" alt="" width="28" height="42" class="w-7 h-10 object-cover rounded bg-gray-800" onerror="this.src='${NO_POSTER}'">
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-medium text-white truncate">${escapeHtml(title)}</p>
                            <p class="text-xs text-gray-500">${year || 'TBA'} · ${type === 'tv' ? 'TV Show' : 'Movie'}</p>
                        </div>
                    </a>
                `;
            });
            html += `<a href="/discover?q=${encodeURIComponent(q)}" class="block px-4 py-3 text-xs text-accent hover:bg-white/5 border-t border-white/10 font-semibold text-center">See all results for "${escapeHtml(q)}" →</a>`;
            html += '</div>';
            
            dropdown.innerHTML = html;
            dropdown.hidden = false;
            selectedIndex = -1;
            
            // Add keyboard navigation support
            const resultLinks = dropdown.querySelectorAll('.search-result');
            resultLinks.forEach((link, idx) => {
                link.addEventListener('mouseenter', () => {
                    selectedIndex = idx;
                    updateSelectedHighlight(resultLinks);
                });
            });
            
        } catch(e) {
            dropdown.hidden = true;
        }
    }
    
    function updateSelectedHighlight(links) {
        links.forEach((link, idx) => {
            if (idx === selectedIndex) {
                link.classList.add('bg-white/10');
                link.scrollIntoView({ block: 'nearest' });
            } else {
                link.classList.remove('bg-white/10');
            }
        });
    }
    
    // Input event with debounce
    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        const q = searchInput.value.trim();
        if (q.length < 2) {
            dropdown.hidden = true;
            return;
        }
        searchDebounce = setTimeout(() => executeSearch(q), 300);
    });
    
    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
        const resultLinks = dropdown.querySelectorAll('.search-result');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (resultLinks.length > 0) {
                selectedIndex = Math.min(selectedIndex + 1, resultLinks.length - 1);
                updateSelectedHighlight(resultLinks);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (resultLinks.length > 0) {
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateSelectedHighlight(resultLinks);
            }
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            const selectedLink = resultLinks[selectedIndex];
            if (selectedLink) {
                window.location.href = selectedLink.getAttribute('href');
            }
        } else if (e.key === 'Escape') {
            dropdown.hidden = true;
            searchInput.blur();
        }
    });
    
    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#nav-search-wrap')) {
            dropdown.hidden = true;
        }
    });
    
    // Close on focus out
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (!dropdown.matches(':hover') && !searchInput.matches(':focus')) {
                dropdown.hidden = true;
            }
        }, 200);
    });
}

/**
 * Initialize theme toggle (dark/light mode)
 */
function initThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle');
    if (!themeBtn) return;
    
    const darkIcon = themeBtn.querySelector('.theme-icon-dark');
    const lightIcon = themeBtn.querySelector('.theme-icon-light');
    
    function updateThemeIcons(isDark) {
        if (darkIcon && lightIcon) {
            if (isDark) {
                darkIcon.classList.remove('hidden');
                lightIcon.classList.add('hidden');
            } else {
                darkIcon.classList.add('hidden');
                lightIcon.classList.remove('hidden');
            }
        }
    }
    
    // Set initial theme
    const savedTheme = localStorage.getItem('cs-theme') || 'dark';
    const isDark = savedTheme === 'dark';
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    updateThemeIcons(isDark);
    
    // Remove existing listeners
    const newBtn = themeBtn.cloneNode(true);
    themeBtn.parentNode.replaceChild(newBtn, themeBtn);
    
    newBtn.addEventListener('click', () => {
        const nowDark = document.documentElement.classList.contains('dark');
        if (nowDark) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('cs-theme', 'light');
            updateThemeIcons(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('cs-theme', 'dark');
            updateThemeIcons(true);
        }
        
        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('theme:toggle', { 
            detail: { theme: nowDark ? 'light' : 'dark' }
        }));
    });
}

/**
 * Initialize region badge with change handler
 */
function initRegionBadge() {
    const regionBadge = document.getElementById('region-badge');
    const regionCodeElem = document.getElementById('region-code');
    
    // Update displayed region
    function updateRegionDisplay() {
        const region = getUserRegion();
        if (regionCodeElem) {
            regionCodeElem.textContent = region;
        }
    }
    
    updateRegionDisplay();
    
    // Listen for region changes
    window.addEventListener('region:changed', updateRegionDisplay);
    
    if (regionBadge) {
        regionBadge.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/settings';
        });
    }
}

/**
 * Update active navigation link based on current path
 * @param {string} currentPath - Current page path (defaults to window.location.pathname)
 */
function updateActiveNavLink(currentPath = window.location.pathname) {
    const navLinks = document.querySelectorAll('[data-nav-link]');
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('data-nav-path');
        if (linkPath && linkPath !== '/') {
            if (currentPath === linkPath || (linkPath !== '/' && currentPath.startsWith(linkPath))) {
                link.classList.add('text-accent');
                link.classList.remove('text-gray-400');
            } else {
                link.classList.remove('text-accent');
                link.classList.add('text-gray-400');
            }
        } else if (linkPath === '/' && currentPath === '/') {
            link.classList.add('text-accent');
            link.classList.remove('text-gray-400');
        } else {
            link.classList.remove('text-accent');
            link.classList.add('text-gray-400');
        }
    });
}

/**
 * Initialize footer links (About link, CCPA link)
 */
function initFooterLinks() {
    const footer = document.querySelector('footer');
    if (!footer) return;
    
    // CCPA link is conditionally rendered in getFooterHTML based on region
    // But we also need to handle dynamic region changes
    window.addEventListener('region:changed', () => {
        const region = getUserRegion();
        const showCCPA = region === 'US-CA';
        const existingCCPALink = document.getElementById('ccpa-footer-link');
        
        if (showCCPA && !existingCCPALink) {
            // Add CCPA link to the info section
            const infoSection = footer.querySelector('div:last-child ul');
            if (infoSection) {
                const ccpaLi = document.createElement('li');
                ccpaLi.id = 'ccpa-footer-link';
                ccpaLi.innerHTML = '<a href="/ccpa" class="text-gray-400 hover:text-white" data-footer-link>Do Not Sell My Data</a>';
                // Insert before the last item
                const lastItem = infoSection.children[infoSection.children.length - 1];
                infoSection.insertBefore(ccpaLi, lastItem);
            }
        } else if (!showCCPA && existingCCPALink) {
            existingCCPALink.remove();
        }
    });
}

/**
 * Attach all navigation event listeners after DOM insertion
 */
function attachNavEventListeners() {
    // Re-attach all component initializations
    initMobileMenu();
    initSearchDropdown();
    initThemeToggle();
    initRegionBadge();
    updateActiveNavLink();
    attachLogoutHandlers();
    initFooterLinks();
}

/**
 * Render the complete navbar (main entry point)
 * @returns {HTMLElement} The nav container element
 */
function renderNavbar() {
    const navContainer = document.getElementById('app-nav');
    if (!navContainer) {
        console.error('Navigation container (#app-nav) not found');
        return null;
    }
    
    const isLoggedIn = isUserLoggedIn();
    const user = getCurrentUser();
    const region = getUserRegion();
    
    // Inject navbar HTML
    navContainer.innerHTML = getNavbarHTML(isLoggedIn, user, region);
    
    // Inject footer if footer container exists
    const footerContainer = document.getElementById('app-footer');
    if (footerContainer) {
        footerContainer.innerHTML = getFooterHTML();
    } else if (!document.querySelector('footer')) {
        // If no footer container, append footer after main content
        const main = document.querySelector('main');
        if (main && !document.querySelector('footer')) {
            const footerDiv = document.createElement('div');
            footerDiv.id = 'app-footer';
            main.insertAdjacentHTML('afterend', getFooterHTML());
        }
    }
    
    // Attach all event listeners
    attachNavEventListeners();
    
    return navContainer;
}

/**
 * Re-render navigation (useful after auth state changes)
 */
function reRenderNav() {
    const navContainer = document.getElementById('app-nav');
    if (!navContainer) return;
    
    const isLoggedIn = isUserLoggedIn();
    const user = getCurrentUser();
    const region = getUserRegion();
    
    // Update auth buttons without full re-render
    updateNavForAuth(user);
    
    // Update region display
    const regionCodeElem = document.getElementById('region-code');
    if (regionCodeElem) {
        regionCodeElem.textContent = region;
    }
    
    // Update active nav link
    updateActiveNavLink();
}

// Listen for auth events
window.addEventListener('auth:login', () => {
    reRenderNav();
});

window.addEventListener('auth:logout', () => {
    reRenderNav();
});

// Listen for region changes
window.addEventListener('region:changed', () => {
    const regionCodeElem = document.getElementById('region-code');
    if (regionCodeElem) {
        regionCodeElem.textContent = getUserRegion();
    }
    reRenderNav();
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderNavbar);
} else {
    renderNavbar();
}

// Export for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderNavbar,
        reRenderNav,
        showMobileMenu,
        hideMobileMenu,
        updateActiveNavLink,
        logoutHandler,
        updateNavForAuth,
        getNavbarHTML,
        attachNavEventListeners,
        initFooterLinks
    };
}