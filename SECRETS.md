# GitHub Secrets for CI/CD

Add these secrets in **GitHub → Repository → Settings → Secrets and variables → Actions**.

## Required for deploy (Firebase + Build)

| Secret                                 | Description                                                                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FIREBASE_SERVICE_ACCOUNT_FOCUS_81BF0` | Firebase service account JSON (for deploy). [Create key](https://console.firebase.google.com/project/focus-81bf0/settings/serviceaccounts/adminsdk) |
| `FIREBASE_API_KEY`                     | Firebase Web API Key (Project Settings)                                                                                                             |
| `FIREBASE_AUTH_DOMAIN`                 | `focus-81bf0.firebaseapp.com`                                                                                                                       |
| `FIREBASE_PROJECT_ID`                  | `focus-81bf0`                                                                                                                                       |
| `FIREBASE_STORAGE_BUCKET`              | `focus-81bf0.firebasestorage.app`                                                                                                                   |
| `FIREBASE_MESSAGING_SENDER_ID`         | From Firebase config                                                                                                                                |
| `FIREBASE_APP_ID`                      | From Firebase config                                                                                                                                |
| `RAWG_API_KEY`                         | [RAWG API key](https://rawg.io/apidocs) (Games search)                                                                                              |
| `CONTACT_EMAIL`                        | (Optional) Email for contact form                                                                                                                   |

## Where to find values

- **Firebase**: [Project Settings](https://console.firebase.google.com/project/focus-81bf0/settings/general) → Your apps → Web app config
- **RAWG**: [API docs](https://rawg.io/apidocs) → Get API key
- **Service account**: [Service accounts](https://console.firebase.google.com/project/focus-81bf0/settings/serviceaccounts/adminsdk) → Generate new private key

## Local development

1. Copy `.env.example` to `.env`
2. Fill in all values
3. Run `npm run build` then `firebase serve`
