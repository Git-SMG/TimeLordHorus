/* resources.js — Free Resources Directory */
'use strict';

const Resources = (() => {
  const CATEGORIES = {
    food: '🍎 Food', housing: '🏠 Housing', medical: '🏥 Medical',
    mental_health: '🧠 Mental Health', legal: '⚖️ Legal', utilities: '💡 Utilities',
    childcare: '👶 Childcare', transportation: '🚌 Transportation',
    employment: '💼 Employment', clothing: '👕 Clothing', other: '📦 Other',
  };

  let _page = 1;
  let _filters = {};

  async function render(params = {}) {
    const f = { ..._filters, ...params };
    _filters = f;

    const user = Auth.getUser();
    const isStaff = user && ['admin','moderator'].includes(user.role);
    const canManage = user && ['admin','moderator','public_resource'].includes(user.role);

    const qs = new URLSearchParams({
      page: _page, limit: 20,
      ...Object.fromEntries(Object.entries(f).filter(([,v]) => v)),
    }).toString();

    let data;
    try {
      data = await api.get('/resources?' + qs);
    } catch (_) {
      return '<p class="alert alert-danger">Failed to load resources.</p>';
    }

    const filterBar = `
      <div class="filter-bar">
        <input type="search" class="form-control" id="resSearch" placeholder="🔍 Search resources…" value="${esc(f.search||'')}">
        <select class="form-control" id="resCat">
          <option value="">All Categories</option>
          ${Object.entries(CATEGORIES).map(([k,v]) => `<option value="${k}"${f.category===k?' selected':''}>${v}</option>`).join('')}
        </select>
        <input class="form-control" id="resCity" placeholder="City…" value="${esc(f.city||'')}" style="max-width:140px">
        ${isStaff ? `
        <select class="form-control" id="resStatus" style="max-width:160px">
          <option value="">All Statuses</option>
          <option value="active"${f.status==='active'?' selected':''}>Active</option>
          <option value="needs_review"${f.status==='needs_review'?' selected':''}>Needs Review</option>
          <option value="archived"${f.status==='archived'?' selected':''}>Archived</option>
        </select>` : ''}
        ${canManage ? `<button class="btn btn-primary btn-sm" id="addResourceBtn">+ Add Resource</button>` : ''}
        ${user && !canManage ? `<button class="btn btn-secondary btn-sm" id="suggestResourceBtn">💡 Suggest Resource</button>` : ''}
      </div>`;

    const cards = data.resources.length
      ? data.resources.map(r => resourceCard(r, user)).join('')
      : `<div class="empty-state"><div class="empty-icon">🗂️</div><div class="empty-text">No resources found</div><div class="empty-sub">Try adjusting your filters</div></div>`;

    const paginationHtml = pagination(data.total, data.page, data.limit, 'Resources.goPage');

    return `
      <div class="page-header">
        <div class="page-title">🆓 Free Community Resources</div>
        <div class="page-subtitle">Downriver Southeast Michigan — food, housing, medical, mental health &amp; more</div>
      </div>
      ${filterBar}
      <div class="card-grid" id="resourceGrid">${cards}</div>
      ${paginationHtml}

      <!-- Add/Edit modal template rendered into genericModal -->
      <div id="resourceDetailPane"></div>`;
  }

  function resourceCard(r, user) {
    const isStaff = user && ['admin','moderator'].includes(user.role);
    const isOwner = user && r.submitted_by === user.id && user.role === 'public_resource';
    const canEdit = isStaff || isOwner;

    return `
      <div class="card resource-card" data-id="${r.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:4px">
          <span class="badge badge-cat-${r.category}">${CATEGORIES[r.category] || r.category}</span>
          ${r.is_free ? '<span class="badge badge-status-active" style="background:#d5f5e3;color:#1e8449">FREE</span>' : ''}
          ${r.status !== 'active' ? `<span class="badge badge-status-${r.status}">${r.status.replace('_',' ')}</span>` : ''}
        </div>
        <div class="resource-title" style="margin-top:8px">${esc(r.title)}</div>
        ${r.description ? `<div class="resource-desc">${esc(r.description)}</div>` : ''}
        <div class="resource-meta">
          ${r.city     ? `<span>📍 ${esc(r.city)}</span>` : ''}
          ${r.phone    ? `<span>📞 <a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></span>` : ''}
          ${r.hours    ? `<span>🕐 ${esc(r.hours)}</span>` : ''}
          ${r.website  ? `<span>🌐 <a href="${esc(r.website)}" target="_blank" rel="noopener">Website</a></span>` : ''}
        </div>
        <div class="resource-actions">
          <button class="btn btn-sm btn-secondary resource-detail-btn" data-id="${r.id}">Details</button>
          ${canEdit ? `<button class="btn btn-sm btn-primary resource-edit-btn" data-id="${r.id}">Edit</button>` : ''}
          ${isStaff && r.status !== 'archived' ? `<button class="btn btn-sm btn-danger resource-archive-btn" data-id="${r.id}">Archive</button>` : ''}
        </div>
      </div>`;
  }

  function bindEvents(root) {
    // Search / filter changes
    root.querySelector('#resSearch')?.addEventListener('input', debounce((e) => {
      _page = 1; _filters.search = e.target.value; App.render();
    }, 350));
    root.querySelector('#resCat')?.addEventListener('change', (e) => {
      _page = 1; _filters.category = e.target.value; App.render();
    });
    root.querySelector('#resCity')?.addEventListener('input', debounce((e) => {
      _page = 1; _filters.city = e.target.value; App.render();
    }, 350));
    root.querySelector('#resStatus')?.addEventListener('change', (e) => {
      _page = 1; _filters.status = e.target.value; App.render();
    });

    root.querySelector('#addResourceBtn')?.addEventListener('click', () => showResourceForm(null));
    root.querySelector('#suggestResourceBtn')?.addEventListener('click', () => showResourceForm(null, true));

    // Card action buttons (delegated)
    root.querySelector('#resourceGrid')?.addEventListener('click', async (e) => {
      const detailBtn = e.target.closest('.resource-detail-btn');
      const editBtn   = e.target.closest('.resource-edit-btn');
      const archiveBtn= e.target.closest('.resource-archive-btn');

      if (detailBtn) {
        const id = detailBtn.dataset.id;
        const r = await api.get(`/resources/${id}`);
        showDetailModal(r);
      }
      if (editBtn) {
        const id = editBtn.dataset.id;
        const r = await api.get(`/resources/${id}`);
        showResourceForm(r);
      }
      if (archiveBtn) {
        if (!confirm('Archive this resource?')) return;
        await api.delete(`/resources/${archiveBtn.dataset.id}`);
        App.render();
      }
    });
  }

  function goPage(p) { _page = p; App.render(); }

  function showDetailModal(r) {
    openGenericModal(esc(r.title), `
      <div style="font-size:.9rem;line-height:1.7">
        <span class="badge badge-cat-${r.category}">${CATEGORIES[r.category] || r.category}</span>
        ${r.is_free ? '<span class="badge badge-status-active" style="margin-left:4px">FREE</span>' : ''}
        ${r.description ? `<p style="margin-top:12px">${esc(r.description)}</p>` : ''}
        <div style="margin-top:14px;display:grid;gap:6px">
          ${r.address  ? `<div>📍 <strong>Address:</strong> ${esc(r.address)}${r.city ? ', '+esc(r.city) : ''}</div>` : ''}
          ${r.phone    ? `<div>📞 <strong>Phone:</strong> <a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></div>` : ''}
          ${r.hours    ? `<div>🕐 <strong>Hours:</strong> ${esc(r.hours)}</div>` : ''}
          ${r.website  ? `<div>🌐 <strong>Website:</strong> <a href="${esc(r.website)}" target="_blank" rel="noopener">${esc(r.website)}</a></div>` : ''}
          ${r.last_verified ? `<div style="margin-top:8px;font-size:.78rem;color:var(--text-secondary)">Last verified: ${fmtDate(r.last_verified)}</div>` : ''}
        </div>
      </div>`);
  }

  function showResourceForm(existing, suggest = false) {
    const title = existing ? 'Edit Resource' : (suggest ? 'Suggest a Resource' : 'Add Resource');
    openGenericModal(title, `
      <form id="resourceForm">
        <div class="form-group">
          <label class="form-label">Title <span style="color:var(--danger)">*</span></label>
          <input class="form-control" name="title" required value="${esc(existing?.title||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" name="description">${esc(existing?.description||'')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category <span style="color:var(--danger)">*</span></label>
            <select class="form-control" name="category" required>
              ${Object.entries(CATEGORIES).map(([k,v]) => `<option value="${k}"${existing?.category===k?' selected':''}>${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">City</label>
            <input class="form-control" name="city" value="${esc(existing?.city||'')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Address</label>
            <input class="form-control" name="address" value="${esc(existing?.address||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-control" name="phone" value="${esc(existing?.phone||'')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Website</label>
            <input class="form-control" name="website" type="url" value="${esc(existing?.website||'')}">
          </div>
          <div class="form-group">
            <label class="form-label">Hours</label>
            <input class="form-control" name="hours" value="${esc(existing?.hours||'')}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" name="is_free" ${existing?.is_free !== false ? 'checked' : ''}> This resource is completely free
          </label>
        </div>
        ${suggest ? '<div class="alert alert-info">Your suggestion will be reviewed by a moderator before going live.</div>' : ''}
        <p class="form-error" id="resFErr"></p>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button type="button" class="btn btn-secondary" id="cancelResForm">Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save Changes' : (suggest ? 'Submit Suggestion' : 'Add Resource')}</button>
        </div>
      </form>`);

    document.getElementById('cancelResForm').addEventListener('click', closeGenericModal);
    document.getElementById('resourceForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('resFErr');
      err.textContent = '';
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd);
      body.is_free = fd.has('is_free') ? 1 : 0;
      try {
        if (existing) {
          await api.patch(`/resources/${existing.id}`, body);
        } else {
          await api.post('/resources', body);
        }
        closeGenericModal();
        App.render();
      } catch (ex) { err.textContent = ex.message; }
    });
  }

  return { render, bindEvents, goPage };
})();

window.Resources = Resources;
