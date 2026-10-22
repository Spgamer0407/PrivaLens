# PrivaLens - Shadow AI Privacy Shield

> 🛡️ A Chrome Extension (Manifest V3) that acts as an inline, client-side Shadow AI Data Loss Prevention (DLP) guardrail.

PrivaLens intercepts sensitive data — API keys, database URIs, JWTs, passwords, emails, phone numbers — **before** it gets pasted into AI platforms like ChatGPT, Claude, Gemini, and others.

## ✨ Features

- **7 Regex Scanners** — Detects OpenAI keys, AWS keys, DB URIs, JWTs, credentials, emails, phone numbers
- **Instant Paste Interception** — Blocks sensitive pastes in real-time (capture-phase listeners)
- **Enter Key Guard** — Catches typed secrets on form submission
- **Smart Sanitize** — Replaces secrets with `[REDACTED_*]` placeholders so users can still ask their question
- **Glassmorphic Modal** — Beautiful dark-mode interception UI with masked previews
- **Audit Dashboard** — Full incident log with metrics and bar charts
- **Zero-Knowledge** — Never stores raw secrets. Only logs categories, timestamps, and domains
- **100% Client-Side** — Your data never leaves your browser

## 📦 Installation

1. Clone or download this repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **"Load unpacked"** → select the project folder
5. Pin the 🛡️ icon in your toolbar

## 🧪 Quick Test

Paste this into ChatGPT or any text field:

```
OPENAI_KEY=sk-proj-Rk9xYz3mN7pQ2wLs8vTjUaHbCdEfGhIjKlMnOpQrStUvWx
AWS_ACCESS_KEY_ID=AKIAI44QH8DHBEXAMPLE
DATABASE_URL=mongodb+srv://root:hunter2@cluster0.abc123.mongodb.net/production
password: "r00tAdm!n_2024"
admin_email: admin@internal-corp.io
```

The interception modal should appear instantly.

## 🗂️ Project Structure

```
├── manifest.json    — Manifest V3 config
├── content.js       — DLP detection engine + modal injection
├── content.css      — Glassmorphic modal styles
├── popup.html       — Extension popup UI
├── popup.js         — Popup logic
├── dashboard.html   — Full audit dashboard
└── dashboard.js     — Dashboard logic
```

## 📄 License

MIT
