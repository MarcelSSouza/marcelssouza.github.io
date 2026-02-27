module.exports = {
    env: {
        browser: true,
        es2022: true,
    },
    extends: ['eslint:recommended', 'prettier'],
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
    },
    globals: {
        firebase: 'readonly',
    },
    ignorePatterns: ['node_modules/', 'dist/', 'sw.js'],
};
