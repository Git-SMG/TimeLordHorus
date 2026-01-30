// TimeLord Browser - Main Application
class TimeLordBrowser {
    constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.tabCounter = 0;
        this.db = null;
        this.settings = {
            homepage: 'about:home',
            searchEngine: 'google',
            saveHistory: true,
            autoTheme: false,
            theme: 'light'
        };

        this.searchEngines = {
            google: 'https://www.google.com/search?q=',
            duckduckgo: 'https://duckduckgo.com/?q=',
            bing: 'https://www.bing.com/search?q=',
            brave: 'https://search.brave.com/search?q='
        };

        this.init();
    }

    async init() {
        await this.initDatabase();
        this.loadSettings();
        this.applyTheme();
        this.setupEventListeners();
        this.createNewTab();

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(() => console.log('Service Worker registered'))
                .catch(err => console.error('Service Worker registration failed:', err));
        }

        // Handle install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.showToast('Install TimeLord Browser for offline access!', 'info');
        });
    }

    // Database Management
    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TimeLordBrowserDB', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('bookmarks')) {
                    const bookmarkStore = db.createObjectStore('bookmarks', { keyPath: 'id', autoIncrement: true });
                    bookmarkStore.createIndex('url', 'url', { unique: false });
                    bookmarkStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('history')) {
                    const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
                    historyStore.createIndex('url', 'url', { unique: false });
                    historyStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    // Settings Management
    async loadSettings() {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        const request = store.getAll();

        request.onsuccess = () => {
            const savedSettings = request.result;
            savedSettings.forEach(setting => {
                this.settings[setting.key] = setting.value;
            });
            this.applySettings();
        };
    }

    async saveSetting(key, value) {
        this.settings[key] = value;
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        store.put({ key, value });
    }

    applySettings() {
        // Apply search engine
        document.getElementById('searchEngineSelect').value = this.settings.searchEngine;

        // Apply homepage
        document.getElementById('homePageInput').value = this.settings.homepage;

        // Apply history setting
        document.getElementById('saveHistory').checked = this.settings.saveHistory;

        // Apply auto theme
        document.getElementById('autoTheme').checked = this.settings.autoTheme;
    }

    // Theme Management
    applyTheme() {
        const theme = this.settings.theme;
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    toggleTheme() {
        const currentTheme = this.settings.theme;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.saveSetting('theme', newTheme);
        this.applyTheme();
        this.showToast(`Theme changed to ${newTheme} mode`, 'success');
    }

    // Tab Management
    createNewTab(url = null) {
        const tabId = `tab-${++this.tabCounter}`;
        const tab = {
            id: tabId,
            title: 'New Tab',
            url: url || 'about:home',
            icon: '🌐',
            history: [],
            historyIndex: -1
        };

        this.tabs.push(tab);
        this.renderTab(tab);
        this.renderTabContent(tab);
        this.switchToTab(tabId);

        if (url) {
            this.navigateTab(tabId, url);
        }
    }

    renderTab(tab) {
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tabId = tab.id;
        tabElement.innerHTML = `
            <span class="tab-icon">${tab.icon}</span>
            <span class="tab-title">${tab.title}</span>
            <button class="tab-close">✕</button>
        `;

        tabElement.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                this.switchToTab(tab.id);
            }
        });

        tabElement.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(tab.id);
        });

        document.getElementById('tabsContainer').appendChild(tabElement);
    }

    renderTabContent(tab) {
        const contentElement = document.createElement('div');
        contentElement.className = 'tab-content';
        contentElement.dataset.tabId = tab.id;

        if (tab.url === 'about:home') {
            const welcomeScreen = document.getElementById('welcomeScreen').cloneNode(true);
            welcomeScreen.classList.add('active');
            welcomeScreen.id = `welcome-${tab.id}`;

            // Add click handlers to quick links
            welcomeScreen.querySelectorAll('.quick-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const url = link.dataset.url;
                    this.navigateTab(tab.id, url);
                });
            });

            contentElement.appendChild(welcomeScreen);
        } else {
            contentElement.innerHTML = `<iframe class="browser-frame" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" src="${tab.url}"></iframe>`;
        }

        document.getElementById('contentArea').appendChild(contentElement);
    }

    switchToTab(tabId) {
        // Update active tab
        this.activeTabId = tabId;

        // Update tab UI
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tabId === tabId);
        });

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tabId === tabId);
        });

        // Update address bar and navigation
        const tab = this.tabs.find(t => t.id === tabId);
        if (tab) {
            this.updateAddressBar(tab);
            this.updateNavigationButtons(tab);
        }
    }

    closeTab(tabId) {
        const tabIndex = this.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        // Remove tab from array
        this.tabs.splice(tabIndex, 1);

        // Remove tab elements
        document.querySelector(`[data-tab-id="${tabId}"].tab`)?.remove();
        document.querySelector(`[data-tab-id="${tabId}"].tab-content`)?.remove();

        // If closing active tab, switch to another
        if (this.activeTabId === tabId) {
            if (this.tabs.length > 0) {
                const newActiveTab = this.tabs[Math.max(0, tabIndex - 1)];
                this.switchToTab(newActiveTab.id);
            } else {
                this.createNewTab();
            }
        }
    }

    // Navigation
    navigateTab(tabId, url) {
        const tab = this.tabs.find(t => t.id === tabId);
        if (!tab) return;

        // Validate and process URL
        url = this.processUrl(url);

        // Handle special URLs
        if (url === 'about:home') {
            this.navigateToHome(tab);
            return;
        }

        // Update tab history
        if (tab.historyIndex < tab.history.length - 1) {
            tab.history = tab.history.slice(0, tab.historyIndex + 1);
        }
        tab.history.push(url);
        tab.historyIndex = tab.history.length - 1;

        // Update tab
        tab.url = url;
        this.updateTabContent(tab);
        this.updateAddressBar(tab);
        this.updateNavigationButtons(tab);

        // Save to history
        if (this.settings.saveHistory) {
            this.addToHistory(url, tab.title);
        }

        // Update tab title (simplified - in real browser would get from page)
        setTimeout(() => {
            tab.title = this.getPageTitle(url);
            this.updateTabTitle(tab);
        }, 1000);
    }

    navigateToHome(tab) {
        tab.url = 'about:home';
        tab.title = 'New Tab';
        this.updateTabContent(tab);
        this.updateTabTitle(tab);
        this.updateAddressBar(tab);
    }

    processUrl(input) {
        input = input.trim();

        // Check if it's a special URL
        if (input.startsWith('about:')) {
            return input;
        }

        // Check if it's a valid URL
        if (this.isValidUrl(input)) {
            return input.startsWith('http') ? input : `https://${input}`;
        }

        // Treat as search query
        const searchEngine = this.searchEngines[this.settings.searchEngine];
        return searchEngine + encodeURIComponent(input);
    }

    isValidUrl(string) {
        try {
            // Check if it has a dot and no spaces
            if (string.includes('.') && !string.includes(' ')) {
                new URL(string.startsWith('http') ? string : `https://${string}`);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    updateTabContent(tab) {
        const contentElement = document.querySelector(`[data-tab-id="${tab.id}"].tab-content`);
        if (!contentElement) return;

        if (tab.url === 'about:home') {
            contentElement.innerHTML = '';
            const welcomeScreen = document.getElementById('welcomeScreen').cloneNode(true);
            welcomeScreen.classList.add('active');
            welcomeScreen.id = `welcome-${tab.id}`;

            welcomeScreen.querySelectorAll('.quick-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const url = link.dataset.url;
                    this.navigateTab(tab.id, url);
                });
            });

            contentElement.appendChild(welcomeScreen);
        } else {
            contentElement.innerHTML = `<iframe class="browser-frame" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox allow-top-navigation" src="${tab.url}"></iframe>`;
        }
    }

    updateTabTitle(tab) {
        const tabElement = document.querySelector(`[data-tab-id="${tab.id}"].tab`);
        if (tabElement) {
            tabElement.querySelector('.tab-title').textContent = tab.title;
        }
    }

    updateAddressBar(tab) {
        const addressBar = document.getElementById('addressBar');
        addressBar.value = tab.url === 'about:home' ? '' : tab.url;

        // Update protocol indicator
        const protocolIndicator = document.getElementById('protocolIndicator');
        if (tab.url.startsWith('https://')) {
            protocolIndicator.textContent = '🔒';
            protocolIndicator.title = 'Secure connection';
        } else if (tab.url.startsWith('http://')) {
            protocolIndicator.textContent = '⚠️';
            protocolIndicator.title = 'Not secure';
        } else {
            protocolIndicator.textContent = '🌐';
            protocolIndicator.title = 'Browser page';
        }
    }

    updateNavigationButtons(tab) {
        const backBtn = document.getElementById('backBtn');
        const forwardBtn = document.getElementById('forwardBtn');

        backBtn.disabled = tab.historyIndex <= 0;
        forwardBtn.disabled = tab.historyIndex >= tab.history.length - 1;
    }

    getPageTitle(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch {
            return 'Page';
        }
    }

    goBack() {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (!tab || tab.historyIndex <= 0) return;

        tab.historyIndex--;
        tab.url = tab.history[tab.historyIndex];
        this.updateTabContent(tab);
        this.updateAddressBar(tab);
        this.updateNavigationButtons(tab);
    }

    goForward() {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (!tab || tab.historyIndex >= tab.history.length - 1) return;

        tab.historyIndex++;
        tab.url = tab.history[tab.historyIndex];
        this.updateTabContent(tab);
        this.updateAddressBar(tab);
        this.updateNavigationButtons(tab);
    }

    refresh() {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (!tab) return;

        this.updateTabContent(tab);
        this.showToast('Page refreshed', 'info');
    }

    goHome() {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (!tab) return;

        const homepage = this.settings.homepage;
        if (homepage === 'about:home') {
            this.navigateToHome(tab);
        } else {
            this.navigateTab(this.activeTabId, homepage);
        }
    }

    // Bookmark Management
    async addBookmark(url, title) {
        const bookmark = {
            url,
            title,
            timestamp: Date.now()
        };

        const transaction = this.db.transaction(['bookmarks'], 'readwrite');
        const store = transaction.objectStore('bookmarks');

        return new Promise((resolve, reject) => {
            const request = store.add(bookmark);
            request.onsuccess = () => {
                this.showToast('Bookmark added!', 'success');
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async getBookmarks() {
        const transaction = this.db.transaction(['bookmarks'], 'readonly');
        const store = transaction.objectStore('bookmarks');

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteBookmark(id) {
        const transaction = this.db.transaction(['bookmarks'], 'readwrite');
        const store = transaction.objectStore('bookmarks');

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => {
                this.showToast('Bookmark deleted', 'info');
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async showBookmarks() {
        const bookmarks = await this.getBookmarks();
        const sidebar = document.getElementById('sidebar');
        const sidebarTitle = document.getElementById('sidebarTitle');
        const sidebarContent = document.getElementById('sidebarContent');

        sidebarTitle.textContent = 'Bookmarks';

        if (bookmarks.length === 0) {
            sidebarContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⭐</div>
                    <div class="empty-state-text">No bookmarks yet</div>
                </div>
            `;
        } else {
            sidebarContent.innerHTML = bookmarks.map(bookmark => `
                <div class="bookmark-item" data-bookmark-id="${bookmark.id}">
                    <span class="item-icon">⭐</span>
                    <div class="item-details">
                        <div class="item-title">${bookmark.title}</div>
                        <div class="item-url">${bookmark.url}</div>
                    </div>
                    <button class="item-delete" data-bookmark-id="${bookmark.id}">🗑️</button>
                </div>
            `).join('');

            // Add click handlers
            sidebarContent.querySelectorAll('.bookmark-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('item-delete')) {
                        const bookmark = bookmarks.find(b => b.id === parseInt(item.dataset.bookmarkId));
                        if (bookmark) {
                            this.navigateTab(this.activeTabId, bookmark.url);
                            sidebar.classList.remove('open');
                        }
                    }
                });
            });

            sidebarContent.querySelectorAll('.item-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.bookmarkId);
                    await this.deleteBookmark(id);
                    this.showBookmarks();
                });
            });
        }

        sidebar.classList.add('open');
    }

    // History Management
    async addToHistory(url, title) {
        const historyItem = {
            url,
            title,
            timestamp: Date.now()
        };

        const transaction = this.db.transaction(['history'], 'readwrite');
        const store = transaction.objectStore('history');
        store.add(historyItem);
    }

    async getHistory() {
        const transaction = this.db.transaction(['history'], 'readonly');
        const store = transaction.objectStore('history');

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const history = request.result;
                // Sort by timestamp descending
                history.sort((a, b) => b.timestamp - a.timestamp);
                resolve(history);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async clearHistory() {
        const transaction = this.db.transaction(['history'], 'readwrite');
        const store = transaction.objectStore('history');

        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => {
                this.showToast('History cleared', 'success');
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async showHistory() {
        const history = await this.getHistory();
        const sidebar = document.getElementById('sidebar');
        const sidebarTitle = document.getElementById('sidebarTitle');
        const sidebarContent = document.getElementById('sidebarContent');

        sidebarTitle.textContent = 'History';

        if (history.length === 0) {
            sidebarContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📜</div>
                    <div class="empty-state-text">No history yet</div>
                </div>
            `;
        } else {
            sidebarContent.innerHTML = history.map(item => `
                <div class="history-item" data-url="${item.url}">
                    <span class="item-icon">🌐</span>
                    <div class="item-details">
                        <div class="item-title">${item.title}</div>
                        <div class="item-url">${item.url}</div>
                    </div>
                </div>
            `).join('');

            // Add click handlers
            sidebarContent.querySelectorAll('.history-item').forEach(item => {
                item.addEventListener('click', () => {
                    const url = item.dataset.url;
                    this.navigateTab(this.activeTabId, url);
                    sidebar.classList.remove('open');
                });
            });
        }

        sidebar.classList.add('open');
    }

    // Toast Notifications
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Archives Panel
    openArchives() {
        document.getElementById('archivesPanel').classList.add('open');
        document.getElementById('sidebar').classList.remove('open');
        this.showToast('Browse free internet archives', 'info');
    }

    closeArchives() {
        document.getElementById('archivesPanel').classList.remove('open');
    }

    filterArchives(searchTerm) {
        const categories = document.querySelectorAll('.archive-category');
        const searchLower = searchTerm.toLowerCase();

        if (!searchTerm) {
            // Show all categories and links
            categories.forEach(category => {
                category.style.display = 'block';
                const links = category.querySelectorAll('.archive-link');
                links.forEach(link => link.style.display = 'flex');
            });
            return;
        }

        categories.forEach(category => {
            const links = category.querySelectorAll('.archive-link');
            let hasVisibleLinks = false;

            links.forEach(link => {
                const name = link.querySelector('.link-name').textContent.toLowerCase();
                const desc = link.querySelector('.link-desc').textContent.toLowerCase();
                const categoryTitle = category.querySelector('.category-title').textContent.toLowerCase();

                if (name.includes(searchLower) || desc.includes(searchLower) || categoryTitle.includes(searchLower)) {
                    link.style.display = 'flex';
                    hasVisibleLinks = true;
                } else {
                    link.style.display = 'none';
                }
            });

            // Hide category if no links match
            category.style.display = hasVisibleLinks ? 'block' : 'none';
        });
    }

    // Dashboard Panel
    openDashboard() {
        document.getElementById('dashboardPanel').classList.add('open');
        this.updateDashboardStats();
        this.showToast('Dashboard opened', 'info');
    }

    closeDashboard() {
        document.getElementById('dashboardPanel').classList.remove('open');
    }

    updateDashboardStats() {
        // Update bookmarks count
        this.db.getBookmarks().then(bookmarks => {
            document.getElementById('statBookmarks').textContent = bookmarks.length;
        });

        // Update history count
        this.db.getHistory().then(history => {
            document.getElementById('statHistory').textContent = history.length;
        });

        // Update downloads count
        const downloads = JSON.parse(localStorage.getItem('timelord_downloads') || '[]');
        document.getElementById('statDownloads').textContent = downloads.length;

        // Update active tabs count
        document.getElementById('statTabs').textContent = this.tabs.length;
    }

    filterDashboard(searchTerm) {
        const categories = document.querySelectorAll('.dashboard-category');
        const featureCards = document.querySelectorAll('.feature-card');
        const searchLower = searchTerm.toLowerCase();

        if (!searchTerm) {
            // Show all categories and cards
            categories.forEach(category => category.classList.remove('hidden'));
            featureCards.forEach(card => card.classList.remove('hidden'));
            return;
        }

        // Filter feature cards
        featureCards.forEach(card => {
            const name = card.querySelector('.feature-name').textContent.toLowerCase();
            const desc = card.querySelector('.feature-desc').textContent.toLowerCase();

            if (name.includes(searchLower) || desc.includes(searchLower)) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });

        // Hide/show categories based on visible cards
        categories.forEach(category => {
            const visibleCards = category.querySelectorAll('.feature-card:not(.hidden)');
            if (visibleCards.length > 0) {
                category.classList.remove('hidden');
            } else {
                category.classList.add('hidden');
            }
        });
    }

    handleFeatureCardClick(feature) {
        this.closeDashboard();

        const featureActions = {
            'editors': () => this.openEditors(),
            'coderunner': () => this.openCodeRunner(),
            'tabgroups': () => this.openTabGroups(),
            'filemanager': () => this.openFileManager(),
            'downloads': () => this.openDownloadManager(),
            'bluedrop': () => this.openBlueDrop(),
            'qrcode': () => this.showQRCode(),
            'splitview': () => this.toggleSplitView(),
            'reading': () => this.enableReadingMode(),
            'adblocker': () => this.openAdBlocker(),
            'archives': () => this.openArchives(),
            'bookmarks': () => this.openSidebar('bookmarks'),
            'history': () => this.openSidebar('history'),
            'screenshot': () => this.takeScreenshot(),
            'encryption': () => {
                document.getElementById('settingsBtn').click();
                setTimeout(() => {
                    const encryptionSection = document.querySelector('.setting-group h3');
                    if (encryptionSection && encryptionSection.textContent.includes('Encryption')) {
                        encryptionSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 100);
            }
        };

        const action = featureActions[feature];
        if (action) {
            action();
        }
    }

    // Editors Panel
    openEditors() {
        document.getElementById('editorsPanel').classList.add('open');
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('archivesPanel').classList.remove('open');
        this.showToast('Document Editor opened', 'info');
    }

    closeEditors() {
        document.getElementById('editorsPanel').classList.remove('open');
    }

    // Event Listeners
    setupEventListeners() {
        // New Tab
        document.getElementById('newTabBtn').addEventListener('click', () => {
            this.createNewTab();
        });

        // Navigation
        document.getElementById('backBtn').addEventListener('click', () => {
            this.goBack();
        });

        document.getElementById('forwardBtn').addEventListener('click', () => {
            this.goForward();
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refresh();
        });

        document.getElementById('homeBtn').addEventListener('click', () => {
            this.goHome();
        });

        // Address Bar
        const addressBar = document.getElementById('addressBar');
        const goBtn = document.getElementById('goBtn');

        goBtn.addEventListener('click', () => {
            const url = addressBar.value;
            if (url) {
                this.navigateTab(this.activeTabId, url);
            }
        });

        addressBar.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const url = addressBar.value;
                if (url) {
                    this.navigateTab(this.activeTabId, url);
                }
            }
        });

        // Bookmarks
        document.getElementById('bookmarkBtn').addEventListener('click', async () => {
            const tab = this.tabs.find(t => t.id === this.activeTabId);
            if (tab && tab.url !== 'about:home') {
                await this.addBookmark(tab.url, tab.title);
            }
        });

        document.getElementById('historyBtn').addEventListener('click', () => {
            this.showHistory();
        });

        // Archives
        document.getElementById('archivesBtn').addEventListener('click', () => {
            this.openArchives();
        });

        document.getElementById('closeArchives').addEventListener('click', () => {
            this.closeArchives();
        });

        // Archives search functionality
        document.getElementById('archivesSearch').addEventListener('input', (e) => {
            this.filterArchives(e.target.value);
        });

        // Archive links navigation within browser
        document.addEventListener('click', (e) => {
            const archiveLink = e.target.closest('.archive-link[data-navigate="true"]');
            if (archiveLink) {
                e.preventDefault();
                const url = archiveLink.getAttribute('href');
                if (url) {
                    this.navigateTab(this.activeTabId, url);
                    this.closeArchives();
                }
            }
        });

        // Dashboard
        document.getElementById('dashboardBtn').addEventListener('click', () => {
            this.openDashboard();
        });

        document.getElementById('closeDashboard').addEventListener('click', () => {
            this.closeDashboard();
        });

        // Dashboard search functionality
        document.getElementById('dashboardSearch').addEventListener('input', (e) => {
            this.filterDashboard(e.target.value);
        });

        // Feature card clicks
        document.addEventListener('click', (e) => {
            const featureCard = e.target.closest('.feature-card');
            if (featureCard) {
                const feature = featureCard.getAttribute('data-feature');
                if (feature) {
                    this.handleFeatureCardClick(feature);
                }
            }
        });

        // Editors
        document.getElementById('editorsBtn').addEventListener('click', () => {
            this.openEditors();
        });

        document.getElementById('closeEditors').addEventListener('click', () => {
            this.closeEditors();
        });

        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => {
            document.getElementById('settingsPanel').classList.add('open');
        });

        document.getElementById('closeSettings').addEventListener('click', () => {
            document.getElementById('settingsPanel').classList.remove('open');
        });

        document.getElementById('saveHomePage').addEventListener('click', () => {
            const homepage = document.getElementById('homePageInput').value;
            this.saveSetting('homepage', homepage);
            this.showToast('Homepage saved', 'success');
        });

        document.getElementById('searchEngineSelect').addEventListener('change', (e) => {
            this.saveSetting('searchEngine', e.target.value);
            this.showToast('Search engine updated', 'success');
        });

        document.getElementById('saveHistory').addEventListener('change', (e) => {
            this.saveSetting('saveHistory', e.target.checked);
        });

        document.getElementById('autoTheme').addEventListener('change', (e) => {
            this.saveSetting('autoTheme', e.target.checked);
            if (e.target.checked) {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                this.saveSetting('theme', prefersDark ? 'dark' : 'light');
                this.applyTheme();
            }
        });

        document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all history?')) {
                await this.clearHistory();
            }
        });

        document.getElementById('clearBookmarksBtn').addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all bookmarks?')) {
                const transaction = this.db.transaction(['bookmarks'], 'readwrite');
                const store = transaction.objectStore('bookmarks');
                store.clear();
                this.showToast('Bookmarks cleared', 'success');
            }
        });

        // Theme Toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Sidebar
        document.getElementById('closeSidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
        });

        // Quick access to bookmarks from action bar
        const bookmarkBtn = document.getElementById('bookmarkBtn');
        bookmarkBtn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showBookmarks();
        });

        // Settings panel backdrop click
        document.getElementById('settingsPanel').addEventListener('click', (e) => {
            if (e.target.id === 'settingsPanel') {
                document.getElementById('settingsPanel').classList.remove('open');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + T: New tab
            if ((e.ctrlKey || e.metaKey) && e.key === 't') {
                e.preventDefault();
                this.createNewTab();
            }

            // Ctrl/Cmd + W: Close tab
            if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
                e.preventDefault();
                if (this.tabs.length > 1) {
                    this.closeTab(this.activeTabId);
                }
            }

            // Ctrl/Cmd + R: Refresh
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                this.refresh();
            }

            // Ctrl/Cmd + L: Focus address bar
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                addressBar.select();
            }
        });
    }
}

// Initialize browser when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.browser = new TimeLordBrowser();
});
