/**
 * Storage & Firebase Configuration
 * Handles data persistence and cloud sync
 */

// Import toast for notifications
let _toast = null;

let _currentUser = null;
let _db = null;
let _auth = null;
let _saveTimer = null;
let _isLoadingFromFirebase = false;
let _firestoreListener = null; // Real-time listener

// ──────────────────────────────────────────────────────────
// Storage Abstraction
// ──────────────────────────────────────────────────────────

// Map localStorage keys → Firestore field names
const KEY_TO_FIELD = {
    'h2': 'habits',
    'hl2': 'hlog',
    't2': 'todos',
    'ev2': 'calEvents',
    'ex2': 'expenses',
    'nt2': 'notes',
    'gr2': 'grocery',
    'gm2': 'games'
};

export const S = {
    get: (k, d) => {
        try {
            return JSON.parse(localStorage.getItem(k)) ?? d;
        } catch {
            return d;
        }
    },
    set: (k, v) => {
        localStorage.setItem(k, JSON.stringify(v));
        // Don't trigger save if we're currently loading from Firebase
        if (!_isLoadingFromFirebase) {
            const field = KEY_TO_FIELD[k];
            if (field) dbSave(field, v);
        }
    }
};

// ──────────────────────────────────────────────────────────
// Firebase Setup
// ──────────────────────────────────────────────────────────

// Helper function to detect mobile
const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const initFirebase = () => {
    if (typeof firebase === 'undefined') {
        console.warn('Firebase library not loaded yet, retrying...');
        setTimeout(initFirebase, 1000);
        return;
    }

    try {
        // Check if Firebase is already initialized
        if (firebase.apps.length) {
            console.log('Firebase already initialized');
            _auth = firebase.auth();
            _db = firebase.firestore();
            setupAuthListener();
            return;
        }

        const fbApp = firebase.initializeApp({
            apiKey: "AIzaSyC5r6j4k3Nxduv4V4fEzjRrcV3_y3ohkrQ",
            authDomain: "focus-81bf0.firebaseapp.com",
            projectId: "focus-81bf0",
            storageBucket: "focus-81bf0.firebasestorage.app",
            messagingSenderId: "216712938115",
            appId: "1:216712938115:web:88ec80640f96b1dcfe11b6"
        });

        _db = firebase.firestore();
        _auth = firebase.auth();

        console.log('✓ Firebase initialized');
        setupAuthListener();
    } catch (e) {
        console.error('Firebase init error:', e);
    }
};

const setupAuthListener = () => {
    // Complete redirect sign-in on return (mobile)
    _auth.getRedirectResult().then(async (result) => {
        if (result.user) {
            _currentUser = result.user;
            const existing = await _db.collection('users').doc(result.user.uid).get();
            if (!existing.exists && window._appState) {
                console.log('🆕 New account (redirect), migrating local data to Firestore...');
                await _db.collection('users').doc(result.user.uid).set({
                    habits: window._appState.habits,
                    hlog: window._appState.hlog,
                    todos: window._appState.todos,
                    calEvents: window._appState.calEvents,
                    expenses: window._appState.expenses,
                    notes: window._appState.notes,
                    grocery: window._appState.grocery,
                    games: window._appState.games
                });
            }
            (window._utils?.toast || (() => {}))('✓ Signed in! Data synced');
        }
        setAuthLoading(false);
    }).catch(e => {
        setAuthLoading(false);
        if (e.code !== 'auth/popup-closed-by-user') console.error('Redirect sign-in error:', e);
    });

    _auth.onAuthStateChanged(async (user) => {
        console.log('🔐 Auth state changed:', user?.email || user?.uid || 'none');
        if (user && !user.isAnonymous) {
            _currentUser = user;
            console.log('User authenticated, setting up real-time sync...');
            updateAuthUI(user);
            await dbLoad(); // This now sets up real-time listener
            console.log('Real-time sync activated');
        } else if (!user) {
            _currentUser = null;
            // Stop real-time listener when logging out
            if (_firestoreListener) {
                console.log('Stopping Firestore listener on logout');
                _firestoreListener();
                _firestoreListener = null;
            }
            updateAuthUI(null);
            console.log('User logged out');
        }
    });
};

export const getCurrentUser = () => _currentUser;
export const getDB = () => _db;
export const getAuth = () => _auth;

// ──────────────────────────────────────────────────────────
// Firebase Auth Handlers
// ──────────────────────────────────────────────────────────

