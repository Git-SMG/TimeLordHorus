/* admin.js — Admin / Moderator Dashboard */
'use strict';

const Admin = (() => {
  let _activeTab = 'users';

  async function render() {
    const user = Auth.getUser();
    if (!user || !['admin','moderator'].includes(user.role)) {
      return `<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">Admin access required</div></div>`;
    }

    return `
      <div class="page-header">
        <div class="page-title">⚙️ Admin Dashboard</div>
        <div class="page-subtitle">Manage users, moderate content, and review resources</div>
      </div>
      <div class="tabs">
        ${user.role === 'admin' ? `<button class="tab-btn${_activeTab==='users'?' active':''}" data-tab="users">👥 Users</button>` : ''}
        <button class="tab-btn${_activeTab==='pending_posts'?' active':''}" data-tab="pending_posts">📋 Pending Posts</button>
        <button class="tab-btn${_activeTab==='needs_review'?' active':''}" data-tab="needs_review">🔍 Resources to Review</button>
        <button class="tab-btn${_activeTab==='reported'?' active':''}" data-tab="reported">🚨 Reported Messages</button>
      </div>
      <div id="adminTabContent"><div class="spinner"></div></div>`;
  }

  async function bindEvents(root) {
    const user = Auth.getUser();
    root.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeTab = btn.dataset.tab;
        root.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadTab(root.querySelector('#adminTabContent'), _activeTab, user);
      });
    });

    await loadTab(root.querySelector('#adminTabContent'), _activeTab, user);
  }

  async function loadTab(container, tab, user) {
    container.innerHTML = '<div class="spinner"></div>';
    try {
      switch (tab) {
        case 'users':          container.innerHTML = await renderUsersTab(); break;
        case 'pending_posts':  container.innerHTML = await renderPendingPostsTab(); break;
        case 'needs_review':   container.innerHTML = await renderNeedsReviewTab(); break;
        case 'reported':       container.innerHTML = await renderReportedTab(); break;
      }
      bindTabEvents(container, tab, user);
    } catch (ex) {
      container.innerHTML = `<p class="alert alert-danger">${esc(ex.message)}</p>`;
    }
  }

  // ── Users Tab ────────────────────────────────────────────────────────────
  async function renderUsersTab() {
    const users = await api.get('/auth/users');
    if (!users.length) return '<p>No users found.</p>';

    return `<div class="table-wrap"><table>
      <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
      <tbody>${users.map(u => `
        <tr data-uid="${u.id}">
          <td><strong>${esc(u.username)}</strong>${u.display_name ? `<br><small>${esc(u.display_name)}</small>` : ''}</td>
          <td>${esc(u.email)}</td>
          <td>
            <select class="form-control" style="min-width:130px;font-size:.8rem;padding:4px 8px" data-action="change-role" data-uid="${u.id}">
              ${['admin','moderator','public_resource','individual','caregiver'].map(r =>
                `<option value="${r}"${u.role===r?' selected':''}>${r.replace('_',' ')}</option>`).join('')}
            </select>
          </td>
          <td><span class="badge badge-status-${u.is_active?'active':'archived'}">${u.is_active?'Active':'Suspended'}</span></td>
          <td style="font-size:.8rem">${fmtDate(u.created_at)}</td>
          <td>
            <button class="btn btn-sm btn-${u.is_active?'danger':'success'}" data-action="toggle-status" data-uid="${u.id}" data-active="${u.is_active}">
              ${u.is_active?'Suspend':'Activate'}
            </button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  // ── Pending Posts Tab ────────────────────────────────────────────────────
  async function renderPendingPostsTab() {
    const posts = await api.get('/board/queue/pending');
    if (!posts.length) return '<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-text">No pending posts</div></div>';

    return `<div>${posts.map(p => `
      <div class="card" style="margin-bottom:10px" data-pid="${p.id}">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
          <strong>${esc(p.title)}</strong>
          <span class="badge badge-type-${p.type}">${p.type}</span>
          <span class="badge badge-role-${p.author_role}">${p.author_role.replace('_',' ')}</span>
          <span style="font-size:.78rem;color:var(--text-secondary)">${fmtDate(p.created_at)}</span>
        </div>
        <p style="font-size:.85rem;white-space:pre-wrap">${esc(p.body)}</p>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button class="btn btn-sm btn-success" data-action="approve-post" data-pid="${p.id}">✓ Approve</button>
          <button class="btn btn-sm btn-danger"  data-action="reject-post"  data-pid="${p.id}">✕ Reject</button>
        </div>
      </div>`).join('')}</div>`;
  }

  // ── Resources Needing Review ─────────────────────────────────────────────
  async function renderNeedsReviewTab() {
    const data = await api.get('/resources?status=needs_review&limit=50');
    if (!data.resources.length) return '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">All resources are up-to-date</div></div>';

    return `<div class="table-wrap"><table>
      <thead><tr><th>Title</th><th>City</th><th>Category</th><th>Last Verified</th><th>Actions</th></tr></thead>
      <tbody>${data.resources.map(r => `
        <tr data-rid="${r.id}">
          <td>${esc(r.title)}</td>
          <td>${esc(r.city||'')}</td>
          <td>${esc(r.category)}</td>
          <td>${r.last_verified ? fmtDate(r.last_verified) : 'Never'}</td>
          <td style="display:flex;gap:6px">
            <button class="btn btn-sm btn-success" data-action="verify-resource" data-rid="${r.id}">✓ Verify</button>
            <button class="btn btn-sm btn-danger"  data-action="archive-resource" data-rid="${r.id}">Archive</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  // ── Reported Messages ────────────────────────────────────────────────────
  async function renderReportedTab() {
    const rows = await api.get('/messages/admin/reported');
    if (!rows.length) return '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">No reported messages</div></div>';

    return `<div class="table-wrap"><table>
      <thead><tr><th>From</th><th>To</th><th>Message</th><th>Date</th></tr></thead>
      <tbody>${rows.map(m => `
        <tr>
          <td>${esc(m.sender_username)}</td>
          <td>${esc(m.recipient_username)}</td>
          <td style="font-size:.85rem;max-width:300px">${esc(m.body)}</td>
          <td style="font-size:.8rem">${fmtDate(m.created_at)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  function bindTabEvents(container, tab, user) {
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === 'toggle-status') {
        const uid = btn.dataset.uid;
        const isActive = btn.dataset.active === '1' || btn.dataset.active === 'true';
        if (!confirm(`${isActive ? 'Suspend' : 'Activate'} this user?`)) return;
        await api.patch(`/auth/users/${uid}/status`, { is_active: !isActive });
        await loadTab(container, tab, user);
      }
      if (action === 'approve-post') {
        await api.patch(`/board/${btn.dataset.pid}`, { status: 'approved' });
        btn.closest('[data-pid]').remove();
      }
      if (action === 'reject-post') {
        await api.patch(`/board/${btn.dataset.pid}`, { status: 'rejected' });
        btn.closest('[data-pid]').remove();
      }
      if (action === 'verify-resource') {
        await api.patch(`/resources/${btn.dataset.rid}`, { status: 'active' });
        btn.closest('tr').remove();
      }
      if (action === 'archive-resource') {
        await api.delete(`/resources/${btn.dataset.rid}`);
        btn.closest('tr').remove();
      }
    });

    container.addEventListener('change', async (e) => {
      const sel = e.target.closest('[data-action="change-role"]');
      if (!sel) return;
      const uid = sel.dataset.uid;
      const role = sel.value;
      if (!confirm(`Change this user's role to "${role}"?`)) {
        await loadTab(container, tab, user);
        return;
      }
      await api.patch(`/auth/users/${uid}/role`, { role });
    });
  }

  return { render, bindEvents };
})();

window.Admin = Admin;
