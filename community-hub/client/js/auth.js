/* auth.js — Login, Register, Profile, session management */
'use strict';

const Auth = (() => {
  let _user = null;

  function getUser() { return _user; }
  function isLoggedIn() { return !!_user; }

  function setSession(token, user) {
    localStorage.setItem('ch_token', token);
    _user = user;
  }

  function clearSession() {
    localStorage.removeItem('ch_token');
    _user = null;
  }

  async function loadMe() {
    const token = localStorage.getItem('ch_token');
    if (!token) return null;
    try {
      const me = await api.get('/auth/me');
      _user = me;
      return me;
    } catch (_) {
      clearSession();
      return null;
    }
  }

  // ── UI: Nav auth area ───────────────────────────────────────────────────

  function renderNavAuth() {
    const el = document.getElementById('navAuthArea');
    if (!el) return;

    if (_user) {
      el.innerHTML = `
        <div class="nav-user-info">
          <span class="badge badge-role-${_user.role}">${_user.role.replace('_',' ')}</span>
          <a href="#/profile" data-link style="font-weight:600">${_user.display_name || _user.username}</a>
          <button class="btn btn-sm btn-secondary" id="logoutBtn">Sign out</button>
        </div>`;
      el.querySelector('#logoutBtn').addEventListener('click', logout);

      // Show staff nav items
      const staffLinks = document.querySelectorAll('.staff-only');
      if (_user.role === 'admin' || _user.role === 'moderator') {
        staffLinks.forEach(el => el.classList.remove('hidden'));
      }
    } else {
      el.innerHTML = `
        <button class="btn btn-sm btn-secondary" id="navLoginBtn">Sign In</button>
        <button class="btn btn-sm btn-primary"   id="navRegisterBtn">Register</button>`;
      el.querySelector('#navLoginBtn').addEventListener('click', () => showLoginModal());
      el.querySelector('#navRegisterBtn').addEventListener('click', () => showRegisterModal());
    }
  }

  // ── Login Modal ─────────────────────────────────────────────────────────

  function showLoginModal(redirect) {
    const modal = document.getElementById('loginModal');
    const title = document.getElementById('authModalTitle');
    const content = document.getElementById('authModalContent');
    title.textContent = 'Sign In';
    content.innerHTML = renderLoginForm();
    modal.classList.remove('hidden');

    content.querySelector('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = content.querySelector('.form-error');
      err.textContent = '';
      const username = content.querySelector('#loginUsername').value.trim();
      const password = content.querySelector('#loginPassword').value;
      try {
        const res = await api.post('/auth/login', { username, password });
        setSession(res.token, res.user);
        closeAuthModal();
        renderNavAuth();
        App.startUnreadPolling();
        if (redirect) App.navigate(redirect);
        else App.render();
      } catch (ex) {
        err.textContent = ex.message;
      }
    });

    content.querySelector('#toRegister').addEventListener('click', () => showRegisterModal());
  }

  function renderLoginForm() {
    return `
      <form id="loginForm">
        <div class="form-group">
          <label class="form-label" for="loginUsername">Username or Email</label>
          <input class="form-control" id="loginUsername" type="text" required autocomplete="username">
        </div>
        <div class="form-group">
          <label class="form-label" for="loginPassword">Password</label>
          <input class="form-control" id="loginPassword" type="password" required autocomplete="current-password">
        </div>
        <p class="form-error"></p>
        <button class="btn btn-primary" style="width:100%" type="submit">Sign In</button>
        <p class="auth-switch">No account? <a href="#" id="toRegister">Register here</a></p>
      </form>`;
  }

  // ── Register Modal ──────────────────────────────────────────────────────

  function showRegisterModal() {
    const modal = document.getElementById('loginModal');
    const title = document.getElementById('authModalTitle');
    const content = document.getElementById('authModalContent');
    title.textContent = 'Create Account';
    content.innerHTML = renderRegisterForm();
    modal.classList.remove('hidden');

    content.querySelector('#registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = content.querySelector('.form-error');
      err.textContent = '';
      const body = {
        username:     content.querySelector('#regUsername').value.trim(),
        email:        content.querySelector('#regEmail').value.trim(),
        password:     content.querySelector('#regPassword').value,
        role:         content.querySelector('#regRole').value,
        display_name: content.querySelector('#regDisplayName').value.trim() || undefined,
        organization: content.querySelector('#regOrg').value.trim() || undefined,
      };
      if (body.password !== content.querySelector('#regPassword2').value) {
        err.textContent = 'Passwords do not match';
        return;
      }
      if (body.password.length < 8) {
        err.textContent = 'Password must be at least 8 characters';
        return;
      }
      try {
        const res = await api.post('/auth/register', body);
        setSession(res.token, res.user);
        closeAuthModal();
        renderNavAuth();
        App.startUnreadPolling();
        App.render();
      } catch (ex) {
        err.textContent = ex.message;
      }
    });

    content.querySelector('#toLogin').addEventListener('click', () => showLoginModal());
  }

  function renderRegisterForm() {
    return `
      <form id="registerForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="regUsername">Username</label>
            <input class="form-control" id="regUsername" type="text" required autocomplete="username">
          </div>
          <div class="form-group">
            <label class="form-label" for="regDisplayName">Display Name</label>
            <input class="form-control" id="regDisplayName" type="text">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="regEmail">Email</label>
          <input class="form-control" id="regEmail" type="email" required autocomplete="email">
        </div>
        <div class="form-group">
          <label class="form-label" for="regRole">I am a…</label>
          <select class="form-control" id="regRole">
            <option value="individual">Individual / Community Member</option>
            <option value="caregiver">Caregiver</option>
            <option value="public_resource">Public Resource / Organization</option>
          </select>
        </div>
        <div class="form-group" id="orgFieldWrap">
          <label class="form-label" for="regOrg">Organization Name</label>
          <input class="form-control" id="regOrg" type="text" placeholder="Optional">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="regPassword">Password</label>
            <input class="form-control" id="regPassword" type="password" required autocomplete="new-password">
          </div>
          <div class="form-group">
            <label class="form-label" for="regPassword2">Confirm Password</label>
            <input class="form-control" id="regPassword2" type="password" required autocomplete="new-password">
          </div>
        </div>
        <p class="form-error"></p>
        <button class="btn btn-primary" style="width:100%" type="submit">Create Account</button>
        <p class="auth-switch">Already have an account? <a href="#" id="toLogin">Sign in</a></p>
      </form>`;
  }

  function closeAuthModal() {
    document.getElementById('loginModal').classList.add('hidden');
  }

  // ── Profile Page ────────────────────────────────────────────────────────

  async function renderProfile() {
    if (!_user) { showLoginModal('#/profile'); return '<p>Please sign in to view your profile.</p>'; }

    const me = await api.get('/auth/me');
    _user = me;

    return `
      <div class="profile-header">
        <div class="profile-avatar">${(me.display_name || me.username)[0].toUpperCase()}</div>
        <div>
          <div class="profile-name">${esc(me.display_name || me.username)}</div>
          <div class="profile-meta">
            <span class="badge badge-role-${me.role}">${me.role.replace('_',' ')}</span>
            ${me.organization ? `&nbsp;·&nbsp;${esc(me.organization)}` : ''}
            &nbsp;·&nbsp; Member since ${fmtDate(me.created_at)}
          </div>
          ${me.bio ? `<p style="margin-top:8px;font-size:.9rem">${esc(me.bio)}</p>` : ''}
        </div>
      </div>

      <div class="card-grid" style="grid-template-columns:1fr 1fr;gap:16px">
        <div class="card">
          <div class="card-header"><span class="card-title">Edit Profile</span></div>
          <form id="profileForm">
            <div class="form-group">
              <label class="form-label">Display Name</label>
              <input class="form-control" name="display_name" value="${esc(me.display_name || '')}">
            </div>
            <div class="form-group">
              <label class="form-label">Bio</label>
              <textarea class="form-control" name="bio">${esc(me.bio || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input class="form-control" name="phone" value="${esc(me.phone || '')}">
            </div>
            <div class="form-group">
              <label class="form-label">Organization</label>
              <input class="form-control" name="organization" value="${esc(me.organization || '')}">
            </div>
            <p class="form-error" id="profileErr"></p>
            <button class="btn btn-primary" type="submit">Save Changes</button>
          </form>
        </div>

        <div>
          <div class="wallet-box">
            <div class="wallet-label">Wallet Balance</div>
            <div class="wallet-balance">$${me.wallet_balance.toFixed(2)}</div>
          </div>

          <div class="card">
            <div class="card-header"><span class="card-title">Change Password</span></div>
            <form id="pwForm">
              <div class="form-group">
                <label class="form-label">Current Password</label>
                <input class="form-control" name="current_password" type="password">
              </div>
              <div class="form-group">
                <label class="form-label">New Password</label>
                <input class="form-control" name="new_password" type="password">
              </div>
              <p class="form-error" id="pwErr"></p>
              <button class="btn btn-secondary" type="submit">Update Password</button>
            </form>
          </div>
        </div>
      </div>`;
  }

  function bindProfileEvents(root) {
    const pf = root.querySelector('#profileForm');
    if (pf) {
      pf.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = root.querySelector('#profileErr');
        err.textContent = '';
        const fd = new FormData(pf);
        try {
          await api.patch('/auth/profile', Object.fromEntries(fd));
          err.style.color = 'var(--success)';
          err.textContent = '✓ Saved';
          await loadMe();
          renderNavAuth();
        } catch (ex) { err.style.color = ''; err.textContent = ex.message; }
      });
    }
    const pwf = root.querySelector('#pwForm');
    if (pwf) {
      pwf.addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = root.querySelector('#pwErr');
        err.textContent = '';
        const fd = new FormData(pwf);
        try {
          await api.patch('/auth/password', Object.fromEntries(fd));
          err.style.color = 'var(--success)';
          err.textContent = '✓ Password changed';
          pwf.reset();
        } catch (ex) { err.style.color = ''; err.textContent = ex.message; }
      });
    }
  }

  function logout() {
    clearSession();
    renderNavAuth();
    App.stopUnreadPolling();
    App.navigate('#/');
  }

  // ── Close modal on overlay click ────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('closeAuthModal').addEventListener('click', closeAuthModal);
    document.getElementById('loginModal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('loginModal')) closeAuthModal();
    });
  });

  return { getUser, isLoggedIn, loadMe, renderNavAuth, showLoginModal, renderProfile, bindProfileEvents };
})();

window.Auth = Auth;
