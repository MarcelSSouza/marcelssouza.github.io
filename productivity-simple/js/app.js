/**
 * Focus - Productivity App
 * Main application file
 * 
 * This file orchestrates all app functionality and ties together
 * the various modules (habits, todos, calendar, etc.)
 */

import {
    esc, fmt$, uid, today, ddiff, fdate, fdate2, shortDate,
    toast, openModal, closeModal, showPage, byId, queryAll
} from './utils.js';

import { S, initFirebase, getCurrentUser, authAction, doSignOut } from './storage.js';

// ══════════════════════════════════════════════════════════
// APPLICATION STATE
// ══════════════════════════════════════════════════════════

window._appState = {
    habits: S.get('h2', []),
    hlog: S.get('hl2', {}),
    todos: S.get('t2', []),
    calEvents: S.get('ev2', []),
    expenses: S.get('ex2', []),
    notes: S.get('nt2', []),
    grocery: S.get('gr2', []),
    games: S.get('gm2', []),
    dark: S.get('dark', false),
    page: 'habits',
    calY: new Date().getFullYear(),
    calM: new Date().getMonth(),
    calSel: null,
    expFilter: 'All',
    activeNote: null,
    selColor: '#5b6ef5'
};

const COLORS = ['#5b6ef5', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#14b8a6'];
const CAT_COLORS = {
    '🍔 Food': '#f97316', '🚗 Transport': '#06b6d4', '🛍 Shopping': '#ec4899',
    '🏠 Housing': '#8b5cf6', '💊 Health': '#22c55e', '🎮 Entertainment': '#5b6ef5',
    '📚 Education': '#f59e0b', '💡 Utilities': '#eab308', '✈️ Travel': '#3b82f6', '🔧 Other': '#9ca3af'
};

// ══════════════════════════════════════════════════════════
// DARK MODE
// ══════════════════════════════════════════════════════════

const darkMode = {
    toggle() {
        const state = window._appState;
        state.dark = !state.dark;
        S.set('dark', state.dark);
        this.apply();
        if (state.page === 'expenses') renderExpenses();
    },
    apply() {
        const isDark = window._appState.dark;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        byId('dark-ic').textContent = isDark ? '☀️' : '🌙';
    }
};

// ══════════════════════════════════════════════════════════
// MOBILE NAVIGATION - HAMBURGER MENU
// ══════════════════════════════════════════════════════════

const nav = {
    toggle() {
        const navEl = byId('nav');
        const hamburger = byId('hamburger');

        if (navEl.classList.contains('mobile-open')) {
            navEl.classList.remove('mobile-open');
            hamburger.classList.remove('open');
        } else {
            navEl.classList.add('mobile-open');
            hamburger.classList.add('open');
        }
    },

    close() {
        const navEl = byId('nav');
        const hamburger = byId('hamburger');
        navEl.classList.remove('mobile-open');
        hamburger.classList.remove('open');
    }
};

// Close mobile menu when a nav button is clicked
queryAll('.nb').forEach(btn => {
    btn.addEventListener('click', () => nav.close());
});

// Close mobile menu when clicking outside (on overlay)
document.addEventListener('click', (e) => {
    const nav = byId('nav');
    const hamburger = byId('hamburger');
    if (!nav?.contains(e.target) && !hamburger?.contains(e.target)) {
        if (nav?.classList.contains('mobile-open')) {
            nav.classList.remove('mobile-open');
            hamburger.classList.remove('open');
        }
    }
});

// ══════════════════════════════════════════════════════════
// UTILITIES - EXPORT TO WINDOW
// ══════════════════════════════════════════════════════════

window._utils = { closeModal, openModal, toast };
window._darkMode = darkMode;
window._auth = { action: authAction, confirmLogout: doSignOut };
window._nav = nav;

// ══════════════════════════════════════════════════════════
// NAVIGATION & RENDERING
// ══════════════════════════════════════════════════════════

const render = () => {
    const state = window._appState;
    if (state.page === 'habits') renderHabits();
    if (state.page === 'todos') renderTodos();
    if (state.page === 'calendar') renderCalendar();
    if (state.page === 'expenses') renderExpenses();
    if (state.page === 'notes') renderNotes();
    if (state.page === 'grocery') renderGrocery();
    if (state.page === 'games') renderGames();
};

window._render = render;

// Setup navigation
queryAll('.nb').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        window._appState.page = page;
        showPage(page, render);
        // Close mobile menu after navigation
        nav.close();
    });
});

// ══════════════════════════════════════════════════════════
// FAB - FLOATING ACTION BUTTON
// ══════════════════════════════════════════════════════════

const fabClick = () => {
    const state = window._appState;
    const map = { habits: 'mh', todos: 'mt', calendar: 'me', expenses: 'mx', grocery: 'mg', notes: null, games: 'mg-add' };

    if (state.page === 'notes') {
        newNote();
        return;
    }

    const id = map[state.page];
    if (!id) return;

    if (state.page === 'habits') {
        renderSwatches();
        byId('hname').value = '';
        byId('hweekly').value = '0';
        byId('hreminder-time').value = '';
        byId('hreminder-enabled').checked = false;
    }
    if (state.page === 'calendar') {
        byId('edate').value = state.calSel || today();
        byId('etime').value = '';
        byId('etitle').value = '';
        byId('enotes').value = '';
    }
    if (state.page === 'todos') {
        byId('ttitle').value = '';
        byId('tpri').value = 'none';
        byId('tdue').value = '';
        byId('trepeat').value = 'none';
    }
    if (state.page === 'expenses') {
        byId('xdate').value = today();
        byId('xdesc').value = '';
        byId('xamount').value = '';
    }
    if (state.page === 'games') {
        gameResetAddModal();
    }

    openModal(id);
};

window._fab = { click: fabClick };
queryAll('.mbk').forEach(el => {
    el.addEventListener('click', e => {
        if (e.target === el) closeModal();
    });
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
});

// ══════════════════════════════════════════════════════════
// HABITS
// ══════════════════════════════════════════════════════════

const renderSwatches = () => {
    const c = byId('hswatches');
    c.innerHTML = '';
    COLORS.forEach(col => {
        const s = document.createElement('div');
        s.className = 'sw' + (col === window._appState.selColor ? ' sel' : '');
        s.style.background = col;
        s.onclick = () => {
            window._appState.selColor = col;
            renderSwatches();
        };
        c.appendChild(s);
    });
};

const createHabit = () => {
    const n = byId('hname').value.trim();
    if (!n) return;
    window._appState.habits.push({
        id: uid(),
        name: n,
        color: window._appState.selColor,
        weeklyGoal: parseInt(byId('hweekly')?.value) || 0,
        reminderTime: byId('hreminder-time')?.value || '',
        reminderEnabled: byId('hreminder-enabled')?.checked || false
    });
    S.set('h2', window._appState.habits);
    closeModal();
    renderHabits();
    toast('Habit created 🔥');
};

const toggleHabit = id => {
    const state = window._appState;
    const k = today() + ':' + id;
    state.hlog[k] ? delete state.hlog[k] : (state.hlog[k] = true);
    S.set('hl2', state.hlog);
    renderHabits();
};

const deleteHabit = id => {
    window._appState.habits = window._appState.habits.filter(h => h.id !== id);
    S.set('h2', window._appState.habits);
    renderHabits();
};

const openEditHabit = id => {
    const h = window._appState.habits.find(x => x.id === id);
    if (!h) return;
    byId('hedit-id').value = id;
    byId('hname-edit').value = h.name;
    byId('hweekly-edit').value = h.weeklyGoal || 0;
    byId('hreminder-time-edit').value = h.reminderTime || '';
    byId('hreminder-enabled-edit').checked = h.reminderEnabled || false;
    window._appState.selColor = h.color;
    renderSwatchesEdit();
    openModal('mh-edit');
};

const renderSwatchesEdit = () => {
    const c = byId('hswatches-edit');
    if (!c) return;
    c.innerHTML = '';
    COLORS.forEach(col => {
        const s = document.createElement('div');
        s.className = 'sw' + (col === window._appState.selColor ? ' sel' : '');
        s.style.background = col;
        s.onclick = () => { window._appState.selColor = col; renderSwatchesEdit(); };
        c.appendChild(s);
    });
};

