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

import { S, initFirebase, getCurrentUser, authAction, updateAuthUI, setAuthLoading } from './storage.js';

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
// UTILITIES - EXPORT TO WINDOW
// ══════════════════════════════════════════════════════════

window._utils = { closeModal, toast };
window._darkMode = darkMode;
window._auth = { action: authAction };

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
};

window._render = render;

// Setup navigation
queryAll('.nb').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        window._appState.page = page;
        showPage(page, render);
    });
});

// ══════════════════════════════════════════════════════════
// FAB - FLOATING ACTION BUTTON
// ══════════════════════════════════════════════════════════

const fabClick = () => {
    const state = window._appState;
    const map = { habits: 'mh', todos: 'mt', calendar: 'me', expenses: 'mx', grocery: 'mg', notes: null };

    if (state.page === 'notes') {
        newNote();
        return;
    }

    const id = map[state.page];
    if (!id) return;

    if (state.page === 'habits') renderSwatches();
    if (state.page === 'calendar') {
        byId('edate').value = state.calSel || today();
        byId('etime').value = '';
        byId('etitle').value = '';
        byId('enotes').value = '';
    }
    if (state.page === 'expenses') {
        byId('xdate').value = today();
        byId('xdesc').value = '';
        byId('xamount').value = '';
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
    window._appState.habits.push({ id: uid(), name: n, color: window._appState.selColor });
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

const hStreak = id => {
    let n = 0, d = new Date();
    d.setDate(d.getDate() - 1);
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
        const card = document.createElement('div');
        card.className = 'card hcard';
        card.innerHTML = `
      <div class="htop">
        <div class="hdot" style="background:${h.color}"></div>
        <span class="hname">${esc(h.name)}</span>
        <button class="hchk ${done ? 'done' : ''}" style="${done ? `background:${h.color};border-color:${h.color}` : ''}" onclick="window._habits?.toggle?.('${h.id}')">${done ? '✓' : ''}</button>
      </div>
      <div class="hmeta">🔥 ${streak} day streak &nbsp;·&nbsp; ${l30.filter(Boolean).length}/30 this month</div>
      <div class="hhm">${l30.map(v => `<div class="hc" style="background:${v ? h.color : 'var(--border)'};opacity:${v ? 1 : .35}"></div>`).join('')}</div>
      <div style="display:flex;justify-content:flex-end"><button class="ico-btn" onclick="window._habits?.delete?.('${h.id}')">🗑</button></div>`;
        g.appendChild(card);
    });
};

window._habits = { create: createHabit, toggle: toggleHabit, delete: deleteHabit };

byId('hname').addEventListener('keydown', e => {
    if (e.key === 'Enter') createHabit();
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
        done: false,
        at: Date.now()
    });
    S.set('t2', window._appState.todos);
    closeModal();
    renderTodos();
    toast('Task added ✅');
};

const toggleTodo = id => {
    const t = window._appState.todos.find(x => x.id === id);
    if (t) {
        t.done = !t.done;
        S.set('t2', window._appState.todos);
        renderTodos();
    }
};

const deleteTodo = id => {
    window._appState.todos = window._appState.todos.filter(x => x.id !== id);
    S.set('t2', window._appState.todos);
    renderTodos();
};

const dueBadge = (due, done) => {
    if (!due) return '';
    const d = ddiff(due);
    if (done) return `<span class="chip ck">${fdate(due)}</span>`;
    if (d < 0) return `<span class="chip co">Overdue</span>`;
    if (d === 0) return `<span class="chip cd">Due today</span>`;
    return `<span class="chip ck">${fdate(due)}</span>`;
};

const renderTodos = () => {
    const state = window._appState;
    const el = byId('tlist');
    if (!state.todos.length) {
        el.innerHTML = `<div class="empty"><span class="empty-ic">✅</span>No tasks yet.<br>Hit <strong>+</strong> to add one.</div>`;
        return;
    }
    const po = { high: 0, medium: 1, low: 2, none: 3 };
    const sorted = [
        ...state.todos.filter(x => !x.done).sort((a, b) => (po[a.priority] || 3) - (po[b.priority] || 3)),
        ...state.todos.filter(x => x.done)
    ];
    el.innerHTML = sorted.map(t => `
    <div class="ti">
      <input type="checkbox" ${t.done ? 'checked' : ''} onchange="window._todos?.toggle?.('${t.id}')"/>
      <span class="tt ${t.done ? 'done' : ''}">${esc(t.title)}</span>
      <div class="tmeta">
        ${t.priority !== 'none' ? `<span class="chip c${t.priority[0]}">${t.priority}</span>` : ''}
        ${dueBadge(t.due, t.done)}
      </div>
      <button class="ico-btn" onclick="window._todos?.delete?.('${t.id}')">×</button>
    </div>`).join('');
};

