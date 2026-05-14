/* bazaar.js — Community Bazaar Marketplace */
'use strict';

const Bazaar = (() => {
  let _page = 1;
  let _filters = {};
  let _view = 'browse'; // browse | my-listings | my-purchases | my-sales

  async function render(subview = 'browse') {
    _view = subview;
    const user = Auth.getUser();

    const tabs = `
      <div class="tabs">
        <button class="tab-btn${_view==='browse'?' active':''}" data-tab="browse">🛒 Browse</button>
        ${user ? `
        <button class="tab-btn${_view==='my-listings'?' active':''}" data-tab="my-listings">📦 My Listings</button>
        <button class="tab-btn${_view==='my-purchases'?' active':''}" data-tab="my-purchases">🧾 Purchases</button>
        <button class="tab-btn${_view==='my-sales'?' active':''}" data-tab="my-sales">💰 Sales</button>` : ''}
      </div>`;

    let body = '';
    if (_view === 'browse')       body = await renderBrowse(user);
    else if (_view === 'my-listings') body = await renderMyListings(user);
    else if (_view === 'my-purchases') body = await renderMyPurchases(user);
    else if (_view === 'my-sales')    body = await renderMySales(user);

    return `
      <div class="page-header">
        <div class="page-title">🛒 Community Bazaar</div>
        <div class="page-subtitle">Buy &amp; sell locally — 2% platform fee on each transaction</div>
      </div>
      ${user ? walletBar(user) : ''}
      ${tabs}
      <div id="bazaarBody">${body}</div>`;
  }

  function walletBar(user) {
    // Balance is shown on profile; here just show wallet link
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" id="walletDepositBtn">💳 Add Funds</button>
        <span style="font-size:.85rem;color:var(--text-secondary)" id="walletBalanceLine">Loading wallet…</span>
      </div>`;
  }

  async function renderBrowse(user) {
    const qs = new URLSearchParams({
      page: _page, limit: 20,
      ...Object.fromEntries(Object.entries(_filters).filter(([,v]) => v)),
    }).toString();

    let data;
    try { data = await api.get('/bazaar?' + qs); }
    catch (_) { return '<p class="alert alert-danger">Failed to load listings.</p>'; }

    const filterBar = `
      <div class="filter-bar">
        <input type="search" class="form-control" id="bazaarSearch" placeholder="🔍 Search listings…" value="${esc(_filters.search||'')}">
        <input class="form-control" id="bazaarCat" placeholder="Category…" value="${esc(_filters.category||'')}" style="max-width:160px">
        ${user ? `<button class="btn btn-primary btn-sm" id="newListingBtn">+ List Item</button>` : ''}
      </div>`;

    const cards = data.listings.length
      ? `<div class="card-grid card-grid-sm">${data.listings.map(l => listingCard(l, user)).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">🛒</div><div class="empty-text">No listings found</div></div>`;

    return filterBar + cards + pagination(data.total, data.page, data.limit, 'Bazaar.goPage');
  }

  async function renderMyListings(user) {
    if (!user) return requireLoginHtml();
    let rows;
    try { rows = await api.get('/bazaar/my/listings'); }
    catch (_) { return '<p class="alert alert-danger">Failed to load.</p>'; }

    return `
      <div style="margin-bottom:12px"><button class="btn btn-primary btn-sm" id="newListingBtn">+ Create Listing</button></div>
      ${rows.length === 0
        ? '<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">No listings yet</div></div>'
        : `<div class="card-grid card-grid-sm">${rows.map(l => listingCard(l, user, true)).join('')}</div>`}`;
  }

  async function renderMyPurchases(user) {
    if (!user) return requireLoginHtml();
    let rows;
    try { rows = await api.get('/bazaar/my/purchases'); }
    catch (_) { return '<p class="alert alert-danger">Failed to load.</p>'; }

    if (!rows.length) return '<div class="empty-state"><div class="empty-icon">🧾</div><div class="empty-text">No purchases yet</div></div>';

    return `<div class="table-wrap"><table>
      <thead><tr><th>Item</th><th>Price</th><th>Fee</th><th>Seller</th><th>Date</th></tr></thead>
      <tbody>${rows.map(t => `
        <tr>
          <td>${esc(t.listing_title)}</td>
          <td>$${t.amount.toFixed(2)}</td>
          <td>$${t.fee.toFixed(2)}</td>
          <td>${esc(t.seller_name)}</td>
          <td>${fmtDate(t.created_at)}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  }

  async function renderMySales(user) {
    if (!user) return requireLoginHtml();
    let rows;
    try { rows = await api.get('/bazaar/my/sales'); }
    catch (_) { return '<p class="alert alert-danger">Failed to load.</p>'; }

    if (!rows.length) return '<div class="empty-state"><div class="empty-icon">💰</div><div class="empty-text">No sales yet</div></div>';

    const totalEarnings = rows.reduce((s, t) => s + t.seller_payout, 0);

    return `
      <div class="alert alert-success" style="margin-bottom:12px">Total Earnings: <strong>$${totalEarnings.toFixed(2)}</strong></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Item</th><th>Sale Price</th><th>Platform Fee</th><th>Your Payout</th><th>Buyer</th><th>Date</th></tr></thead>
        <tbody>${rows.map(t => `
          <tr>
            <td>${esc(t.listing_title)}</td>
            <td>$${t.amount.toFixed(2)}</td>
            <td style="color:var(--text-secondary)">-$${t.fee.toFixed(2)}</td>
            <td style="color:var(--success);font-weight:600">$${t.seller_payout.toFixed(2)}</td>
            <td>${esc(t.buyer_name)}</td>
            <td>${fmtDate(t.created_at)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  }

  function listingCard(l, user, isOwner = false) {
    const sold = l.status !== 'available';
    const canBuy = user && l.seller_id !== user.id && !sold;
    const canEdit = isOwner || (user && l.seller_id === user.id);

    return `
      <div class="card listing-card" data-id="${l.id}">
        <div class="listing-img">
          ${l.image_url ? `<img src="${esc(l.image_url)}" alt="${esc(l.title)}" loading="lazy">` : '🏷️'}
        </div>
        ${sold ? '<span class="badge badge-status-archived" style="margin-bottom:6px">SOLD</span>' : ''}
        <div class="listing-price">${sold ? '<s>' : ''}$${l.price.toFixed(2)}${sold ? '</s>' : ''}</div>
        <div class="listing-title">${esc(l.title)}</div>
        ${l.category ? `<div style="font-size:.78rem;color:var(--text-secondary);margin:2px 0">${esc(l.category)}</div>` : ''}
        <div class="listing-seller">by ${esc(l.seller_display || l.seller_name)}</div>
        ${l.description ? `<p style="font-size:.82rem;color:var(--text-secondary);margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(l.description)}</p>` : ''}
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
          <button class="btn btn-sm btn-secondary listing-detail-btn" data-id="${l.id}">Details</button>
          ${canBuy ? `<button class="btn btn-sm btn-primary listing-buy-btn" data-id="${l.id}" data-price="${l.price}" data-title="${esc(l.title)}">Buy $${l.price.toFixed(2)}</button>` : ''}
          ${canEdit && !sold ? `
            <button class="btn btn-sm btn-secondary listing-edit-btn" data-id="${l.id}">Edit</button>
            <button class="btn btn-sm btn-danger listing-remove-btn" data-id="${l.id}">Remove</button>` : ''}
        </div>
      </div>`;
  }

  function requireLoginHtml() {
    return `<div class="empty-state">
      <div class="empty-icon">🔒</div>
      <div class="empty-text">Please sign in</div>
      <button class="btn btn-primary" style="margin-top:14px" onclick="Auth.showLoginModal()">Sign In</button>
    </div>`;
  }

  function bindEvents(root) {
    // Tab switching
    root.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _view = btn.dataset.tab;
        App.render();
      });
    });

    // Filter changes
    root.querySelector('#bazaarSearch')?.addEventListener('input', debounce((e) => {
      _page = 1; _filters.search = e.target.value; App.render();
    }, 350));
    root.querySelector('#bazaarCat')?.addEventListener('input', debounce((e) => {
      _page = 1; _filters.category = e.target.value; App.render();
    }, 350));

    root.querySelector('#newListingBtn')?.addEventListener('click', () => showListingForm(null));

    // Wallet deposit
    root.querySelector('#walletDepositBtn')?.addEventListener('click', showDepositModal);

    // Load wallet balance
    const balanceLine = root.querySelector('#walletBalanceLine');
    if (balanceLine) {
      api.get('/bazaar/wallet/balance').then(d => {
        balanceLine.textContent = `Wallet: $${d.balance.toFixed(2)}`;
      }).catch(() => { balanceLine.textContent = ''; });
    }

    // Card action delegation
    root.addEventListener('click', async (e) => {
      const detailBtn = e.target.closest('.listing-detail-btn');
      const buyBtn    = e.target.closest('.listing-buy-btn');
      const editBtn   = e.target.closest('.listing-edit-btn');
      const removeBtn = e.target.closest('.listing-remove-btn');

      if (detailBtn) {
        const l = await api.get(`/bazaar/${detailBtn.dataset.id}`);
        showListingDetail(l);
      }
      if (buyBtn) {
        const { id, price, title } = buyBtn.dataset;
        showBuyConfirm(parseInt(id), parseFloat(price), title);
      }
      if (editBtn) {
        const l = await api.get(`/bazaar/${editBtn.dataset.id}`);
        showListingForm(l);
      }
      if (removeBtn) {
        if (!confirm('Remove this listing?')) return;
        await api.delete(`/bazaar/${removeBtn.dataset.id}`);
        App.render();
      }
    });
  }

  function showListingDetail(l) {
    const user = Auth.getUser();
    const canBuy = user && l.seller_id !== user.id && l.status === 'available';
    openGenericModal(esc(l.title), `
      <div>
        ${l.image_url ? `<img src="${esc(l.image_url)}" alt="${esc(l.title)}" style="width:100%;max-height:240px;object-fit:cover;border-radius:8px;margin-bottom:14px">` : ''}
        <div style="font-size:1.5rem;font-weight:800;color:var(--accent);margin-bottom:8px">$${l.price.toFixed(2)}</div>
        ${l.category ? `<span class="badge badge-cat-other">${esc(l.category)}</span><br><br>` : ''}
        ${l.description ? `<p style="white-space:pre-wrap;font-size:.9rem;line-height:1.6">${esc(l.description)}</p>` : ''}
        <p style="margin-top:12px;font-size:.82rem;color:var(--text-secondary)">Listed by <strong>${esc(l.seller_display||l.seller_name)}</strong> · ${fmtDate(l.created_at)}</p>
        ${l.status !== 'available' ? '<div class="alert alert-warning" style="margin-top:12px">This item has been sold.</div>' : ''}
        ${canBuy ? `<button class="btn btn-primary" style="margin-top:12px;width:100%" id="detailBuyBtn" data-id="${l.id}" data-price="${l.price}" data-title="${esc(l.title)}">Buy Now — $${l.price.toFixed(2)}</button>` : ''}
        ${user && l.seller_id !== user.id ? `<button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="Messages.openNewChat(${l.seller_id});closeGenericModal()">💬 Message Seller</button>` : ''}
      </div>`);

    document.getElementById('detailBuyBtn')?.addEventListener('click', (e) => {
      const { id, price, title } = e.target.dataset;
      closeGenericModal();
      showBuyConfirm(parseInt(id), parseFloat(price), title);
    });
  }

  function showBuyConfirm(listingId, price, title) {
    const fee = (price * 0.02).toFixed(2);
    const payout = (price - parseFloat(fee)).toFixed(2);

    openGenericModal('Confirm Purchase', `
      <div>
        <p><strong>${esc(title)}</strong></p>
        <div style="margin:16px 0;background:var(--bg-tertiary);border-radius:8px;padding:14px;font-size:.9rem">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span>Item price</span><span><strong>$${price.toFixed(2)}</strong></span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.82rem;color:var(--text-secondary)">
            <span>Platform fee (2%)</span><span>-$${fee}</span>
          </div>
          <hr style="border:none;border-top:1px solid var(--border);margin:8px 0">
          <div style="display:flex;justify-content:space-between">
            <span>You pay</span><span style="font-weight:700;color:var(--accent)">$${price.toFixed(2)}</span>
          </div>
        </div>
        <p class="alert alert-info" style="font-size:.82rem">Funds are deducted from your wallet. The seller receives $${payout}.</p>
        <p class="form-error" id="buyErr"></p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary" onclick="closeGenericModal()">Cancel</button>
          <button class="btn btn-primary" id="confirmBuyBtn">Confirm Purchase</button>
        </div>
      </div>`);

    document.getElementById('confirmBuyBtn').addEventListener('click', async () => {
      const btn = document.getElementById('confirmBuyBtn');
      btn.disabled = true; btn.textContent = 'Processing…';
      const err = document.getElementById('buyErr');
      try {
        const result = await api.post(`/bazaar/${listingId}/buy`, {});
        closeGenericModal();
        showToast(`✅ Purchase complete! $${result.amount.toFixed(2)} charged.`);
        App.render();
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false; btn.textContent = 'Confirm Purchase';
      }
    });
  }

  function showListingForm(existing) {
    openGenericModal(existing ? 'Edit Listing' : 'Create Listing', `
      <form id="listingForm">
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
            <label class="form-label">Category</label>
            <input class="form-control" name="category" value="${esc(existing?.category||'')}" placeholder="e.g. clothing, tools…">
          </div>
          <div class="form-group">
            <label class="form-label">Price ($) <span style="color:var(--danger)">*</span></label>
            <input class="form-control" name="price" type="number" min="0" step="0.01" required value="${existing?.price||''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Image URL</label>
          <input class="form-control" name="image_url" type="url" value="${esc(existing?.image_url||'')}">
        </div>
        <p class="form-hint">A 2% fee is charged at time of purchase.</p>
        <p class="form-error" id="listFErr"></p>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
          <button type="button" class="btn btn-secondary" id="cancelListForm">Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save Changes' : 'List Item'}</button>
        </div>
      </form>`);

    document.getElementById('cancelListForm').addEventListener('click', closeGenericModal);
    document.getElementById('listingForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('listFErr');
      err.textContent = '';
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd);
      body.price = parseFloat(body.price);
      try {
        if (existing) { await api.patch(`/bazaar/${existing.id}`, body); }
        else           { await api.post('/bazaar', body); }
        closeGenericModal();
        App.render();
      } catch (ex) { err.textContent = ex.message; }
    });
  }

  function showDepositModal() {
    openGenericModal('💳 Add Funds to Wallet', `
      <form id="depositForm">
        <p style="font-size:.88rem;color:var(--text-secondary);margin-bottom:14px">Add funds to your in-app wallet to make purchases in the Bazaar.</p>
        <div class="form-group">
          <label class="form-label">Amount ($)</label>
          <input class="form-control" name="amount" type="number" min="1" max="10000" step="0.01" placeholder="0.00" required>
        </div>
        <p class="form-error" id="depositErr"></p>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button type="button" class="btn btn-secondary" onclick="closeGenericModal()">Cancel</button>
          <button type="submit" class="btn btn-success">Add Funds</button>
        </div>
      </form>`);

    document.getElementById('depositForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = document.getElementById('depositErr');
      err.textContent = '';
      const amount = parseFloat(e.target.amount.value);
      try {
        const res = await api.post('/bazaar/wallet/deposit', { amount });
        closeGenericModal();
        showToast(`✅ $${amount.toFixed(2)} added. New balance: $${res.balance.toFixed(2)}`);
        App.render();
      } catch (ex) { err.textContent = ex.message; }
    });
  }

  function goPage(p) { _page = p; App.render(); }

  return { render, bindEvents, goPage };
})();

window.Bazaar = Bazaar;