const saveEditHabit = () => {
    const id = byId('hedit-id').value;
    const h = window._appState.habits.find(x => x.id === id);
    if (!h) return;
    const name = byId('hname-edit').value.trim();
    if (!name) return;
    h.name = name;
    h.color = window._appState.selColor;
    h.weeklyGoal = parseInt(byId('hweekly-edit')?.value) || 0;
    h.reminderTime = byId('hreminder-time-edit')?.value || '';
    h.reminderEnabled = byId('hreminder-enabled-edit')?.checked || false;
    S.set('h2', window._appState.habits);
    closeModal();
    renderHabits();
    toast('Habit updated 🔥');
};

const hStreak = id => {
    let n = 0, d = new Date();
    // Include today if already checked in
    if (!window._appState.hlog[d.toISOString().slice(0, 10) + ':' + id]) {
        d.setDate(d.getDate() - 1);
    }
    while (window._appState.hlog[d.toISOString().slice(0, 10) + ':' + id]) {
        n++;
        d.setDate(d.getDate() - 1);
    }
    return n;
};

const hLast30 = id => {
    const out = [], b = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(b);
        d.setDate(b.getDate() - i);
        out.push(!!window._appState.hlog[d.toISOString().slice(0, 10) + ':' + id]);
    }
    return out;
};

const hWeekCount = id => {
    const mon = new Date();
    mon.setDate(mon.getDate() - ((mon.getDay() || 7) - 1));
    let n = 0;
    for (let i = 0; i < 7; i++) {
        const d = new Date(mon);
        d.setDate(mon.getDate() + i);
        if (window._appState.hlog[d.toISOString().slice(0, 10) + ':' + id]) n++;
    }
    return n;
};

const checkHabitReminders = () => {
    if (Notification.permission !== 'granted') return;
    const now = new Date();
    const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const notified = S.get('hrem', {});
    window._appState.habits.forEach(h => {
        if (!h.reminderEnabled || !h.reminderTime || h.reminderTime !== hhmm) return;
        if (!!window._appState.hlog[today() + ':' + h.id]) return; // already checked in
        if (notified[h.id] === today()) return; // already notified today
        new Notification('Focus', { body: '🔥 Time to check in: ' + h.name, icon: 'favicon.svg' });
        notified[h.id] = today();
        localStorage.setItem('hrem', JSON.stringify(notified));
    });
};

const renderHabits = () => {
    const state = window._appState;
    const g = byId('hgrid');
    if (!state.habits.length) {
        g.innerHTML = `<div class="empty"><span class="empty-ic">🔥</span>No habits yet.<br>Hit <strong>+</strong> to add one.</div>`;
        return;
    }
    g.innerHTML = '';
    state.habits.forEach(h => {
        const done = !!state.hlog[today() + ':' + h.id];
        const streak = hStreak(h.id);
        const l30 = hLast30(h.id);
        const weekDone = h.weeklyGoal > 0 ? hWeekCount(h.id) : 0;
        const weekPct = h.weeklyGoal > 0 ? Math.min(weekDone / h.weeklyGoal * 100, 100) : 0;
        const card = document.createElement('div');
        card.className = 'card hcard';
        card.innerHTML = `
      <div class="htop">
        <div class="hdot" style="background:${h.color}"></div>
        <span class="hname">${esc(h.name)}</span>
        ${h.reminderEnabled && h.reminderTime ? `<span style="font-size:10px;color:var(--t3);margin-right:4px">🔔${h.reminderTime}</span>` : ''}
        <button class="hchk ${done ? 'done' : ''}" style="${done ? `background:${h.color};border-color:${h.color}` : ''}" onclick="window._habits?.toggle?.('${h.id}')">${done ? '✓' : ''}</button>
      </div>
      <div class="hmeta">🔥 ${streak} day streak &nbsp;·&nbsp; ${l30.filter(Boolean).length}/30 this month</div>
      <div class="hhm">${l30.map(v => `<div class="hc" style="background:${v ? h.color : 'var(--border)'};opacity:${v ? 1 : .35}"></div>`).join('')}</div>
      ${h.weeklyGoal > 0 ? `
      <div class="hweek-lbl">This week: ${weekDone} / ${h.weeklyGoal}</div>
      <div class="hweek-bar"><div class="hweek-fill" style="width:${weekPct}%;background:${h.color}"></div></div>` : ''}
      <div style="display:flex;justify-content:flex-end;gap:4px;margin-top:6px">
        <button class="ico-btn" onclick="window._habits?.edit?.('${h.id}')" title="Edit">✎</button>
        <button class="ico-btn" onclick="window._habits?.delete?.('${h.id}')">🗑</button>
      </div>`;
        g.appendChild(card);
    });
};

window._habits = { create: createHabit, toggle: toggleHabit, delete: deleteHabit, edit: openEditHabit, saveEdit: saveEditHabit };

byId('hname').addEventListener('keydown', e => {
    if (e.key === 'Enter') createHabit();
});

byId('hname-edit').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEditHabit();
});

// ══════════════════════════════════════════════════════════
// TODOS
// ══════════════════════════════════════════════════════════

const createTodo = () => {
    const t = byId('ttitle').value.trim();
    if (!t) return;
    window._appState.todos.push({
        id: uid(),
        title: t,
        priority: byId('tpri').value,
        due: byId('tdue').value || null,
        repeat: byId('trepeat')?.value || 'none',
        done: false,
        at: Date.now()
    });
    S.set('t2', window._appState.todos);
    closeModal();
    renderTodos();
    pomUpdateTodoDropdown();
    toast('Task added ✅');
};

const toggleTodo = id => {
    const t = window._appState.todos.find(x => x.id === id);
    if (t) {
        t.done = !t.done;
        S.set('t2', window._appState.todos);
        renderTodos();
        pomUpdateTodoDropdown();
    }
};

const deleteTodo = id => {
    window._appState.todos = window._appState.todos.filter(x => x.id !== id);
    S.set('t2', window._appState.todos);
    renderTodos();
    pomUpdateTodoDropdown();
};

const openEditTodo = id => {
    const t = window._appState.todos.find(x => x.id === id);
    if (!t) return;
    byId('tedit-id').value = id;
    byId('ttitle-edit').value = t.title;
    byId('tpri-edit').value = t.priority || 'none';
    byId('tdue-edit').value = t.due || '';
    byId('trepeat-edit').value = t.repeat || 'none';
    openModal('mt-edit');
};

const saveEditTodo = () => {
    const id = byId('tedit-id').value;
    const t = window._appState.todos.find(x => x.id === id);
    if (!t) return;
    const title = byId('ttitle-edit').value.trim();
    if (!title) return;
    t.title = title;
    t.priority = byId('tpri-edit').value;
    t.due = byId('tdue-edit').value || null;
    t.repeat = byId('trepeat-edit').value || 'none';
    S.set('t2', window._appState.todos);
    closeModal();
    renderTodos();
    pomUpdateTodoDropdown();
    toast('Task updated ✅');
};

const processDueRecurring = () => {
    const state = window._appState;
    let changed = false;
    state.todos.forEach(t => {
        if (t.repeat && t.repeat !== 'none' && t.done && t.due && t.due < today()) {
            const d = new Date(t.due + 'T00:00:00');
            const days = t.repeat === 'weekly' ? 7 : 1;
            // Advance due date until it's today or future
            while (t.due < today()) {
                d.setDate(d.getDate() + days);
                t.due = d.toISOString().slice(0, 10);
            }
            t.done = false;
            changed = true;
        }
    });
    if (changed) S.set('t2', state.todos);
};

const dueBadge = (due, done) => {
    if (!due) return '';
    const d = ddiff(due);
    if (done) return `<span class="chip ck">${fdate(due)}</span>`;
    if (d < 0) return `<span class="chip co">Overdue</span>`;
    if (d === 0) return `<span class="chip cd">Due today</span>`;
    return `<span class="chip ck">${fdate(due)}</span>`;
};

const todoSearch = () => renderTodos();
const todoApplyFilter = () => renderTodos();
const todoApplySort = () => renderTodos();