export const updateAuthUI = user => {
    const ic = document.getElementById('auth-ic');
    const label = document.getElementById('auth-label');
    const btn = document.getElementById('auth-btn');

    if (!ic || !label || !btn) {
        console.warn('Auth UI elements not found in DOM');
        return;
    }

    if (!user || user.isAnonymous) {
        ic.textContent = '👤';
        label.textContent = 'Sign in with Google';
        btn.title = 'Click to sign in';
    } else {
        ic.innerHTML = user.photoURL
            ? `<img class="auth-avatar" src="${user.photoURL}" referrerpolicy="no-referrer"/>`
            : '✅';
        label.textContent = user.displayName || user.email || 'Signed in';
        btn.title = 'Click to sign out';
    }

    // Update settings UI when auth state changes
    if (window._settings) {
        window._settings.updateUI();
    }
};

export const setAuthLoading = (show, msg) => {
    const el = document.getElementById('auth-loading');
    const msgEl = document.getElementById('auth-loading-msg');
    if (el) el.classList.toggle('show', show);
    if (msgEl && msg) msgEl.textContent = msg;

    // Auto-hide loading screen after 30 seconds to prevent stuck UI on mobile
    if (show) {
        setTimeout(() => {
            const loadingEl = document.getElementById('auth-loading');
            if (loadingEl?.classList.contains('show')) loadingEl.classList.remove('show');
        }, 30000);
    }
};

export const authAction = async () => {
    // Use toast from window if available
    const toast = window._utils?.toast || ((msg) => console.log(msg));

    if (!_auth) {
        toast('Auth not ready. Refreshing...');
        setTimeout(() => window.location.reload(), 1000);
        return;
    }

    // Check if currently signed in with Google
    const isSignedInWithGoogle = _currentUser && !_currentUser.isAnonymous;

    if (isSignedInWithGoogle) {
        // Show in-app logout confirmation modal
        const user = _currentUser;
        const avatarEl = document.getElementById('logout-avatar');
        const infoEl = document.getElementById('logout-user-info');
        if (avatarEl) {
            avatarEl.innerHTML = user.photoURL
                ? `<img src="${user.photoURL}" referrerpolicy="no-referrer" />`
                : '👤';
        }
        if (infoEl) {
            const name = user.displayName || user.email || 'your account';
            infoEl.textContent = `Signed in as ${name}. Your data stays safely in the cloud.`;
        }
        window._utils?.openModal?.('m-logout');
        return;
    } else {
        // User wants to sign in
        try {
            setAuthLoading(true, 'Signing in with Google…');
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');

            let result;
            if (isMobile()) {
                await _auth.signInWithRedirect(provider);
                return; // Page will redirect; getRedirectResult() handles return in setupAuthListener
            }
            result = await _auth.signInWithPopup(provider);
            console.log('✅ Signed in as:', result.user.email);
            _currentUser = result.user;

            updateAuthUI(result.user);

            // Check if user already has cloud data
            const existing = await _db.collection('users').doc(_currentUser.uid).get();

            if (existing.exists) {
                // Cloud data exists → load it, never overwrite
                console.log('☁️ Cloud data found, loading from Firestore...');
            } else {
                // First time sign-in → migrate local data up to cloud
                console.log('🆕 New account, migrating local data to Firestore...');
                const state = window._appState;
                await _db.collection('users').doc(_currentUser.uid).set({
                    habits: state.habits,
                    hlog: state.hlog,
                    todos: state.todos,
                    calEvents: state.calEvents,
                    expenses: state.expenses,
                    notes: state.notes,
                    grocery: state.grocery,
                    games: state.games
                });
                console.log('✓ Local data migrated to Firestore');
            }

            // Set up real-time listener (loads data and keeps it in sync)
            await dbLoad();

            // Force render to update UI with cloud data
            if (window._render) {
                window._render();
                console.log('✓ UI refreshed with synced data');
            }

            setAuthLoading(false);
            toast('✓ Signed in! Data synced');
        } catch (err) {
            console.error('Sign-in error code:', err.code);
            console.error('Sign-in error message:', err.message);
            setAuthLoading(false);

            if (err.code === 'auth/popup-closed-by-user') {
                console.log('User closed sign-in popup');
            } else {
                toast('❌ Sign-in failed');
            }
        }
    }
};

export const doSignOut = async () => {
    const toast = window._utils?.toast || ((msg) => console.log(msg));
    window._utils?.closeModal?.();
    try {
        setAuthLoading(true, 'Signing out…');
        await _auth.signOut();
        _currentUser = null;
        setAuthLoading(false);
        updateAuthUI(null);
        toast('Signed out ✓');
    } catch (err) {
        console.error('Sign out error:', err);
        setAuthLoading(false);
        toast('❌ Sign out failed');
    }
};

