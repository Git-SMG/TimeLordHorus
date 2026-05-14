/* messages.js — Direct Messaging with Socket.io real-time */
'use strict';

const Messages = (() => {
  let _socket = null;
  let _currentPartnerId = null;
  let _typingTimer = null;

  // Connect Socket.io once user is authenticated
  function connect() {
    const token = localStorage.getItem('ch_token');
    if (!token || _socket) return;

    _socket = io({ auth: { token } });

    _socket.on('new_message', (msg) => {
      const thread = document.getElementById('threadMessages');
      if (thread && (msg.sender_id === _currentPartnerId || msg.recipient_id === _currentPartnerId)) {
        appendBubble(thread, msg);
        thread.scrollTop = thread.scrollHeight;
        // Mark as read via socket
        if (msg.sender_id === _currentPartnerId) {
          _socket.emit('mark_read', { partnerId: _currentPartnerId });
        }
      }
      // Update unread badge in nav
      App.refreshUnreadBadge();
      // Refresh conversation list if visible
      const convPanel = document.getElementById('convList');
      if (convPanel) loadConversations(convPanel);
    });

    _socket.on('typing', ({ from, isTyping }) => {
      if (from === _currentPartnerId) {
        const ti = document.getElementById('typingIndicator');
        if (ti) ti.textContent = isTyping ? 'typing…' : '';
      }
    });

    _socket.on('messages_read', () => {
      App.refreshUnreadBadge();
    });

    _socket.on('disconnect', () => {
      _socket = null;
    });
  }

  function disconnect() {
    if (_socket) { _socket.disconnect(); _socket = null; }
  }

  async function render(partnerId) {
    const user = Auth.getUser();
    if (!user) {
      Auth.showLoginModal('#/messages');
      return '<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-text">Sign in to send messages</div></div>';
    }

    connect();
    _currentPartnerId = partnerId ? parseInt(partnerId) : null;

    return `
      <div class="page-header">
        <div class="page-title">💬 Messages</div>
        <div class="page-subtitle">Direct messages between community members</div>
      </div>
      <div class="messages-layout">
        <div class="conversations-panel">
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);font-weight:700;font-size:.9rem">Conversations</div>
          <div id="convList"><div class="spinner"></div></div>
        </div>
        <div class="thread-panel" id="threadPanel">
          <div class="empty-state" style="margin:auto">
            <div class="empty-icon">💬</div>
            <div class="empty-text">Select a conversation</div>
            <div class="empty-sub">or find a user to message</div>
          </div>
        </div>
      </div>`;
  }

  async function bindEvents(root) {
    const convList = root.querySelector('#convList');
    if (convList) await loadConversations(convList);

    // If a partnerId was in the URL, open that thread
    if (_currentPartnerId) {
      openThread(_currentPartnerId);
    }
  }

  async function loadConversations(container) {
    let convs;
    try { convs = await api.get('/messages/conversations'); }
    catch (_) { container.innerHTML = '<p class="form-error" style="padding:12px">Failed to load</p>'; return; }

    if (!convs.length) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:.85rem">No conversations yet.</div>';
      return;
    }

    container.innerHTML = convs.map(c => `
      <div class="conv-item${_currentPartnerId === c.partner_id ? ' active' : ''}" data-partner-id="${c.partner_id}">
        <div class="conv-avatar">${(c.partner_display || c.partner_username)[0].toUpperCase()}</div>
        <div class="conv-info">
          <div class="conv-name">${esc(c.partner_display || c.partner_username)}</div>
          <div class="conv-last-msg">${esc(c.body.slice(0, 40))}${c.body.length > 40 ? '…' : ''}</div>
        </div>
        ${c.unread_count > 0 ? `<span class="conv-unread">${c.unread_count}</span>` : ''}
      </div>`).join('');

    container.querySelectorAll('.conv-item').forEach(el => {
      el.addEventListener('click', () => {
        _currentPartnerId = parseInt(el.dataset.partnerId);
        container.querySelectorAll('.conv-item').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        openThread(_currentPartnerId);
      });
    });
  }

  async function openThread(partnerId) {
    const threadPanel = document.getElementById('threadPanel');
    if (!threadPanel) return;

    let data;
    try { data = await api.get(`/messages/${partnerId}`); }
    catch (ex) {
      threadPanel.innerHTML = `<div class="empty-state" style="margin:auto"><div class="empty-icon">⚠️</div><div class="empty-text">${esc(ex.message)}</div></div>`;
      return;
    }

    const { messages, partner } = data;
    const currentUserId = Auth.getUser().id;

    threadPanel.innerHTML = `
      <div class="thread-header">
        <div class="conv-avatar" style="width:32px;height:32px;font-size:.85rem">${(partner.username)[0].toUpperCase()}</div>
        <span>${esc(partner.username)}</span>
        <span class="badge badge-role-${partner.role}" style="margin-left:4px">${partner.role.replace('_',' ')}</span>
      </div>
      <div class="thread-messages" id="threadMessages">
        ${messages.map(m => bubbleHtml(m, currentUserId)).join('')}
      </div>
      <div class="typing-indicator" id="typingIndicator"></div>
      <div class="thread-input-bar">
        <textarea class="form-control" id="msgInput" placeholder="Type a message…" rows="1"></textarea>
        <button class="btn btn-primary" id="sendMsgBtn">Send</button>
      </div>`;

    const tm = threadPanel.querySelector('#threadMessages');
    tm.scrollTop = tm.scrollHeight;

    const input = threadPanel.querySelector('#msgInput');
    const sendBtn = threadPanel.querySelector('#sendMsgBtn');

    sendBtn.addEventListener('click', () => sendMessage(partnerId, input));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(partnerId, input); }
    });
    input.addEventListener('input', () => {
      if (_socket) {
        _socket.emit('typing', { recipientId: partnerId, isTyping: true });
        clearTimeout(_typingTimer);
        _typingTimer = setTimeout(() => {
          _socket.emit('typing', { recipientId: partnerId, isTyping: false });
        }, 1500);
      }
    });
  }

  function sendMessage(partnerId, input) {
    const body = input.value.trim();
    if (!body) return;
    input.value = '';
    input.style.height = '';

    if (_socket) {
      _socket.emit('send_message', { recipientId: partnerId, body }, (ack) => {
        if (ack?.error) console.warn('Message error:', ack.error);
      });
    } else {
      // Fallback to REST
      api.post(`/messages/${partnerId}`, { body }).then(() => openThread(partnerId));
    }
  }

  function bubbleHtml(m, currentUserId) {
    const isSent = m.sender_id === currentUserId;
    return `
      <div style="display:flex;flex-direction:column;align-items:${isSent?'flex-end':'flex-start'}">
        <div class="msg-bubble ${isSent?'sent':'received'}">${esc(m.body)}</div>
        <div class="msg-time">${fmtTime(m.created_at)}</div>
      </div>`;
  }

  function appendBubble(container, m) {
    const currentUserId = Auth.getUser()?.id;
    const div = document.createElement('div');
    div.innerHTML = bubbleHtml(m, currentUserId);
    while (div.firstChild) container.appendChild(div.firstChild);
  }

  // Open a new chat with any user by ID
  function openNewChat(userId) {
    _currentPartnerId = userId;
    App.navigate(`#/messages/${userId}`);
  }

  return { render, bindEvents, connect, disconnect, openNewChat };
})();

window.Messages = Messages;