const renderTodos = () => {
    const state = window._appState;
    const el = byId('tlist');
    const q = (byId('todo-search')?.value || '').toLowerCase();
    const filter = byId('todo-filter')?.value || 'all';
    const sortBy = byId('todo-sort')?.value || 'priority';

    if (!state.todos.length) {
        el.innerHTML = `<div class="empty"><span class="empty-ic">✅</span>No tasks yet.<br>Hit <strong>+</strong> to add one.</div>`;
        return;
    }

    const po = { high: 0, medium: 1, low: 2, none: 3 };
    let list = [...state.todos];

    // Filter
    if (filter === 'active') list = list.filter(x => !x.done);
    else if (filter === 'done') list = list.filter(x => x.done);
    else if (filter === 'high') list = list.filter(x => x.priority === 'high');
    else if (filter === 'overdue') list = list.filter(x => !x.done && x.due && ddiff(x.due) < 0);

    // Search
    if (q) list = list.filter(x => x.title.toLowerCase().includes(q));

    if (!list.length) {
        el.innerHTML = `<div class="empty"><span class="empty-ic">🔍</span>No matching tasks.</div>`;
        return;
    }

    // Sort (done items always last)
    const sortFn = sortBy === 'due-asc'
        ? (a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1
        : sortBy === 'due-desc'
            ? (a, b) => (a.due || '') > (b.due || '') ? -1 : 1
            : sortBy === 'newest'
                ? (a, b) => b.at - a.at
                : (a, b) => (po[a.priority] || 3) - (po[b.priority] || 3);

    const sorted = [
        ...list.filter(x => !x.done).sort(sortFn),
        ...list.filter(x => x.done).sort(sortFn)
    ];
    el.innerHTML = sorted.map(t => `
    <div class="ti">
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="window._todos?.toggle?.('${t.id}')"/>
      <span class="tt ${t.done ? 'done' : ''}">${esc(t.title)}</span>
      <div class="tmeta">
        ${t.priority !== 'none' ? `<span class="chip c${t.priority[0]}">${t.priority}</span>` : ''}
        ${dueBadge(t.due, t.done)}
        ${t.repeat && t.repeat !== 'none' ? `<span class="chip" style="background:var(--pdim);color:var(--primary)">🔁 ${t.repeat}</span>` : ''}
        ${t.pomCount ? `<span class="chip" style="background:var(--pdim);color:var(--primary)">🍅×${t.pomCount}</span>` : ''}
      </div>
      <button class="ico-btn" onclick="window._todos?.edit?.('${t.id}')" title="Edit">✎</button>
      <button class="ico-btn" onclick="window._todos?.delete?.('${t.id}')">×</button>
    </div>`).join('');
};

window._todos = { create: createTodo, toggle: toggleTodo, delete: deleteTodo, edit: openEditTodo, saveEdit: saveEditTodo, search: todoSearch, applyFilter: todoApplyFilter, applySort: todoApplySort };

byId('ttitle').addEventListener('keydown', e => {
    if (e.key === 'Enter') createTodo();
});

byId('ttitle-edit').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEditTodo();
});

// ══════════════════════════════════════════════════════════
// CALENDAR
// ══════════════════════════════════════════════════════════

const createEvent = () => {
    const titleEl = byId('etitle');
    const dateEl = byId('edate');
    const title = titleEl.value.trim();
    const date = dateEl.value || today();
    titleEl.style.borderColor = '';
    dateEl.style.borderColor = '';
    if (!title) {
        titleEl.style.borderColor = 'var(--red)';
        titleEl.focus();
        return;
    }
    const ev = {
        id: uid(),
        title,
        date,
        time: byId('etime').value || null,
        evnotes: byId('enotes').value.trim() || null
    };
    window._appState.calEvents.push(ev);
    S.set('ev2', window._appState.calEvents);
    closeModal();
    window._appState.calSel = date;
    renderCalendar();
    toast('Event saved 📅');
};

const deleteEvent = id => {
    window._appState.calEvents = window._appState.calEvents.filter(e => e.id !== id);
    S.set('ev2', window._appState.calEvents);
    renderCalendar();
};

const openEditEvent = id => {
    const e = window._appState.calEvents.find(x => x.id === id);
    if (!e) return;
    byId('eeedit-id').value = id;
    byId('eetitle').value = e.title;
    byId('eedate').value = e.date;
    byId('eetime').value = e.time || '';
    byId('eenotes').value = e.evnotes || '';
    openModal('me-edit');
};

const saveEditEvent = () => {
    const id = byId('eeedit-id').value;
    const e = window._appState.calEvents.find(x => x.id === id);
    if (!e) return;
    const title = byId('eetitle').value.trim();
    if (!title) { byId('eetitle').style.borderColor = 'var(--red)'; byId('eetitle').focus(); return; }
    byId('eetitle').style.borderColor = '';
    e.title = title;
    e.date = byId('eedate').value;
    e.time = byId('eetime').value || null;
    e.evnotes = byId('eenotes').value.trim() || null;
    S.set('ev2', window._appState.calEvents);
    closeModal();
    window._appState.calSel = e.date;
    renderCalendar();
    toast('Event updated 📅');
};

const calMove = d => {
    const state = window._appState;
    state.calM += d;
    if (state.calM < 0) {
        state.calM = 11;
        state.calY--;
    }
    if (state.calM > 11) {
        state.calM = 0;
        state.calY++;
    }
    state.calSel = null;
    renderCalendar();
};

const calGoToday = () => {
    const state = window._appState;
    state.calY = new Date().getFullYear();
    state.calM = new Date().getMonth();
    state.calSel = today();
    renderCalendar();
    showDetail(state.calSel);
};

const calClick = ds => {
    window._appState.calSel = ds;
    renderCalendar();
    showDetail(ds);
};

