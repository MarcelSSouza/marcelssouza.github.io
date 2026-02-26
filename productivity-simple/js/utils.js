/**
 * Utility Functions
 * Common helpers used across the application
 */

// ──────────────────────────────────────────────────────────
// String & Display Utilities
// ──────────────────────────────────────────────────────────

export const esc = s => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const fmt$ = n => '$' + Math.abs(n).toFixed(2);

export const uid = () => Math.random().toString(36).slice(2, 9);

// ──────────────────────────────────────────────────────────
// Date Utilities
// ──────────────────────────────────────────────────────────

export const today = () => new Date().toISOString().slice(0, 10);

export const ddiff = ds =>
    Math.round((new Date(ds + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000);

export const fdate = ds => {
    const d = ddiff(ds);
    if (d === 0) return 'Today';
    if (d === 1) return 'Tomorrow';
    if (d === -1) return 'Yesterday';
    return new Date(ds + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
    });
};

export const fdate2 = ds => {
    const d = ddiff(ds);
    if (d === 0) return 'Today';
    if (d === -1) return 'Yesterday';
    return new Date(ds + 'T00:00:00').toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

export const shortDate = ts => {
    const d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString())
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// ──────────────────────────────────────────────────────────
// UI Utilities
// ──────────────────────────────────────────────────────────

export const toast = msg => {
    let el = document.getElementById('toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = '';
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
        el.className = 'hide';
        setTimeout(() => el.remove(), 220);
    }, 2200);
};

export const openModal = id => {
    document.getElementById(id).classList.add('open');
    setTimeout(() => {
        const f = document.querySelector(`#${id} input`);
        if (f) f.focus();
    }, 60);
};

export const closeModal = () => {
    document.querySelectorAll('.mbk').forEach(m => m.classList.remove('open'));
};

export const showPage = (p, render) => {
    window._currentPage = p;
    document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.nb').forEach(x => x.classList.remove('active'));
    document.getElementById('page-' + p).classList.add('active');
    document.querySelector(`.nb[data-page="${p}"]`).classList.add('active');
    document.getElementById('fab').style.display = p === 'pomodoro' ? 'none' : 'flex';
    if (render) render();
};

// ──────────────────────────────────────────────────────────
// DOM Utilities
// ──────────────────────────────────────────────────────────

export const query = selector => document.querySelector(selector);
export const queryAll = selector => document.querySelectorAll(selector);
export const byId = id => document.getElementById(id);

export const setAttr = (el, attr, value) => el.setAttribute(attr, value);
export const getAttr = (el, attr) => el.getAttribute(attr);
export const toggleClass = (el, cls, force) => el.classList.toggle(cls, force);
export const addClass = (el, cls) => el.classList.add(cls);
export const removeClass = (el, cls) => el.classList.remove(cls);