// ──────────────────────────────────────────────────────────
// Firebase Sync
// ──────────────────────────────────────────────────────────

// Pending field updates, batched per debounce window
let _pendingUpdates = {};

export const dbSave = (field, value) => {
    if (!_currentUser || !_db) return;

    // Accumulate changed fields
    if (field !== undefined) {
        _pendingUpdates[field] = value;
    }

    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
        const updates = { ..._pendingUpdates };
        _pendingUpdates = {};

        if (Object.keys(updates).length === 0) return;

        console.log('💾 Saving to Firebase (fields):', Object.keys(updates));

        // Use set with merge:true — creates doc if missing, updates only specified fields if it exists
        _db.collection('users').doc(_currentUser.uid).set(updates, { merge: true })
            .then(() => {
                console.log('✓ Saved to Firebase successfully');
            })
            .catch(e => {
                console.error('Firestore save failed:', e);
            });
    }, 800);
};

export const dbLoad = async () => {
    if (!_currentUser || !_db) {
        console.log('dbLoad skipped: user or db not ready');
        return;
    }

    try {
        // Stop previous listener if it exists
        if (_firestoreListener) {
            console.log('Stopping previous Firestore listener');
            _firestoreListener();
        }

        console.log('📥 Setting up real-time listener for user:', _currentUser.uid);

        // Set up real-time listener with onSnapshot
        _firestoreListener = _db.collection('users').doc(_currentUser.uid).onSnapshot(
            (snap) => {
                if (snap.exists) {
                    const d = snap.data();
                    const state = window._appState;

                    // Prevent infinite update loop
                    _isLoadingFromFirebase = true;

                    console.log('🔄 Real-time update received:', {
                        notes: d.notes?.length || 0,
                        todos: d.todos?.length || 0,
                        grocery: d.grocery?.length || 0,
                        habits: d.habits?.length || 0
                    });

                    // Update all data from Firebase
                    if (d.habits !== undefined) {
                        state.habits = d.habits;
                        localStorage.setItem('h2', JSON.stringify(d.habits));
                    }
                    if (d.hlog !== undefined) {
                        state.hlog = d.hlog;
                        localStorage.setItem('hl2', JSON.stringify(d.hlog));
                    }
                    if (d.todos !== undefined) {
                        state.todos = d.todos;
                        localStorage.setItem('t2', JSON.stringify(d.todos));
                    }
                    if (d.calEvents !== undefined) {
                        state.calEvents = d.calEvents;
                        localStorage.setItem('ev2', JSON.stringify(d.calEvents));
                    }
                    if (d.expenses !== undefined) {
                        state.expenses = d.expenses;
                        localStorage.setItem('ex2', JSON.stringify(d.expenses));
                    }
                    if (d.notes !== undefined) {
                        state.notes = d.notes;
                        localStorage.setItem('nt2', JSON.stringify(d.notes));
                    }
                    if (d.grocery !== undefined) {
                        state.grocery = d.grocery;
                        localStorage.setItem('gr2', JSON.stringify(d.grocery));
                    }
                    if (d.games !== undefined && Array.isArray(d.games)) {
                        state.games = d.games;
                        localStorage.setItem('gm2', JSON.stringify(d.games));
                    } else if (d.games === null && state.games?.length) {
                        // Firestore returned null — keep local data, migrate up
                        // games field missing from Firestore — migrate local data up
                        console.log('🆕 Migrating local games to Firestore...');
                        _db.collection('users').doc(_currentUser.uid).set(
                            { games: state.games }, { merge: true }
                        ).catch(e => console.error('games migration failed:', e));
                    }

                    // Re-render with updated data
                    if (window._render) {
                        window._render();
                        console.log('✓ UI updated with latest data');
                    }

                    _isLoadingFromFirebase = false;
                } else {
                    console.log('No cloud data found, creating new document');
                    const state = window._appState;
                    _db.collection('users').doc(_currentUser.uid).set({
                        habits: state.habits,
                        hlog: state.hlog,
                        todos: state.todos,
                        calEvents: state.calEvents,
                        expenses: state.expenses,
                        notes: state.notes,
                        grocery: state.grocery,
                        games: state.games
                    }).catch(e => console.error('Firestore create failed:', e));
                }
            },
            (error) => {
                console.error('❌ Firestore listener error:', error);
                _isLoadingFromFirebase = false;
            }
        );
    } catch (e) {
        console.error('❌ Error setting up listener:', e);
    }
};