window._todos = { create: createTodo, toggle: toggleTodo, delete: deleteTodo };

byId('ttitle').addEventListener('keydown', e => {
    if (e.key === 'Enter') createTodo();
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
    deleteEvent
};

byId('etitle').addEventListener('keydown', e => {
    if (e.key === 'Enter') createEvent();
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
let pInt = null;
let pSess = 0;

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
};

const pomStop = () => {
    pRun = false;
    byId('pbtn').textContent = '▶';
    byId('ptime').classList.remove('running');
    clearInterval(pInt);
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

const pomTick = () => {
    if (pSec <= 0) {
        pomStop();
        if (Notification.permission === 'granted')
            new Notification(pMode === 'work' ? '⏰ Focus done! Take a break.' : '💪 Break over! Time to focus.');
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

window._pomodoro = { setMode: pomSetMode, toggle: pomToggle, reset: pomReset, skip: pomSkip, applySettings: pomApplySettings };

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

const drawPie = () => {
    const canvas = byId('pie-canvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
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
    let angle = -Math.PI / 2;
    entries.forEach(([cat, val]) => {
        const slice = val / total * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, angle, angle + slice); ctx.closePath();
        ctx.fillStyle = CAT_COLORS[cat] || '#9ca3af'; ctx.fill();
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

const renderExpenses = () => {
    const state = window._appState;
    const tot = state.expenses.reduce((s, x) => s + x.amount, 0);
    const mon = state.expenses.filter(x => x.date.slice(0, 7) === today().slice(0, 7)).reduce((s, x) => s + x.amount, 0);
    byId('exp-total').textContent = fmt$(tot);
    byId('exp-month').textContent = fmt$(mon);
    byId('exp-count').textContent = state.expenses.length;
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

window._expenses = { create: createExpense, delete: deleteExpense, setFilter: expSetFilter };

byId('xdesc').addEventListener('keydown', e => {
    if (e.key === 'Enter') createExpense();
});

// ══════════════════════════════════════════════════════════
// NOTES
// ══════════════════════════════════════════════════════════

const newNote = () => {
    const n = { id: uid(), title: '', body: '', updatedAt: Date.now() };
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
    byId('nbody').focus();
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

const renderNotes = (resetEditor = true) => {
    const state = window._appState;
    const list = byId('notes-list');
    if (!state.notes.length) {
        list.innerHTML = `<div class="empty" style="padding:40px 20px"><span class="empty-ic">📝</span>No notes yet</div>`;
        if (resetEditor) {
            state.activeNote = null;
            showNoteEditor(false);
        }
        return;
    }
    const sorted = [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt);
    list.innerHTML = sorted.map(n => `
    <div class="note-item${n.id === state.activeNote ? ' active' : ''}" onclick="window._notes?.select?.('${n.id}')">
      <div class="note-title-row">
        <span class="note-item-title">${esc(n.title) || 'Untitled'}</span>
        <span class="note-item-date">${shortDate(n.updatedAt)}</span>
      </div>
      <div class="note-item-preview">${esc((n.body || '').slice(0, 60)) || 'No content'}</div>
    </div>`).join('');
};

window._notes = { save: noteSave, delete: noteDelete, select: selectNote };

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

window._grocery = { create: createGrocery, toggle: toggleGrocery, delete: deleteGrocery, clearDone: groceryClearDone, resetAll: groceryResetAll };

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

        // Prepare the email
        const emailBody = `
Subject: ${subject}

From: ${email}

Message:
${message}

---
App Version: ${byId('contact-version').value}
Sent: ${new Date().toLocaleString()}
        `.trim();

        // Use FormSubmit.co to send email
        const formData = new FormData();
        formData.append('email', email);
        formData.append('subject', subject);
        formData.append('message', message);
        formData.append('version', byId('contact-version').value);
        formData.append('_captcha', 'false');
        formData.append('_next', window.location.href);

        // Send to FormSubmit.co
        fetch('https://formspree.io/f/myzojlwp', {
            method: 'POST',
            body: formData
        })
            .then(response => {
                if (response.ok) {
                    toast('✅ Report sent! Thank you for your feedback.');
                    form.reset();
                    closeModal('contact');
                } else {
                    toast('❌ Failed to send. Please try again.');
                }
            })
            .catch(err => {
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
byId('note-editor').style.display = 'none';
darkMode.apply();
settings.updateUI();
initFirebase();

// Expose modules to window for HTML onclick handlers
window._settings = settings;
window._contactForm = contactForm;
render();