const showDetail = ds => {
    const state = window._appState;
    const det = byId('cdetail');
    const de = state.calEvents.filter(e => e.date === ds);
    const dt = state.todos.filter(t => t.due === ds);
    if (!de.length && !dt.length) {
        det.className = 'card detail';
        return;
    }
    const lbl = new Date(ds + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    let html = `<h4>${esc(lbl)}</h4>`;
    de.forEach(e => {
        html += `<div class="det-row">
      <div class="det-dot" style="background:var(--primary)"></div>
      <span style="flex:1">${e.time ? `<strong>${esc(e.time)}</strong> ` : ''}${esc(e.title)}${e.evnotes ? `<br><small style="color:var(--t3)">${esc(e.evnotes)}</small>` : ''}</span>
      <button class="ico-btn" onclick="window._calendar?.editEvent?.('${e.id}')" title="Edit">✎</button>
      <button class="ico-btn" onclick="window._calendar?.deleteEvent?.('${e.id}')">×</button>
    </div>`;
    });
    dt.forEach(t => {
        const ov = ddiff(t.due) < 0 && !t.done;
        html += `<div class="det-row">
      <div class="det-dot" style="background:${ov ? 'var(--red)' : 'var(--green)'}"></div>
      <span class="${t.done ? 'tt done' : ''}" style="flex:1">${esc(t.title)}</span>
      <span class="chip ${ov ? 'co' : 'cl'}" style="font-size:10px">${t.done ? 'done' : ov ? 'overdue' : 'todo'}</span>
    </div>`;
    });
    det.innerHTML = html;
    det.className = 'card detail open';
};

const renderCalendar = () => {
    const state = window._appState;
    byId('cal-title').textContent = new Date(state.calY, state.calM).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const todStr = today();
    const first = new Date(state.calY, state.calM, 1).getDay();
    const dim = new Date(state.calY, state.calM + 1, 0).getDate();
    const dprev = new Date(state.calY, state.calM, 0).getDate();
    const lookup = {};
    const add = (ds, item) => {
        (lookup[ds] = lookup[ds] || []).push(item);
    };
    state.calEvents.forEach(e => add(e.date, { label: (e.time ? e.time + ' ' : '') + e.title, cls: 'ev' }));
    state.todos.filter(t => t.due).forEach(t => add(t.due, { label: t.title, cls: (!t.done && ddiff(t.due) < 0) ? 'ov' : 'td' }));
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let h = DAYS.map(d => `<div class="ch2">${d}</div>`).join('');
    for (let i = first - 1; i >= 0; i--) h += `<div class="cc other"><div class="cnum">${dprev - i}</div></div>`;
    for (let d = 1; d <= dim; d++) {
        const ds = `${state.calY}-${String(state.calM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isT = ds === todStr;
        const isSel = ds === state.calSel;
        const items = (lookup[ds] || []).slice(0, 3);
        h += `<div class="cc${isT ? ' today' : ''}${isSel ? ' sel' : ''}" onclick="window._calendar?.click?.('${ds}')">
      <div class="cnum">${d}</div>
      ${items.map(it => `<div class="ce ${it.cls}">${esc(it.label)}</div>`).join('')}
    </div>`;
    }
    const rem = (first + dim) % 7;
    for (let d = 1; d <= (rem ? 7 - rem : 0); d++) h += `<div class="cc other"><div class="cnum">${d}</div></div>`;
    byId('cgrid').innerHTML = h;
    if (state.calSel) showDetail(state.calSel);
};

window._calendar = {
    move: calMove,
    goToday: calGoToday,
    click: calClick,
    createEvent,
    deleteEvent,
    editEvent: openEditEvent,
    saveEdit: saveEditEvent
};

byId('etitle').addEventListener('keydown', e => {
    if (e.key === 'Enter') createEvent();
});

byId('eetitle').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEditEvent();
});

// ══════════════════════════════════════════════════════════
// POMODORO
// ══════════════════════════════════════════════════════════

const PMODES = {
    work: { lbl: 'Focus time', col: '#5b6ef5' },
    short: { lbl: 'Short break', col: '#22c55e' },
    long: { lbl: 'Long break', col: '#8b5cf6' }
};
const ARC = 2 * Math.PI * 90;

let pCfg = S.get('pcfg', { work: 25, short: 5, long: 15, n: 4 });
let pMode = 'work';
let pSec = pCfg.work * 60;
let pTot = pCfg.work * 60;
let pRun = false;
let _pomLinkedTodoId = null;
let pInt = null;
let pSess = 0;

// ── Noise Engine ──────────────────────────────────────────
let _noiseCtx = null;
let _noiseSource = null;
let _noiseGain = null;
let _noiseType = S.get('noise-type', 'off');
let _noiseVol = S.get('noise-vol', 30);

const _createNoise = type => {
    if (!_noiseCtx) _noiseCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _noiseCtx;
    const bufLen = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    if (type === 'white') {
        for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    } else if (type === 'brown') {
        let last = 0;
        for (let i = 0; i < bufLen; i++) {
            const w = Math.random() * 2 - 1;
            data[i] = (last + 0.02 * w) / 1.02;
            last = data[i];
            data[i] *= 3.5;
        }
    } else if (type === 'pink') {
        let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
        for (let i = 0; i < bufLen; i++) {
            const w = Math.random() * 2 - 1;
            b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
            b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
            b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
            data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11;
            b6 = w * 0.115926;
        }
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = _noiseVol / 100 * 0.4;
    src.connect(gain);
    gain.connect(ctx.destination);
    return { src, gain };
};

const _stopNoise = () => {
    if (_noiseSource) { try { _noiseSource.stop(); } catch(_) {} _noiseSource = null; }
    _noiseGain = null;
};

const noiseSetType = type => {
    _noiseType = type;
    S.set('noise-type', type);
    // Update button styles
    ['off','white','brown','pink'].forEach(t => {
        const btn = byId('noise-' + t);
        if (btn) {
            btn.style.background = t === type ? 'var(--primary)' : '';
            btn.style.color = t === type ? '#fff' : '';
            btn.style.borderColor = t === type ? 'var(--primary)' : '';
        }
    });
    _stopNoise();
    if (type !== 'off' && pRun) {
        const { src, gain } = _createNoise(type);
        _noiseSource = src;
        _noiseGain = gain;
        src.start();
    }
};

const noiseSetVol = () => {
    _noiseVol = parseInt(byId('noise-vol')?.value || 30);
    S.set('noise-vol', _noiseVol);
    byId('noise-vol-lbl').textContent = _noiseVol + '%';
    if (_noiseGain) _noiseGain.gain.value = _noiseVol / 100 * 0.4;
};

const noiseApplyState = () => {
    // Restore button state on page load
    const vol = byId('noise-vol');
    if (vol) vol.value = _noiseVol;
    byId('noise-vol-lbl').textContent = _noiseVol + '%';
    noiseSetType(_noiseType);
};

const pomSetMode = m => {
    if (pRun) pomStop();
    pMode = m;
    pSec = pCfg[m] * 60;
    pTot = pSec;
    queryAll('.ptab').forEach((t, i) => t.classList.toggle('active', ['work', 'short', 'long'][i] === m));
    pomRender();
};

const pomToggle = () => pRun ? pomStop() : pomStart();

const pomStart = () => {
    if (pSec <= 0) pomReset();
    pRun = true;
    byId('pbtn').textContent = '⏸';
    byId('ptime').classList.add('running');
    pInt = setInterval(pomTick, 1000);
    // Start noise if selected
    if (_noiseType !== 'off' && !_noiseSource) {
        const { src, gain } = _createNoise(_noiseType);
        _noiseSource = src;
        _noiseGain = gain;
        src.start();
    }
};

const pomStop = () => {
    pRun = false;
    byId('pbtn').textContent = '▶';
    byId('ptime').classList.remove('running');
    clearInterval(pInt);
    _stopNoise();
};

const pomReset = () => {
    pomStop();
    pSec = pCfg[pMode] * 60;
    pTot = pSec;
    pomRender();
};

const pomSkip = () => {
    pomStop();
    if (pMode === 'work') {
        pSess++;
        pomSetMode(pSess % pCfg.n === 0 ? 'long' : 'short');
    } else {
        pomSetMode('work');
    }
};

const pomUpdateTodoDropdown = () => {
    const sel = byId('pom-todo');
    if (!sel) return;
    const active = window._appState.todos.filter(t => !t.done);
    sel.innerHTML = `<option value="">— No task —</option>` +
        active.map(t => `<option value="${t.id}"${t.id === _pomLinkedTodoId ? ' selected' : ''}>${esc(t.title)}</option>`).join('');
};

const pomSelectTodo = () => {
    _pomLinkedTodoId = byId('pom-todo')?.value || null;
};

const pomTick = () => {
    if (pSec <= 0) {
        pomStop();
        if (Notification.permission === 'granted')
            new Notification(pMode === 'work' ? '⏰ Focus done! Take a break.' : '💪 Break over! Time to focus.');
        // Log pomodoro to linked todo
        if (pMode === 'work' && _pomLinkedTodoId) {
            const t = window._appState.todos.find(x => x.id === _pomLinkedTodoId);
            if (t) {
                t.pomCount = (t.pomCount || 0) + 1;
                S.set('t2', window._appState.todos);
            }
        }
        pomSkip();
        return;
    }
    pSec--;
    pomRender();
};

const pomRender = () => {
    const m = String(Math.floor(pSec / 60)).padStart(2, '0');
    const s = String(pSec % 60).padStart(2, '0');
    byId('ptime').textContent = `${m}:${s}`;
    byId('plbl').textContent = PMODES[pMode].lbl;
    const arc = byId('parc');
    arc.style.strokeDasharray = ARC;
    arc.style.strokeDashoffset = ARC * (1 - pSec / pTot);
    arc.style.stroke = PMODES[pMode].col;
    const dots = byId('pdots');
    dots.innerHTML = Array.from({ length: pCfg.n }, (_, i) => `<div class="pdot ${i < pSess % pCfg.n ? 'done' : ''}"></div>`).join('');
    document.title = pRun ? `${m}:${s} · ${PMODES[pMode].lbl}` : 'Focus';
};

const pomApplySettings = () => {
    pCfg = {
        work: +byId('sw').value || 25,
        short: +byId('ss').value || 5,
        long: +byId('sl').value || 15,
        n: +byId('sn').value || 4
    };
    S.set('pcfg', pCfg);
    if (!pRun) pomSetMode(pMode);
};

if (Notification && Notification.permission === 'default')
    Notification.requestPermission();

window._pomodoro = { setMode: pomSetMode, toggle: pomToggle, reset: pomReset, skip: pomSkip, applySettings: pomApplySettings, setNoise: noiseSetType, setNoiseVol: noiseSetVol, selectTodo: pomSelectTodo, refreshTodos: pomUpdateTodoDropdown };

// ══════════════════════════════════════════════════════════
// EXPENSES
// ══════════════════════════════════════════════════════════

const createExpense = () => {
    const desc = byId('xdesc').value.trim();
    const amt = parseFloat(byId('xamount').value);
    if (!desc || isNaN(amt) || amt <= 0) return;
    window._appState.expenses.push({
        id: uid(),
        desc,
        amount: amt,
        cat: byId('xcat').value,
        date: byId('xdate').value || today()
    });
    S.set('ex2', window._appState.expenses);
    closeModal();
    renderExpenses();
    toast('Expense logged 💰');
};

const deleteExpense = id => {
    window._appState.expenses = window._appState.expenses.filter(x => x.id !== id);
    S.set('ex2', window._appState.expenses);
    renderExpenses();
};

let _pieSegments = [];

const drawPie = () => {
    const canvas = byId('pie-canvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    _pieSegments = [];
    const agg = {};
    window._appState.expenses.forEach(x => {
        agg[x.cat] = (agg[x.cat] || 0) + x.amount;
    });
    const entries = Object.entries(agg);
    if (!entries.length) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--t3').trim() || '#9ba3af';
        ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('No data', W / 2, H / 2); return;
    }
    const total = entries.reduce((s, [, v]) => s + v, 0);
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 20;
    const activeFilter = window._appState.expFilter;
    let angle = -Math.PI / 2;
    entries.forEach(([cat, val]) => {
        const slice = val / total * Math.PI * 2;
        _pieSegments.push({ cat, start: angle, end: angle + slice });
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, angle, angle + slice); ctx.closePath();
        const isActive = activeFilter === 'All' || activeFilter === cat;
        ctx.fillStyle = CAT_COLORS[cat] || '#9ca3af';
        ctx.globalAlpha = isActive ? 1 : 0.4;
        ctx.fill();
        ctx.globalAlpha = 1;
        const mid = angle + slice / 2;
        const lx = cx + Math.cos(mid) * (r * .65);
        const ly = cy + Math.sin(mid) * (r * .65);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (slice > 0.2) ctx.fillText(cat.split(' ')[0], lx, ly);
        angle += slice;
    });
};

const drawBar = () => {
    const canvas = byId('bar-canvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textCol = isDark ? '#9ba3b8' : '#5a606e';
    const gridCol = isDark ? '#2a2f46' : '#e4e6ea';
    const days = []; const base = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(base);
        d.setDate(base.getDate() - i);
        days.push(d.toISOString().slice(0, 10));
    }
    const vals = days.map(ds => window._appState.expenses.filter(x => x.date === ds).reduce((s, x) => s + x.amount, 0));
    const maxV = Math.max(...vals, 1);
    const PAD = { t: 10, r: 10, b: 28, l: 40 };
    const bw = (W - PAD.l - PAD.r) / 7 * .65;
    const gap = (W - PAD.l - PAD.r) / 7;
    const ch = H - PAD.t - PAD.b;
    [0, .25, .5, .75, 1].forEach(f => {
        const y = PAD.t + ch * (1 - f);
        ctx.strokeStyle = gridCol; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = textCol; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText('$' + (maxV * f).toFixed(0), PAD.l - 4, y + 4);
    });
    days.forEach((ds, i) => {
        const val = vals[i];
        const bh = val / maxV * ch;
        const x = PAD.l + i * gap + (gap - bw) / 2;
        const y = PAD.t + ch - bh;
        const grad = ctx.createLinearGradient(0, y, 0, y + bh);
        grad.addColorStop(0, '#5b6ef5'); grad.addColorStop(1, '#8b5cf6');
        ctx.fillStyle = val > 0 ? grad : gridCol;
        const rr = 4;
        ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.lineTo(x + bw - rr, y);
        ctx.quadraticCurveTo(x + bw, y, x + bw, y + rr); ctx.lineTo(x + bw, y + bh);
        ctx.lineTo(x, y + bh); ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = textCol; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        const d = new Date(ds + 'T00:00:00');
        ctx.fillText(d.toLocaleDateString(undefined, { weekday: 'short' }), x + bw / 2, H - 8);
    });
};

const expSetFilter = c => {
    window._appState.expFilter = c;
    renderExpenses();
};

const expSetBudget = () => {
    const val = parseFloat(byId('exp-budget-input').value) || 0;
    S.set('exp-budget', val);
    renderExpenses();
};

const renderExpenses = () => {
    const state = window._appState;
    const tot = state.expenses.reduce((s, x) => s + x.amount, 0);
    const mon = state.expenses.filter(x => x.date.slice(0, 7) === today().slice(0, 7)).reduce((s, x) => s + x.amount, 0);
    byId('exp-total').textContent = fmt$(tot);
    byId('exp-month').textContent = fmt$(mon);
    byId('exp-count').textContent = state.expenses.length;

    // Budget bar
    const budget = S.get('exp-budget', 0);
    const budgetInput = byId('exp-budget-input');
    if (budgetInput && !budgetInput.matches(':focus')) budgetInput.value = budget || '';
    const fill = byId('exp-budget-fill');
    const msg = byId('exp-budget-msg');
    if (fill && msg) {
        if (budget > 0) {
            const pct = Math.min(mon / budget * 100, 100);
            fill.style.width = pct + '%';
            fill.style.background = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'linear-gradient(90deg,var(--green),var(--primary))';
            const left = budget - mon;
            msg.textContent = left >= 0
                ? `$${left.toFixed(2)} remaining of $${budget.toFixed(2)} budget (${Math.round(pct)}% used)`
                : `Over budget by $${Math.abs(left).toFixed(2)}!`;
            msg.style.color = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--t3)';
        } else {
            fill.style.width = '0%';
            msg.textContent = 'Enter a monthly budget above to track spending.';
            msg.style.color = 'var(--t3)';
        }
    }
    const cats = ['All', ...new Set(state.expenses.map(x => x.cat))];
    byId('exp-filters').innerHTML = cats.map(c => `<button class="fchip${c === state.expFilter ? ' active' : ''}" onclick="window._expenses?.setFilter?.('${esc(c)}')">${esc(c)}</button>`).join('');
    const filtered = state.expFilter === 'All' ? state.expenses : state.expenses.filter(x => x.cat === state.expFilter);
    drawPie();
    drawBar();
    const list = byId('exp-list');
    if (!filtered.length) {
        list.innerHTML = `<div class="empty"><span class="empty-ic">💰</span>No expenses yet.</div>`;
        return;
    }
    list.innerHTML = [...filtered].sort((a, b) => b.date.localeCompare(a.date)).map(x => `
    <div class="exp-row">
      <div class="exp-ico" style="background:${CAT_COLORS[x.cat] || '#9ca3af'}22">${x.cat.split(' ')[0]}</div>
      <div class="exp-info">
        <div class="exp-name">${esc(x.desc)}</div>
        <div class="exp-sub">${esc(x.cat.split(' ').slice(1).join(' '))} · ${fdate2(x.date)}</div>
      </div>
      <div class="exp-amt neg">${fmt$(x.amount)}</div>
      <button class="ico-btn" onclick="window._expenses?.delete?.('${x.id}')">×</button>
    </div>`).join('');
};

window._expenses = { create: createExpense, delete: deleteExpense, setFilter: expSetFilter, setBudget: expSetBudget };

byId('xdesc').addEventListener('keydown', e => {
    if (e.key === 'Enter') createExpense();
});

// ══════════════════════════════════════════════════════════
// NOTES
// ══════════════════════════════════════════════════════════

const newNote = () => {
    const n = { id: uid(), title: '', body: '', updatedAt: Date.now(), pinned: false };
    window._appState.notes.unshift(n);
    S.set('nt2', window._appState.notes);
    window._appState.activeNote = n.id;
    renderNotes();
    openNoteEditor(n);
};

const noteDelete = () => {
    const state = window._appState;
    if (!state.activeNote) return;
    state.notes = state.notes.filter(n => n.id !== state.activeNote);
    S.set('nt2', state.notes);
    state.activeNote = null;
    renderNotes();
    showNoteEditor(false);
};

const noteSave = () => {
    const state = window._appState;
    const n = state.notes.find(x => x.id === state.activeNote);
    if (!n) return;
    n.title = byId('ntitle').value;
    n.body = byId('nbody').value;
    n.updatedAt = Date.now();
    S.set('nt2', state.notes);
    renderNotesMeta();
};

const selectNote = id => {
    window._appState.activeNote = id;
    renderNotes();
    openNoteEditor(window._appState.notes.find(n => n.id === id));
};

const openNoteEditor = n => {
    showNoteEditor(true);
    byId('ntitle').value = n.title || '';
    byId('nbody').value = n.body || '';
    updateNoteMeta(n);
    const pinBtn = byId('npin');
    if (pinBtn) pinBtn.textContent = n.pinned ? '📌' : '📍';
    byId('nbody').focus();
};

const togglePinNote = () => {
    const state = window._appState;
    if (!state.activeNote) return;
    const n = state.notes.find(x => x.id === state.activeNote);
    if (!n) return;
    n.pinned = !n.pinned;
    S.set('nt2', state.notes);
    const pinBtn = byId('npin');
    if (pinBtn) pinBtn.textContent = n.pinned ? '📌' : '📍';
    renderNotes(false);
};

const showNoteEditor = show => {
    byId('note-editor').style.display = show ? 'flex' : 'none';
    byId('no-note').style.display = show ? 'none' : 'flex';
};

const updateNoteMeta = n => {
    byId('ndate').textContent = n.updatedAt ? new Date(n.updatedAt).toLocaleString() : '';
    const words = (n.body || '').trim().split(/\s+/).filter(Boolean).length;
    byId('nwords').textContent = words + ' word' + (words === 1 ? '' : 's');
};

const renderNotesMeta = () => {
    const state = window._appState;
    if (state.activeNote) {
        const n = state.notes.find(x => x.id === state.activeNote);
        if (n) updateNoteMeta(n);
    }
    renderNotes(false);
};

const noteSearch = () => renderNotes(false);

const renderNotes = (resetEditor = true) => {
    const state = window._appState;
    const list = byId('notes-list');
    const q = (byId('note-search')?.value || '').toLowerCase();

    if (!state.notes.length) {
        list.innerHTML = `<div class="empty" style="padding:40px 20px"><span class="empty-ic">📝</span>No notes yet</div>`;
        if (resetEditor) {
            state.activeNote = null;
            showNoteEditor(false);
        }
        return;
    }

    // Pinned first, then by updatedAt
    let sorted = [...state.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);
    if (q) sorted = sorted.filter(n => n.title.toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q));

    if (!sorted.length) {
        list.innerHTML = `<div class="empty" style="padding:40px 20px"><span class="empty-ic">🔍</span>No matching notes</div>`;
        return;
    }

    list.innerHTML = sorted.map(n => `
    <div class="note-item${n.id === state.activeNote ? ' active' : ''}" onclick="window._notes?.select?.('${n.id}')">
      <div class="note-title-row">
        <span class="note-item-title">${n.pinned ? '📌 ' : ''}${esc(n.title) || 'Untitled'}</span>
        <span class="note-item-date">${shortDate(n.updatedAt)}</span>
      </div>
      <div class="note-item-preview">${esc((n.body || '').slice(0, 60)) || 'No content'}</div>
    </div>`).join('');
};

window._notes = { save: noteSave, delete: noteDelete, select: selectNote, search: noteSearch, pin: togglePinNote };

// ══════════════════════════════════════════════════════════
// GAMES BACKLOG
// ══════════════════════════════════════════════════════════

const RAWG_KEY = 'a0d9375a85254c8fbe26e0f9a052dd55'; // free public key
const GAME_STATUSES = {
    wishlist:  { label: '🕹 Want to Play', color: '#06b6d4' },
    playing:   { label: '▶ Playing',       color: '#5b6ef5' },
    completed: { label: '✅ Completed',    color: '#22c55e' },
    dropped:   { label: '💀 Dropped',      color: '#9ca3af' }
};

let _gameSearchTimer = null;
let _gameActiveTab = 'all';
let _gameSearchCache = {}; // rawgId → result object

// ── RAWG API ───────────────────────────────────────────────

const rawgSearch = async query => {
    if (!query || query.length < 2) return [];
    try {
        const res = await fetch(
            `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(query)}&page_size=6&search_precise=true`
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.results || [];
    } catch {
        return [];
    }
};

// ── Modal helpers ──────────────────────────────────────────

const gameResetAddModal = () => {
    byId('game-search-input').value = '';
    byId('game-search-results').innerHTML = '';
    byId('game-search-results').style.display = 'none';
    byId('game-selected-preview').style.display = 'none';
    byId('game-selected-preview').innerHTML = '';
    byId('gnew-rawg-id').value = '';
    byId('gnew-cover').value = '';
    byId('gnew-title').value = '';
    byId('gnew-status').value = 'wishlist';
    byId('gnew-rating').value = '';
    byId('gnew-platform').value = '';
    byId('gnew-notes').value = '';
};

const gameLiveSearch = () => {
    clearTimeout(_gameSearchTimer);
    const q = byId('game-search-input').value.trim();
    const resultsEl = byId('game-search-results');
    if (!q) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
    resultsEl.innerHTML = '<div class="gsr-loading">Searching…</div>';
    resultsEl.style.display = 'block';
    _gameSearchTimer = setTimeout(async () => {
        const results = await rawgSearch(q);
        if (!results.length) {
            resultsEl.innerHTML = '<div class="gsr-loading">No results — you can add the title manually below.</div>';
            return;
        }
        _gameSearchCache = {};
        results.forEach(g => { _gameSearchCache[g.id] = g; });
        resultsEl.innerHTML = results.map(g => `
            <div class="gsr-item" onclick="window._games?.pickResult?.(${g.id})">
                ${g.background_image
                    ? `<img class="gsr-cover" src="${g.background_image}" alt="" loading="lazy" />`
                    : `<div class="gsr-cover gsr-cover-ph">🎮</div>`}
                <div class="gsr-info">
                    <div class="gsr-name">${esc(g.name)}</div>
                    <div class="gsr-meta">${g.released ? g.released.slice(0, 4) : ''}${g.platforms?.length ? ' · ' + g.platforms.slice(0, 3).map(p => p.platform.name).join(', ') : ''}</div>
                </div>
            </div>`).join('');
    }, 350);
};

const gamePickResult = id => {
    const g = _gameSearchCache[id];
    if (!g) return;
    byId('gnew-rawg-id').value = id;
    byId('gnew-cover').value = g.background_image || '';
    byId('gnew-title').value = g.name;
    byId('game-search-input').value = g.name;
    byId('game-search-results').style.display = 'none';

    const platforms = g.platforms?.slice(0, 3).map(p => p.platform.name).join(', ') || '';
    if (platforms && !byId('gnew-platform').value) byId('gnew-platform').value = platforms;

    const preview = byId('game-selected-preview');
    preview.style.display = 'flex';
    preview.innerHTML = `
        ${g.background_image ? `<img class="gsp-cover" src="${g.background_image}" alt="" />` : `<div class="gsp-cover gsp-ph">🎮</div>`}
        <div class="gsp-info">
            <div class="gsp-name">${esc(g.name)}</div>
            <div class="gsp-meta">${g.released ? '📅 ' + g.released.slice(0, 4) : ''}${platforms ? ' · ' + platforms : ''}${g.metacritic ? ' · ⭐ ' + g.metacritic + '/100' : ''}</div>
        </div>`;
};

// ── CRUD ───────────────────────────────────────────────────

const createGame = () => {
    const title = byId('gnew-title').value.trim();
    if (!title) { byId('gnew-title').focus(); toast('❌ Enter a game title'); return; }
    const rating = parseInt(byId('gnew-rating').value);
    window._appState.games.push({
        id: uid(),
        rawgId: byId('gnew-rawg-id').value || null,
        title,
        cover: byId('gnew-cover').value || null,
        status: byId('gnew-status').value,
        rating: (rating >= 1 && rating <= 10) ? rating : null,
        platform: byId('gnew-platform').value.trim() || null,
        notes: byId('gnew-notes').value.trim() || null,
        addedAt: Date.now()
    });
    S.set('gm2', window._appState.games);
    closeModal();
    renderGames();
    toast('Game added 🎮');
};

const deleteGame = id => {
    window._appState.games = window._appState.games.filter(g => g.id !== id);
    S.set('gm2', window._appState.games);
    renderGames();
};

const openEditGame = id => {
    const g = window._appState.games.find(x => x.id === id);
    if (!g) return;
    byId('gedit-id').value = id;
    byId('gedit-status').value = g.status;
    byId('gedit-rating').value = g.rating || '';
    byId('gedit-platform').value = g.platform || '';
    byId('gedit-notes').value = g.notes || '';
    const preview = byId('gedit-preview');
    preview.innerHTML = `
        ${g.cover ? `<img class="gsp-cover" src="${g.cover}" alt="" />` : `<div class="gsp-cover gsp-ph">🎮</div>`}
        <div class="gsp-info">
            <div class="gsp-name">${esc(g.title)}</div>
            <div class="gsp-meta">${g.platform || ''}</div>
        </div>`;
    openModal('mg-edit');
};

const saveEditGame = () => {
    const id = byId('gedit-id').value;
    const g = window._appState.games.find(x => x.id === id);
    if (!g) return;
    const rating = parseInt(byId('gedit-rating').value);
    g.status = byId('gedit-status').value;
    g.rating = (rating >= 1 && rating <= 10) ? rating : null;
    g.platform = byId('gedit-platform').value.trim() || null;
    g.notes = byId('gedit-notes').value.trim() || null;
    S.set('gm2', window._appState.games);
    closeModal();
    renderGames();
    toast('Game updated 🎮');
};

const quickStatusChange = (id, status) => {
    const g = window._appState.games.find(x => x.id === id);
    if (!g) return;
    g.status = status;
    S.set('gm2', window._appState.games);
    renderGames();
};

// ── Render ─────────────────────────────────────────────────

const renderGames = () => {
    const state = window._appState;
    const games = state.games;

    // Stats bar
    const statsEl = byId('games-stats');
    const counts = { wishlist: 0, playing: 0, completed: 0, dropped: 0 };
    games.forEach(g => counts[g.status] = (counts[g.status] || 0) + 1);
    statsEl.innerHTML = Object.entries(GAME_STATUSES).map(([k, v]) =>
        `<div class="game-stat-pill" style="--pill-color:${v.color}">
            <span class="game-stat-n">${counts[k] || 0}</span>
            <span class="game-stat-lbl">${v.label}</span>
         </div>`).join('');

    // Filter by active tab
    const q = (byId('games-search')?.value || '').toLowerCase();
    let list = [...games];
    if (_gameActiveTab !== 'all') list = list.filter(g => g.status === _gameActiveTab);
    if (q) list = list.filter(g => g.title.toLowerCase().includes(q));

    // Sort: playing first, then by addedAt desc
    const order = { playing: 0, wishlist: 1, completed: 2, dropped: 3 };
    list.sort((a, b) => (order[a.status] - order[b.status]) || (b.addedAt - a.addedAt));

    const listEl = byId('games-list');
    if (!list.length) {
        listEl.innerHTML = `<div class="empty"><span class="empty-ic">🎮</span>${q ? 'No matching games.' : 'No games yet.<br>Hit <strong>+</strong> to add one.'}</div>`;
        return;
    }

    listEl.innerHTML = list.map(g => {
        const st = GAME_STATUSES[g.status];
        const stars = g.rating ? '★'.repeat(g.rating) + '<span style="color:var(--border)">' + '★'.repeat(10 - g.rating) + '</span>' : '';
        return `
        <div class="game-card card">
            ${g.cover
                ? `<img class="game-cover" src="${g.cover}" alt="${esc(g.title)}" loading="lazy" />`
                : `<div class="game-cover game-cover-ph">🎮</div>`}
            <div class="game-body">
                <div class="game-title">${esc(g.title)}</div>
                <div class="game-meta">
                    <span class="game-status-badge" style="background:${st.color}20;color:${st.color}">${st.label}</span>
                    ${g.platform ? `<span class="game-platform">${esc(g.platform)}</span>` : ''}
                </div>
                ${g.rating ? `<div class="game-stars">${stars} <span style="font-size:11px;color:var(--t3);margin-left:4px">${g.rating}/10</span></div>` : ''}
                ${g.notes ? `<div class="game-notes">${esc(g.notes)}</div>` : ''}
                <div class="game-actions">
                    <select class="game-status-select" onchange="window._games?.quickStatus?.('${g.id}', this.value)">
                        ${Object.entries(GAME_STATUSES).map(([k, v]) =>
                            `<option value="${k}"${g.status === k ? ' selected' : ''}>${v.label}</option>`
                        ).join('')}
                    </select>
                    <button class="ico-btn" onclick="window._games?.edit?.('${g.id}')" title="Edit">✎</button>
                    <button class="ico-btn" onclick="window._games?.delete?.('${g.id}')">🗑</button>
                </div>
            </div>
        </div>`;
    }).join('');
};

const gamesSetTab = tab => {
    _gameActiveTab = tab;
    queryAll('.games-tab').forEach(b => b.classList.toggle('active', b.dataset.status === tab));
    renderGames();
};

const gamesSearch = () => renderGames();

// Tab click listeners
queryAll('.games-tab').forEach(btn => {
    btn.addEventListener('click', () => gamesSetTab(btn.dataset.status));
});

window._games = {
    create: createGame,
    delete: deleteGame,
    edit: openEditGame,
    saveEdit: saveEditGame,
    liveSearch: gameLiveSearch,
    pickResult: gamePickResult,
    quickStatus: quickStatusChange,
    search: gamesSearch
};

// ══════════════════════════════════════════════════════════
// GROCERY
// ══════════════════════════════════════════════════════════

const createGrocery = () => {
    const name = byId('gname').value.trim();
    if (!name) return;
    window._appState.grocery.push({
        id: uid(),
        name,
        qty: parseFloat(byId('gqty').value) || 1,
        unit: byId('gunit').value,
        cat: byId('gcat').value,
        note: byId('gnote').value.trim() || null,
        checked: false,
        addedAt: Date.now()
    });
    S.set('gr2', window._appState.grocery);
    closeModal();
    renderGrocery();
    toast('Item added 🛒');
};

const toggleGrocery = id => {
    const item = window._appState.grocery.find(g => g.id === id);
    if (item) {
        item.checked = !item.checked;
        S.set('gr2', window._appState.grocery);
        renderGrocery();
    }
};

const deleteGrocery = id => {
    window._appState.grocery = window._appState.grocery.filter(g => g.id !== id);
    S.set('gr2', window._appState.grocery);
    renderGrocery();
};

const groceryClearDone = () => {
    window._appState.grocery = window._appState.grocery.filter(g => !g.checked);
    S.set('gr2', window._appState.grocery);
    renderGrocery();
    toast('Checked items removed 🧹');
};

const groceryResetAll = () => {
    window._appState.grocery.forEach(g => g.checked = false);
    S.set('gr2', window._appState.grocery);
    renderGrocery();
    toast('All items unchecked 🛒');
};

const renderGrocery = () => {
    const state = window._appState;
    const done = state.grocery.filter(g => g.checked).length;
    const total = state.grocery.length;
    const pct = total ? done / total * 100 : 0;
    byId('gr-fraction').textContent = `${done} / ${total}`;
    byId('gr-bar').style.width = pct + '%';
    const container = byId('gr-cats');
    if (!state.grocery.length) {
        container.innerHTML = `<div class="empty"><span class="empty-ic">🛒</span>List is empty.<br>Hit <strong>+</strong> to add items.</div>`;
        return;
    }
    const catOrder = ['🥦 Produce', '🥩 Meat', '🥛 Dairy', '🥖 Bakery', '🧊 Frozen', '🥫 Pantry', '🧴 Household', '🫙 Drinks', '🍬 Snacks', '💊 Health', '🛒 Other'];
    const groups = {};
    state.grocery.forEach(g => {
        (groups[g.cat] = groups[g.cat] || []).push(g);
    });
    const sortedCats = [...catOrder.filter(c => groups[c]), ...Object.keys(groups).filter(c => !catOrder.includes(c))];
    container.innerHTML = sortedCats.map(cat => {
        const items = [...groups[cat]].sort((a, b) => a.checked - b.checked);
        const catDone = items.filter(i => i.checked).length;
        return `<div class="gr-cat-section">
      <div class="gr-cat-header">
        <span>${cat}</span>
        <span class="gr-cat-count">${catDone}/${items.length}</span>
      </div>
      <div class="card" style="overflow:hidden">
        ${items.map(g => `
          <div class="gr-item ${g.checked ? 'checked' : ''}" onclick="window._grocery?.toggle?.('${g.id}')">
            <div class="gr-cb">${g.checked ? '✓' : ''}</div>
            <div class="gr-info">
              <div class="gr-name">${esc(g.name)}</div>
              ${g.note ? `<div class="gr-sub">${esc(g.note)}</div>` : ''}
            </div>
            <div class="gr-qty">${g.qty}${g.unit ? ' ' + esc(g.unit) : ''}</div>
            <button class="ico-btn" onclick="event.stopPropagation();window._grocery?.delete?.('${g.id}')">×</button>
          </div>`).join('')}
      </div>
    </div>`;
    }).join('');
};

const groceryShare = () => {
    const encoded = btoa(encodeURIComponent(JSON.stringify(window._appState.grocery)));
    const url = window.location.origin + window.location.pathname + '?share-grocery=' + encoded;
    navigator.clipboard.writeText(url).then(() => {
        toast('📋 Share link copied to clipboard!');
    }).catch(() => {
        prompt('Copy this link to share your grocery list:', url);
    });
};

const checkGroceryShare = () => {
    const param = new URLSearchParams(window.location.search).get('share-grocery');
    if (!param) return;
    try {
        const items = JSON.parse(decodeURIComponent(atob(param)));
        window._appState.grocery = items;
        window._isGroceryShare = true;
        // Hide FAB and show read-only banner
        byId('fab').style.display = 'none';
        const banner = document.createElement('div');
        banner.id = 'share-banner';
        banner.style.cssText = 'background:var(--pdim);color:var(--primary);font-size:13px;font-weight:600;padding:8px 16px;border-radius:var(--r);margin-bottom:14px;text-align:center;';
        banner.textContent = '👁 View only — this is a shared grocery list';
        const page = byId('page-grocery');
        const ph = page.querySelector('.ph');
        ph.insertAdjacentElement('afterend', banner);
        // Navigate to grocery page
        window._appState.page = 'grocery';
        showPage('grocery', render);
        // Re-hide FAB after showPage (showPage re-enables it for non-pomodoro pages)
        byId('fab').style.display = 'none';
    } catch (e) {
        toast('❌ Invalid share link');
    }
};

window._grocery = { create: createGrocery, toggle: toggleGrocery, delete: deleteGrocery, clearDone: groceryClearDone, resetAll: groceryResetAll, share: groceryShare };

byId('gname').addEventListener('keydown', e => {
    if (e.key === 'Enter') createGrocery();
});

// ══════════════════════════════════════════════════════════
// SETTINGS MODULE
// ══════════════════════════════════════════════════════════

const settings = {
    updateUI() {
        const user = getCurrentUser();
        const userDisplay = byId('settings-user');
        const authBtn = byId('settings-auth-btn');

        if (user && !user.isAnonymous) {
            userDisplay.textContent = user.displayName || user.email || 'Signed in';
            authBtn.textContent = '🚪 Sign out';
        } else {
            userDisplay.textContent = 'Not signed in';
            authBtn.textContent = '📧 Sign in with Google';
        }

        // Update dark mode toggle
        const dmToggle = byId('dm-toggle');
        if (dmToggle) {
            dmToggle.textContent = window._appState.dark ? '✅ On' : '🌙 Off';
        }

        // Set version
        const versionInput = byId('contact-version');
        if (versionInput) {
            versionInput.value = 'v1.0 (2026)';
        }
    },

    exportData() {
        const state = window._appState;
        const dataToExport = {
            habits: state.habits,
            hlog: state.hlog,
            todos: state.todos,
            calEvents: state.calEvents,
            expenses: state.expenses,
            notes: state.notes,
            grocery: state.grocery,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focus-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast('📥 Data exported successfully!');
    },

    importData() {
        const input = byId('import-file');
        input.click();
    }
};

// Handle file import
byId('import-file')?.addEventListener('change', function (e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const data = JSON.parse(event.target.result);
            const state = window._appState;

            // Import data
            if (data.habits) state.habits = data.habits;
            if (data.hlog) state.hlog = data.hlog;
            if (data.todos) state.todos = data.todos;
            if (data.calEvents) state.calEvents = data.calEvents;
            if (data.expenses) state.expenses = data.expenses;
            if (data.notes) state.notes = data.notes;
            if (data.grocery) state.grocery = data.grocery;

            // Save to localStorage
            S.set('h2', state.habits);
            S.set('hl2', state.hlog);
            S.set('t2', state.todos);
            S.set('ev2', state.calEvents);
            S.set('ex2', state.expenses);
            S.set('nt2', state.notes);
            S.set('gr2', state.grocery);

            // Refresh UI
            window._render?.();
            toast('📤 Data imported successfully!');
        } catch (err) {
            toast('❌ Invalid file format');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

// ══════════════════════════════════════════════════════════
// CONTACT FORM MODULE
// ══════════════════════════════════════════════════════════

const contactForm = {
    submit(e) {
        e.preventDefault();

        const form = byId('contact-form');
        const email = byId('contact-email').value.trim();
        const subject = form.subject.value;
        const message = byId('contact-message').value.trim();

        if (!email || !subject || !message) {
            toast('❌ Please fill in all fields');
            return;
        }

        const submitBtn = byId('submit-contact');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';

        fetch('https://formspree.io/f/myzojlwp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                email,
                subject,
                message,
                version: byId('contact-version').value,
                sent: new Date().toLocaleString()
            })
        })
            .then(response => response.json().then(data => ({ ok: response.ok, data })))
            .then(({ ok, data }) => {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Report';
                if (ok) {
                    toast('✅ Report sent! Thank you for your feedback.');
                    form.reset();
                    closeModal();
                } else {
                    console.error('Formspree error:', data);
                    toast('❌ Failed to send. Please try again.');
                }
            })
            .catch(err => {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Report';
                console.error('Email send error:', err);
                toast('❌ Network error. Please try again.');
            });
    }
};

// Initialize contact form handler
byId('contact-form')?.addEventListener('submit', (e) => contactForm.submit(e));

// ══════════════════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════════════════

renderSwatches();
pomSetMode('work');
noiseApplyState();
byId('note-editor').style.display = 'none';
darkMode.apply();
settings.updateUI();
initFirebase();
processDueRecurring();
checkGroceryShare();

// Expose modules to window for HTML onclick handlers
window._settings = settings;
window._contactForm = contactForm;
render();
pomUpdateTodoDropdown();
setInterval(checkHabitReminders, 60000);

// Pie chart click-to-filter
byId('pie-canvas').addEventListener('click', e => {
    const rect = e.target.getBoundingClientRect();
    const scaleX = e.target.width / rect.width;
    const scaleY = e.target.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const cx = e.target.width / 2, cy = e.target.height / 2;
    let a = Math.atan2(y - cy, x - cx);
    if (a < -Math.PI / 2) a += 2 * Math.PI;
    const seg = _pieSegments.find(s => a >= s.start && a < s.end);
    if (seg) expSetFilter(seg.cat === window._appState.expFilter ? 'All' : seg.cat);
});
