/* app.js — SPA Router, utils, home page */
'use strict';

// ── Utilities (global) ───────────────────────────────────────────────────────

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function pagination(total, page, limit, callbackName) {
  if (total <= limit) return '';
  const pages = Math.ceil(total / limit);
  let html = '<div class="pagination">';
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn${i === page ? ' active' : ''}" onclick="${callbackName}(${i})">${i}</button>`;
  }
  return html + '</div>';
}

function openGenericModal(title, content) {
  document.getElementById('genericModalTitle').textContent = title;
  document.getElementById('genericModalContent').innerHTML = content;
  document.getElementById('genericModal').classList.remove('hidden');
}

function closeGenericModal() {
  document.getElementById('genericModal').classList.add('hidden');
}

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type}`;
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;max-width:340px;box-shadow:0 4px 16px rgba(0,0,0,.2)';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

window.esc = esc;
window.fmtDate = fmtDate;
window.fmtTime = fmtTime;
window.debounce = debounce;
window.pagination = pagination;
window.openGenericModal = openGenericModal;
window.closeGenericModal = closeGenericModal;
window.showToast = showToast;

// ── SPA Router ───────────────────────────────────────────────────────────────

const App = (() => {
  let _unreadInterval = null;

  function getRoute() {
    const hash = location.hash || '#/';
    const parts = hash.replace('#/', '').split('/').filter(Boolean);
    return { page: parts[0] || 'home', sub: parts[1] || null };
  }

  function navigate(path) {
    location.hash = path;
  }

  async function render() {
    const root = document.getElementById('appRoot');
    if (!root) return;

    root.innerHTML = '<div class="spinner"></div>';

    const { page, sub } = getRoute();

    // Highlight active nav link
    document.querySelectorAll('.nav-links a[data-link]').forEach(a => {
      const linkPage = a.getAttribute('href').replace('#/', '').split('/')[0];
      a.classList.toggle('active', linkPage === page);
    });

    let html = '';
    let bindFn = null;

    switch (page) {
      case 'home':
      case '':
        html = await renderHome();
        bindFn = bindHomeEvents;
        break;

      case 'resources':
        html = await Resources.render();
        bindFn = (r) => Resources.bindEvents(r);
        break;

      case 'board':
        html = await Board.render();
        bindFn = (r) => Board.bindEvents(r);
        break;

      case 'messages':
        html = await Messages.render(sub);
        bindFn = (r) => Messages.bindEvents(r);
        break;

      case 'bazaar':
        html = await Bazaar.render(sub || 'browse');
        bindFn = (r) => Bazaar.bindEvents(r);
        break;

      case 'admin':
        html = await Admin.render();
        bindFn = (r) => Admin.bindEvents(r);
        break;

      case 'profile':
        html = await Auth.renderProfile();
        bindFn = (r) => Auth.bindProfileEvents(r);
        break;

      default:
        html = `<div class="empty-state"><div class="empty-icon">🗺️</div><div class="empty-text">Page not found</div><button class="btn btn-primary" onclick="App.navigate('#/')">Go Home</button></div>`;
    }

    root.innerHTML = html;
    if (bindFn) bindFn(root);
  }

  // ── Home Page ─────────────────────────────────────────────────────────────

  async function renderHome() {
    const user = Auth.getUser();

    // Fetch quick preview data in parallel
    let recentPosts = [], recentListings = [], featuredResources = [];
    try {
      const [postsData, listingsData, resData] = await Promise.all([
        api.get('/board?limit=4'),
        api.get('/bazaar?limit=4'),
        api.get('/resources?limit=6'),
      ]);
      recentPosts      = postsData.posts;
      recentListings   = listingsData.listings;
      featuredResources = resData.resources;
    } catch (_) {}

    const POST_TYPES = { iso:'🔍 ISO', job:'💼 Job', event:'📅 Event', resource_announce:'📣 Resource' };
    const CAT_ICONS = { food:'🍎', housing:'🏠', medical:'🏥', mental_health:'🧠', legal:'⚖️', utilities:'💡', childcare:'👶', transportation:'🚌', employment:'💼', clothing:'👕', other:'📦' };

    return `
      <div class="hero">
        <h1>🏘️ Downriver Community Hub</h1>
        <p>A free, community-driven platform connecting neighbors across Wyandotte, Trenton, Southgate, Lincoln Park, Riverview, and all of SE Michigan's downriver communities.</p>
        <div class="hero-actions">
          <a href="#/resources" data-link class="btn btn-hero-primary btn-lg">🆓 Free Resources</a>
          <a href="#/board"     data-link class="btn btn-hero-secondary btn-lg">📋 Agora Board</a>
          <a href="#/bazaar"    data-link class="btn btn-hero-secondary btn-lg">🛒 Bazaar</a>
          ${!user ? `<button class="btn btn-hero-primary btn-lg" onclick="Auth.showLoginModal()">Join the Community</button>` : ''}
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="card-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:28px">
        ${statCard('🆓', 'Free Resources', 'Food, housing, medical & more')}
        ${statCard('📋', 'Agora Board', 'ISO, jobs, events & announcements')}
        ${statCard('💬', 'Direct Messaging', 'Connect with caregivers & resources')}
        ${statCard('🛒', 'Community Bazaar', 'Buy & sell locally')}
      </div>

      <!-- Recent Board Posts -->
      <div class="home-section">
        <div class="home-section-header">
          <div class="home-section-title">📋 Latest Community Posts</div>
          <a href="#/board" data-link class="btn btn-secondary btn-sm">View All →</a>
        </div>
        ${recentPosts.length
          ? `<div class="card-grid">${recentPosts.map(p => `
              <div class="card" style="cursor:pointer" onclick="App.navigate('#/board')">
                <div style="display:flex;gap:6px;margin-bottom:6px">
                  <span class="badge badge-type-${p.type}">${POST_TYPES[p.type]||p.type}</span>
                  ${p.is_pinned ? '<span>📌</span>' : ''}
                </div>
                <strong style="font-size:.95rem">${esc(p.title)}</strong>
                <p style="font-size:.82rem;color:var(--text-secondary);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.body)}</p>
                <div style="font-size:.75rem;color:var(--text-secondary);margin-top:8px">${fmtDate(p.created_at)}</div>
              </div>`).join('')}</div>`
          : '<p style="color:var(--text-secondary)">No posts yet — be the first!</p>'}
      </div>

      <!-- Featured Resources -->
      <div class="home-section">
        <div class="home-section-header">
          <div class="home-section-title">🆓 Featured Free Resources</div>
          <a href="#/resources" data-link class="btn btn-secondary btn-sm">View All →</a>
        </div>
        ${featuredResources.length
          ? `<div class="card-grid card-grid-sm">${featuredResources.map(r => `
              <div class="card" style="cursor:pointer" onclick="App.navigate('#/resources')">
                <span class="badge badge-cat-${r.category}">${CAT_ICONS[r.category]||'📦'} ${r.category.replace('_',' ')}</span>
                <div style="font-weight:600;margin-top:8px;font-size:.95rem">${esc(r.title)}</div>
                ${r.city ? `<div style="font-size:.78rem;color:var(--text-secondary);margin-top:3px">📍 ${esc(r.city)}</div>` : ''}
                ${r.phone ? `<div style="font-size:.78rem;margin-top:3px">📞 ${esc(r.phone)}</div>` : ''}
              </div>`).join('')}</div>`
          : ''}
      </div>

      <!-- Recent Bazaar Listings -->
      <div class="home-section">
        <div class="home-section-header">
          <div class="home-section-title">🛒 Recent Bazaar Listings</div>
          <a href="#/bazaar" data-link class="btn btn-secondary btn-sm">View All →</a>
        </div>
        ${recentListings.length
          ? `<div class="card-grid card-grid-sm">${recentListings.map(l => `
              <div class="card listing-card" style="cursor:pointer" onclick="App.navigate('#/bazaar')">
                <div class="listing-img">${l.image_url ? `<img src="${esc(l.image_url)}" alt="${esc(l.title)}" loading="lazy">` : '🏷️'}</div>
                <div class="listing-price">$${l.price.toFixed(2)}</div>
                <div class="listing-title">${esc(l.title)}</div>
                <div class="listing-seller">${esc(l.seller_display||l.seller_name)}</div>
              </div>`).join('')}</div>`
          : '<p style="color:var(--text-secondary)">No listings yet — list something!</p>'}
      </div>

      <!-- Community info footer -->
      <div class="card" style="text-align:center;padding:28px">
        <div style="font-size:1.5rem;margin-bottom:8px">🤝</div>
        <strong>Serving the Downriver SE Michigan Community</strong>
        <p style="color:var(--text-secondary);font-size:.88rem;margin-top:6px">
          Wyandotte · Trenton · Southgate · Lincoln Park · Riverview · Woodhaven · Taylor · Flat Rock · Gibraltar · Rockwood
        </p>
      </div>`;
  }

  function statCard(icon, title, subtitle) {
    return `<div class="card" style="text-align:center;padding:18px 12px">
      <div style="font-size:1.8rem;margin-bottom:6px">${icon}</div>
      <div style="font-weight:700;font-size:.95rem">${title}</div>
      <div style="font-size:.78rem;color:var(--text-secondary);margin-top:3px">${subtitle}</div>
    </div>`;
  }

  function bindHomeEvents(root) {
    root.querySelectorAll('[data-link]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(a.getAttribute('href'));
      });
    });
  }

  // ── Unread message badge polling ─────────────────────────────────────────

  async function refreshUnreadBadge() {
    const badge = document.getElementById('msgBadge');
    if (!badge || !Auth.isLoggedIn()) return;
    try {
      const { count } = await api.get('/messages/unread/count');
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    } catch (_) {}
  }

  function startUnreadPolling() {
    if (_unreadInterval) return;
    refreshUnreadBadge();
    _unreadInterval = setInterval(refreshUnreadBadge, 30000);
  }

  function stopUnreadPolling() {
    clearInterval(_unreadInterval);
    _unreadInterval = null;
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    // Dark mode
    const savedTheme = localStorage.getItem('ch_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('ch_theme', next);
    });

    // Close generic modal on overlay click
    document.getElementById('genericModal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('genericModal')) closeGenericModal();
    });
    document.getElementById('closeGenericModal').addEventListener('click', closeGenericModal);

    // Nav link interception
    document.getElementById('topNav').addEventListener('click', (e) => {
      const a = e.target.closest('a[data-link]');
      if (a) { e.preventDefault(); navigate(a.getAttribute('href')); }
    });

    // Hash-based routing
    window.addEventListener('hashchange', render);

    // Load session
    await Auth.loadMe();
    Auth.renderNavAuth();

    if (Auth.isLoggedIn()) {
      Messages.connect();
      startUnreadPolling();
    }

    // Initial render
    render();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { render, navigate, refreshUnreadBadge, startUnreadPolling, stopUnreadPolling };
})();

window.App = App;
