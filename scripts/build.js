#!/usr/bin/env node
/**
 * Build script: copies static files to dist/ and injects env vars.
 * Loads .env for local development (create from .env.example).
 * Used before deploy to keep secrets out of source control.
 *
 * Required env vars:
 *   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
 *   FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID
 *   RAWG_API_KEY
 *   CONTACT_EMAIL (optional)
 */

const fs = require('fs');
const path = require('path');

// Load .env for local dev
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
}

const DIST = path.join(__dirname, '..', 'dist');
const SRC = path.join(__dirname, '..');

const ENV = {
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || '',
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || '',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || '',
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || '',
    RAWG_API_KEY: process.env.RAWG_API_KEY || '',
    CONTACT_EMAIL: process.env.CONTACT_EMAIL || 'contact@example.com',
};

const REQUIRED = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'RAWG_API_KEY'];

const missing = REQUIRED.filter((k) => !ENV[k]);
if (missing.length) {
    console.error('Missing required env vars:', missing.join(', '));
    console.error('Copy .env.example to .env and fill in values, or set in GitHub Secrets.');
    process.exit(1);
}

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const e of entries) {
        const s = path.join(src, e.name);
        const d = path.join(dest, e.name);
        if (e.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', 'scripts'].includes(e.name)) {
                copyDir(s, d);
            }
        } else {
            fs.copyFileSync(s, d);
        }
    }
}

function replaceEnv(content, replacements) {
    let out = content;
    for (const [key, val] of Object.entries(replacements)) {
        out = out.split(key).join(val);
    }
    return out;
}

// Copy static files
const toCopy = ['index.html', 'manifest.json', 'favicon.svg', 'css', 'js', 'icons', 'sw.js'];
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });

for (const item of toCopy) {
    const src = path.join(SRC, item);
    const dest = path.join(DIST, item);
    if (fs.existsSync(src)) {
        if (fs.statSync(src).isDirectory()) {
            copyDir(src, dest);
        } else {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(src, dest);
        }
    }
}

// Inject env into js/storage.js
const storagePath = path.join(DIST, 'js', 'storage.js');
let storage = fs.readFileSync(storagePath, 'utf8');
storage = replaceEnv(storage, {
    __FIREBASE_API_KEY__: ENV.FIREBASE_API_KEY,
    __FIREBASE_AUTH_DOMAIN__: ENV.FIREBASE_AUTH_DOMAIN,
    __FIREBASE_PROJECT_ID__: ENV.FIREBASE_PROJECT_ID,
    __FIREBASE_STORAGE_BUCKET__: ENV.FIREBASE_STORAGE_BUCKET,
    __FIREBASE_MESSAGING_SENDER_ID__: ENV.FIREBASE_MESSAGING_SENDER_ID,
    __FIREBASE_APP_ID__: ENV.FIREBASE_APP_ID,
});
fs.writeFileSync(storagePath, storage);

// Inject env into js/app.js
const appPath = path.join(DIST, 'js', 'app.js');
let app = fs.readFileSync(appPath, 'utf8');
app = replaceEnv(app, {
    __RAWG_API_KEY__: ENV.RAWG_API_KEY,
    __CONTACT_EMAIL__: ENV.CONTACT_EMAIL,
});
fs.writeFileSync(appPath, app);

console.log('✓ Build complete → dist/');
