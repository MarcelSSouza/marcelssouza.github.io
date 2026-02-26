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
    _auth.onAuthStateChanged(async (user) => {
        console.log('🔐 Auth state changed:', user?.email || user?.uid || 'none');
        if (user && !user.isAnonymous) {
            _currentUser = user;
            console.log('User authenticated, loading cloud data...');
            updateAuthUI(user);
            await dbLoad();
            console.log('Cloud data load completed');
        } else if (!user) {
            _currentUser = null;
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
        // User wants to sign out
        if (!confirm('Sign out? Your data stays in the cloud.')) return;

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
    } else {
        // User wants to sign in
        try {
            setAuthLoading(true, 'Signing in with Google…');
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');

            const result = await _auth.signInWithPopup(provider);
            console.log('✅ Signed in as:', result.user.email);
            _currentUser = result.user;

            // IMPORTANT: After signing in, migrate local data to their Google account
            console.log('🔄 Migrating local data to Google account...');
            const state = window._appState;

            // Save current local state to their Firebase account
            await _db.collection('users').doc(_currentUser.uid).set({
                habits: state.habits,
                hlog: state.hlog,
                todos: state.todos,
                calEvents: state.calEvents,
                expenses: state.expenses,
                notes: state.notes,
                grocery: state.grocery
            });
            console.log('✓ Local data migrated to Firebase');

            updateAuthUI(result.user);

            // Load user data from cloud
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

// ──────────────────────────────────────────────────────────
// Firebase Sync
// ──────────────────────────────────────────────────────────

export const dbSave = () => {
    if (!_currentUser || !_db) {
        console.log('dbSave skipped: user or db not ready');
        return;
    }

    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
        const state = window._appState;
        console.log('💾 Saving to Firebase:', {
            notes: state.notes?.length || 0,
            todos: state.todos?.length || 0,
            grocery: state.grocery?.length || 0,
            habits: state.habits?.length || 0
        });

        _db.collection('users').doc(_currentUser.uid).set({
            habits: state.habits,
            hlog: state.hlog,
            todos: state.todos,
            calEvents: state.calEvents,
            expenses: state.expenses,
            notes: state.notes,
            grocery: state.grocery
        }).then(() => {
            console.log('✓ Saved to Firebase successfully');
        }).catch(e => {
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
        _isLoadingFromFirebase = true;
        console.log('📥 Loading data from Firebase for user:', _currentUser.uid);

        const snap = await _db.collection('users').doc(_currentUser.uid).get();

        if (snap.exists) {
            const d = snap.data();
            const state = window._appState;

            console.log('📊 Cloud data found:', {
                notes: d.notes?.length || 0,
                todos: d.todos?.length || 0,
                grocery: d.grocery?.length || 0,
                habits: d.habits?.length || 0
            });

            // Load all data from Firebase into state and localStorage
            if (d.habits !== undefined) {
                state.habits = d.habits;
                localStorage.setItem('h2', JSON.stringify(d.habits));
                console.log('✓ Loaded habits:', d.habits.length);
            }
            if (d.hlog !== undefined) {
                state.hlog = d.hlog;
                localStorage.setItem('hl2', JSON.stringify(d.hlog));
            }
            if (d.todos !== undefined) {
                state.todos = d.todos;
                localStorage.setItem('t2', JSON.stringify(d.todos));
                console.log('✓ Loaded todos:', d.todos.length);
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
                console.log('✓ Loaded notes:', d.notes.length);
            }
            if (d.grocery !== undefined) {
                state.grocery = d.grocery;
                localStorage.setItem('gr2', JSON.stringify(d.grocery));
                console.log('✓ Loaded grocery:', d.grocery.length);
            }

            // Force re-render with loaded data
            if (window._render) {
                console.log('🔄 Refreshing UI...');
                window._render();
                console.log('✓ UI refreshed with cloud data');
            } else {
                console.warn('⚠️ window._render not available yet');
            }
        } else {
            console.log('No cloud data found for user, creating new document');
            // First-time user: save current state to Firebase
            await new Promise(resolve => setTimeout(resolve, 500));
            dbSave();
        }
    } catch (e) {
        console.error('❌ Firestore load error:', e);
    } finally {
        _isLoadingFromFirebase = false;
    }
};
