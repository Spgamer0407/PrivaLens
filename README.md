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

Paste a string containing any of these patterns into ChatGPT or any text field:

- An OpenAI-style key: `sk-proj-` followed by 32+ alphanumeric characters
- An AWS access key: `AKIA` followed by 16 uppercase alphanumeric characters
- A database URI: `postgres://`, `mysql://`, or `mongodb+srv://` connection string
- A credential: `password = "somevalue"` or `password: somevalue`
- An email address or phone number

**Example — copy this, replace the placeholders, and paste:**

```
OPENAI_KEY=sk-proj-<paste any 40+ random chars here>
password: "any-fake-value-here"
admin_email: test@example.com
```

The interception modal should appear instantly.

> ⚠️ **Note:** Real-looking fake secrets are intentionally excluded from this README to avoid triggering GitHub's secret scanner. Use obviously fake values for testing.

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
