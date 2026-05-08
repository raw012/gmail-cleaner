# Gmail Cleaner

A Chrome extension (Manifest V3) for bulk-deleting Gmail emails filtered by sender, subject keyword, date range, and label — with a 5-second Undo window.

---

## Features

- Filter emails by **sender**, **subject keyword**, **date range**, and **Gmail label** (Inbox, Promotions, Social, Updates, custom labels, and all system labels)
- **Preview** matching emails in a list before deleting
- **Select / deselect** individual emails with checkboxes
- **Bulk move to trash** via Gmail API
- **Undo toast** — a 5-second countdown bar lets you restore all deleted emails back to inbox with one click

---

## Google Cloud OAuth Setup (required before loading the extension)

### Step 1 — Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in.
2. Click **Select a project → New Project**.
3. Enter a project name (e.g. `gmail-cleaner`) and click **Create**.
4. Make sure your new project is selected in the top bar.

### Step 2 — Enable the Gmail API

1. In the left sidebar go to **APIs & Services → Library**.
2. Search for **Gmail API** and click it.
3. Click **Enable**.

### Step 3 — Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Select **External** and click **Create**.
3. Fill in **App name** (e.g. `Gmail Cleaner`), **User support email**, and **Developer contact email**.
4. Click **Save and Continue** through the Scopes screen (no need to add scopes here).
5. On the **Test users** screen, click **+ Add users** and add your Gmail address.
6. Click **Save and Continue**, then **Back to Dashboard**.

> The app stays in "Testing" mode, which is fine for personal use. Up to 100 test users are allowed.

### Step 4 — Create an OAuth client ID

1. Go to **APIs & Services → Credentials**.
2. Click **+ Create Credentials → OAuth client ID**.
3. Set **Application type** to **Chrome extension**.
4. Enter any name (e.g. `Gmail Cleaner`).
5. For **Item ID**, you need your unpacked extension's ID — follow Step 6 first to load the extension, then come back with the ID shown in `chrome://extensions`.
6. Click **Create** and copy the **Client ID** (ends in `.apps.googleusercontent.com`).

### Step 5 — Add the Client ID to the extension

Open `manifest.json` and replace the placeholder:

```json
"oauth2": {
  "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  ...
}
```

Paste your actual Client ID in place of `YOUR_CLIENT_ID.apps.googleusercontent.com`.

---

## Loading the extension in Chrome (personal use)

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `gmail-cleaner` folder (this repository root).
5. The extension appears in the list — note the **Extension ID** shown under the name (you'll need this for Step 4 above when creating the OAuth client).
6. After adding the Client ID to `manifest.json`, click the **reload** icon (↺) on the extension card to apply the change.
7. Click the Gmail Cleaner icon in the Chrome toolbar, sign in with Google, and start cleaning.

> **Tip:** Pin the extension by clicking the puzzle-piece icon in the toolbar and pinning Gmail Cleaner for quick access.

---

## Development

### Run tests

```bash
npm install
npm test
```

Tests cover the pure utility functions in `utils.js` (query builder, date formatting, header parsing, sender formatting). The CI pipeline runs these on every push.

### Project structure

```
gmail-cleaner/
├── manifest.json        # Extension manifest (Manifest V3)
├── popup.html           # Main popup UI
├── popup.js             # UI logic — filters, list rendering, delete, undo
├── background.js        # Service worker — all Gmail API calls
├── utils.js             # Pure utility functions (shared + tested)
├── package.json
├── tests/
│   └── utils.test.js    # Jest unit tests
└── .github/
    └── workflows/
        └── ci.yml       # GitHub Actions CI
```

### API scopes used

| Scope | Why |
|---|---|
| `https://www.googleapis.com/auth/gmail.modify` | Read message metadata, move messages to/from trash |

No emails are permanently deleted — the extension only moves messages to Gmail's Trash, where they remain recoverable for 30 days.

---

## Privacy

All Gmail access happens locally between your browser and Google's API. No data is sent to any third-party server. The extension stores nothing beyond the OAuth token cached by Chrome.
