/* api.js — Thin fetch wrapper for Community Hub API */
'use strict';

const API_BASE = '/api';

const api = {
  _token() {
    return localStorage.getItem('ch_token');
  },

  _headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    const t = this._token();
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  },

  async _fetch(method, path, body) {
    const opts = { method, headers: this._headers() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
    return data;
  },

  get(path)         { return this._fetch('GET',    path); },
  post(path, body)  { return this._fetch('POST',   path, body); },
  patch(path, body) { return this._fetch('PATCH',  path, body); },
  delete(path)      { return this._fetch('DELETE', path); },
};

window.api = api;
