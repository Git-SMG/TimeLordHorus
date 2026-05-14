/* board.js — Agora Bulletin Board */
'use strict';

const Board = (() => {
  const POST_TYPES = {
    iso: '🔍 ISO',
    job: '💼 Job',
    event: '📅 Event',
    resource_announce: '📣 Resource',
  };

  let _page = 1;
  let _filters = {};

  async function render(params = {}) {
    _filters = { ..._filters, ...params };
    const user = Auth.getUser();
    const isStaff = user && ['admin','moderator'].includes(user.role);

    const qs = new URLSearchParams({
      page: _page, limit: 20,
      ...Object.fromEntries(Object.entries(_filters).filter(([,v]) => v)),
    }).toString();

    let data;
    try {
      data = await api.get('/board?' + qs);
    } catch (_) {
      return '<p class="alert alert-danger">Failed to load posts.</p>';
    }

    const filterBar = `
      <div class="filter-bar">
        <input type="search" class="form-control" id="boardSearch" placeholder="🔍 Search posts…" value="${esc(_filters.search||'')}" style="max-width:240px">
        <select class="form-control" id="boardType" style="max-width:160px">
          <option value="">All Types</option>
          ${Object.entries(POST_TYPES).map(([k,v]) => `<option value="${k}"${_filters.type===k?' selected':''}>${v}</option>`).join('')}
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:.88rem;cursor:pointer">
          <input type="checkbox" id="boardPinned" ${_filters.pinned==='true'?'checked':''}> Pinned only
        </label>
        ${isStaff ? `<button class="btn btn-sm btn-secondary" id="modQueueBtn">⚠️ Mod Queue</button>` : ''}
        ${user ? `<button class="btn btn-sm btn-primary" id="newPostBtn">+ New Post</button>` : ''}
      </div>`;

    const cards = data.posts.length
      ? data.posts.map(p => postCard(p, user)).join('')
      : `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No posts yet</div><div class="empty-sub">Be the first to post!</div></div>`;

    return `
      <div class="page-header">
        <div class="page-title">📋 Agora Community Board</div>
        <div class="page-subtitle">ISO posts, job listings, events, and resource announcements</div>
      </div>
      ${filterBar}
      <div id="postGrid">${cards}</div>
      ${pagination(data.total, data.page, data.limit, 'Board.goPage')}`;
  }

  function postCard(p, user) {
    const isStaff = user && ['admin','moderator'].includes(user.role);
    const isAuthor = user && p.author_id === user.id;
    const canEdit = isStaff || (isAuthor && p.status === 'pending');
    const canMod  = isStaff;

    const expiredBadge = p.expires_at && new Date(p.expires_at) < new Date()
      ? '<span class="badge badge-status-archived">Expired</span>' : '';

    return `
      <div class="card post-card${p.is_pinned?' pinned':''}" style="margin-bottom:12px">
        ${p.is_pinned ? '<span class="post-pin">📌 Pinned</span>' : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span class="badge badge-type-${p.type}">${POST_TYPES[p.type] || p.type}</span>
          ${p.category ? `<span class="badge badge-cat-other">${esc(p.category)}</span>` : ''}
          ${p.status !== 'approved' ? `<span class="badge badge-status-${p.status}">${p.status}</span>` : ''}
          ${expiredBadge}
        </div>
        <div class="post-title">${esc(p.title)}</div>
        <div class="post-body">${esc(p.body)}</div>
        <div class="post-meta">
          <span>👤 ${esc(p.author_display || p.author_name)}</span>
          <span class="badge badge-role-${p.author_role}">${p.author_role.replace('_',' ')}</span>
          <span>🕐 ${fmtDate(p.created_at)}</span>
          ${p.expires_at ? `<span>⏳ Expires ${fmtDate(p.expires_at)}</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <button class="btn btn-sm btn-secondary post-read-btn" data-id="${p.id}">Read More</button>
          ${canEdit ? `<button class="btn btn-sm btn-primary post-edit-btn" data-id="${p.id}">Edit</button>` : ''}
          ${canMod ? `
            ${p.status === 'pending' ? `<button class="btn btn-sm btn-success post-approve-btn" data-id="${p.id}">✓ Approve</button>` : ''}
            <button class="btn btn-sm ${p.is_pinned?'btn-secondary':'btn-secondary'} post-pin-btn" data-id="${p.id}" data-pinned="${p.is_pinned}">${p.is_pinned ? 'Unpin' : '📌 Pin'}</button>
            <button class="btn btn-sm btn-danger post-archive-btn" data-id="${p.id}">Archive</button>` : ''}
          ${isAuthor && !isStaff ? `<button class="btn btn-sm btn-danger post-delete-btn" data-id="${p.id}">Delete</button>` : ''}
        </div>
      </div>`;
  }

  function bindEvents(root) {
    root.querySelector('#boardSearch')?.addEventListener('input', debounce((e) => {
      _page = 1; _filters.search = e.target.value; App.render();
    }, 350));
    root.querySelector('#boardType')?.addEventListener('change', (e) => {
      _page = 1; _filters.type = e.target.value; App.render();
    });
    root.querySelector('#boardPinned')?.addEventListener('change', (e) => {
      _page = 1; _filters.pinned = e.target.checked ? 'true' : ''; App.render();
    });
    root.querySelector('#newPostBtn')?.addEventListener('click', () => showPostForm(null));
    root.querySelector('#modQueueBtn')?.addEventListener('click', showModQueue);

    root.addEventListener('click', async (e) => {
      const readBtn    = e.target.closest('.post-read-btn');
      const editBtn    = e.target.closest('.post-edit-btn');
      const approveBtn = e.target.closest('.post-approve-btn');
      const pinBtn     = e.target.closest('.post-pin-btn');
      const archiveBtn = e.target.closest('.post-archive-btn');
      const deleteBtn  = e.target.closest('.post-delete-btn');

      if (readBtn) {
        const p = await api.get(`/board/${readBtn.dataset.id}`);
        openGenericModal(esc(p.title), `
          <div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
              <span class="badge badge-type-${p.type}">${POST_TYPES[p.type]||p.type}</span>
              ${p.category ? `<span class="badge badge-cat-other">${esc(p.category)}</span>` : ''}
              <span class="badge badge-role-${p.author_role}">${p.author_role.replace('_',' ')}</span>
            </div>
            <div class="post-detail-body">${esc(p.body)}</div>
            <div class="post-meta" style="margin-top:14px">
              <span>By ${esc(p.author_display||p.author_name)}</span>
              <span>·</span><span>${fmtDate(p.created_at)}</span>
              ${p.expires_at ? `<span>· Expires ${fmtDate(p.expires_at)}</span>` : ''}
            </div>
          </div>`);
      }
      if (editBtn) {
        const p = await api.get(`/board/${editBtn.dataset.id}`);
        showPostForm(p);
      }
      if (approveBtn) {
        await api.patch(`/board/${approveBtn.dataset.id}`, { status: 'approved' });
        App.render();
      }
      if (pinBtn) {
        const pinned = pinBtn.dataset.pinned === '1' || pinBtn.dataset.pinned === 'true';
        await api.patch(`/board/${pinBtn.dataset.id}`, { is_pinned: !pinned });
        App.render();
      }
      if (archiveBtn) {
        if (!confirm('Archive this post?')) return;
        await api.delete(`/board/${archiveBtn.dataset.id}`);
        App.render();
      }
      if (deleteBtn) {
        if (!confirm('Delete this post?')) return;
        await api.delete(`/board/${deleteBtn.dataset.id}`);
        App.render();
      }
    });
  }

  async function showModQueue() {
    let posts;
    try { posts = await api.get('/board/queue/pending'); }
    catch (_) { return; }

    openGenericModal('⚠️ Moderation Queue', posts.length === 0
      ? '<p class="empty-state">No pending posts 🎉</p>'
      : posts.map(p => `
          <div class="card" style="margin-bottom:10px">
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
              <span class="badge badge-type-${p.type}">${POST_TYPES[p.type]||p.type}</span>
              <span class="badge badge-role-${p.author_role}">${p.author_role.replace('_',' ')}</span>
              <span style="font-size:.78rem;color:var(--text-secondary)">${fmtDate(p.created_at)}</span>
            </div>
            <strong>${esc(p.title)}</strong>
            <p style="font-size:.85rem;margin-top:4px;white-space:pre-wrap">${esc(p.body)}</p>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="btn btn-sm btn-success mod-approve" data-id="${p.id}">✓ Approve</button>
              <button class="btn btn-sm btn-danger mod-reject" data-id="${p.id}">✕ Reject</button>
            </div>
          </div>`).join(''));

    document.getElementById('genericModalContent').addEventListener('click', async (e) => {
      if (e.target.closest('.mod-approve')) {
        await api.patch(`/board/${e.target.closest('.mod-approve').dataset.id}`, { status: 'approved' });
        e.target.closest('.card').remove();
      }
      if (e.target.closest('.mod-reject')) {
        await api.patch(`/board/${e.target.closest('.mod-reject').dataset.id}`, { status: 'rejected' });
        e.target.closest('.card').remove();
      }
    });
  }

  function showPostForm(existing) {
    openGenericModal(existing ? 'Edit Post' : 'New Post', `
      <form id="postForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Post Type <span style="color:var(--danger)">*</span></label>
            <select class="form-control" name="type" required>
              ${Object.entries(POST_TYPES).map(([k,v]) => `<option value="${k}"${existing?.type===k?' selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Category / Tag</label>
            <input class="form-control" name="category" value="${esc(existing?.category||'')}" placeholder="e.g. tech, volunteer…">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Title <span style="color:var(--danger)">*</span></label>
          <input class="form-control" name="title" required value="${esc(existing?.title||'')}" maxlength="200">
        </div>
        <div class="form-group">
          <label class="form-label">Body <span style="color:var(--danger)">*</span></label>
          <textarea class="form-control" name="body" required style="min-height:120px">${esc(existing?.body||'')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Expiry Date (optional)</label>
          <input class="form-control" name="expires_at" type="date" value="${existing?.expires_at ? existing.expires_at.slice(0,10) : ''}">
        </div>
        <p class="form-hint">Posts from regular users go to a moderation queue before going live.</p>
        <p class="form-error" id="postFErr"></p>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button type="button" class="btn btn-secondary" id="cancelPostForm">Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save Changes' : 'Submit Post'}</button>
        </div>
      </form>`);

    document.getElementById('cancelPostForm').addEventListener('click', closeGenericModal);
    document.getElementById('postForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('postFErr');
      err.textContent = '';
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd);
      if (!body.expires_at) delete body.expires_at;
      try {
        if (existing) {
          await api.patch(`/board/${existing.id}`, body);
        } else {
          await api.post('/board', body);
        }
        closeGenericModal();
        App.render();
      } catch (ex) { err.textContent = ex.message; }
    });
  }

  function goPage(p) { _page = p; App.render(); }

  return { render, bindEvents, goPage };
})();

window.Board = Board;
