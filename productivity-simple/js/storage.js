/**
 * Storage & Firebase Configuration
 * Handles data persistence and cloud sync
 */

let _currentUser = null;
let _db = null;
let _auth = null;
let _saveTimer = null;
let _isLoadingFromFirebase = false;

// ──────────────────────────────────────────────────────────
// Storage Abstraction
// ──────────────────────────────────────────────────────────

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
            dbSave();
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
    if (typeof firebase === 'undefined') return;

    try {
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

        _auth.onAuthStateChanged(async function (user) {
            if (user) {
                _currentUser = user;
                updateAuthUI(user);
                await dbLoad();
            } else {
                _auth.signInAnonymously();
            }
        });
    } catch (e) {
        console.warn('Firebase init failed, running offline', e);
    }
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

    if (!user || user.isAnonymous) {
        ic.textContent = '👤';
        label.textContent = 'Sign in with Google';
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
    document.getElementById('auth-loading').classList.toggle('show', show);
    if (msg) document.getElementById('auth-loading-msg').textContent = msg;

    // Auto-hide loading screen after 30 seconds to prevent stuck UI on mobile
    if (show) {
        setTimeout(() => {
            if (document.getElementById('auth-loading').classList.contains('show')) {
                document.getElementById('auth-loading').classList.remove('show');
            }
        }, 30000);
    }
};

export const authAction = () => {
    const { toast } = require('./utils');

    if (!_auth) {
        toast('Auth not ready');
        return;
    }

    if (!_currentUser || _currentUser.isAnonymous) {
        setAuthLoading(true, 'Opening Google sign-in…');
        const provider = new firebase.auth.GoogleAuthProvider();

        // Try to sign in with popup first (works on most cases)
        _auth.signInWithPopup(provider)
            .then(() => {
                setAuthLoading(false);
                toast('Signed in! Data is now synced 🎉');
            })
            .catch(e => {
                console.warn('Popup auth failed, trying redirect...', e.code);

                // If popup fails (blocked by private mode, mobile, etc), try redirect
                if (e.code === 'auth/popup-closed-by-user') {
                    setAuthLoading(false);
                    return;
                }

                if (e.code === 'auth/popup-blocked' ||
                    e.code === 'auth/network-request-failed' ||
                    e.message?.includes('popup') ||
                    e.message?.includes('blocked')) {
                    // Popup was blocked (likely private mode) - try redirect
                    _auth.signInWithRedirect(provider)
                        .catch(redirectError => {
                            setAuthLoading(false);
                            console.error('All auth methods failed:', redirectError);
                            toast('⚠️ Sign-in blocked (try normal mode)\nIf in private mode, disable it and try again');
                        });
                } else if (e.code === 'auth/credential-already-in-use') {
                    // User already exists with different provider
                    _auth.signInWithPopup(provider)
                        .then(() => {
                            setAuthLoading(false);
                            toast('Signed in ✅');
                        })
                        .catch(err => {
                            setAuthLoading(false);
                            toast('Sign-in failed ❌');
                        });
                } else {
                    setAuthLoading(false);
                    toast('🔐 Sign-in failed. Try disabling private mode');
                }
            });
    } else {
        if (!confirm('Sign out? Your data stays in the cloud.')) return;
        setAuthLoading(true, 'Signing out…');
        _auth.signOut().then(() => {
            setAuthLoading(false);
            toast('Signed out');
        });
    }
};

// ──────────────────────────────────────────────────────────
// Firebase Sync
// ──────────────────────────────────────────────────────────

export const dbSave = () => {
    if (!_currentUser || !_db) return;

    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
        const state = window._appState;
        _db.collection('users').doc(_currentUser.uid).set({
            habits: state.habits,
            hlog: state.hlog,
            todos: state.todos,
            calEvents: state.calEvents,
            expenses: state.expenses,
            notes: state.notes,
            grocery: state.grocery
        }).catch(e => console.warn('Firestore save failed', e));
    }, 800);
};

export const dbLoad = async () => {
    if (!_currentUser || !_db) return;

    try {
        _isLoadingFromFirebase = true;
        const snap = await _db.collection('users').doc(_currentUser.uid).get();

        if (snap.exists) {
            const d = snap.data();
            const state = window._appState;

            // Load all data from Firebase into state and localStorage
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

            // Re-render with loaded data
            if (window._render) window._render();
        } else {
            // First-time user: save current state to Firebase
            dbSave();
        }
    } catch (e) {
        console.warn('Firestore load failed', e);
    } finally {
        _isLoadingFromFirebase = false;
    }
};
