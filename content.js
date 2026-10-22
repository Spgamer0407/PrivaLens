/* ═══════════════════════════════════════════════════════════════════
   PrivaLens – Content Script (Manifest V3)
   Deterministic regex-based DLP engine that intercepts paste/submit
   events, detects sensitive data, and presents a glassmorphic modal.
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  /* ── State ──────────────────────────────────────────────────────── */
  let protectionEnabled = true;
  let interceptedRawText = null;
  let activeTarget = null;
  let activeOverlay = null;

  /* Load user preference */
  chrome.storage.local.get({ protectionEnabled: true }, (res) => {
    protectionEnabled = res.protectionEnabled;
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.protectionEnabled) {
      protectionEnabled = changes.protectionEnabled.newValue;
    }
  });

  /* ── Detection Engine ──────────────────────────────────────────── */
  const SCANNERS = [
    {
      id: "openai_key",
      label: "OpenAI API Key",
      icon: "🔑",
      iconClass: "privalens-entity-icon-key",
      regex: /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/g,
      placeholder: "[REDACTED_API_KEY]",
    },
    {
      id: "aws_key",
      label: "AWS Access Key",
      icon: "🔑",
      iconClass: "privalens-entity-icon-key",
      regex: /AKIA[0-9A-Z]{16}/g,
      placeholder: "[REDACTED_AWS_KEY]",
    },
    {
      id: "db_uri",
      label: "Database URI",
      icon: "🗄️",
      iconClass: "privalens-entity-icon-db",
      regex: /(?:postgres|mysql|mongodb(?:\+srv)?):\/\/[^\s]+/gi,
      placeholder: "[REDACTED_DB_URL]",
    },
    {
      id: "jwt",
      label: "JWT Token",
      icon: "🪙",
      iconClass: "privalens-entity-icon-jwt",
      regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
      placeholder: "[REDACTED_JWT]",
    },
    {
      id: "credential",
      label: "Credential / Password",
      icon: "🔒",
      iconClass: "privalens-entity-icon-cred",
      regex: /password\s*[:=]\s*["']?[^\s"']+["']?/gi,
      placeholder: "[REDACTED_CREDENTIAL]",
    },
    {
      id: "email",
      label: "Email Address",
      icon: "📧",
      iconClass: "privalens-entity-icon-email",
      regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      placeholder: "[REDACTED_EMAIL]",
    },
    {
      id: "phone",
      label: "Phone Number",
      icon: "📱",
      iconClass: "privalens-entity-icon-phone",
      regex: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
      placeholder: "[REDACTED_PHONE]",
    },
  ];

  /**
   * Scan text and return array of { scanner, matches[] }.
   * Each match has { full, masked }.
   */
  function scanText(text) {
    const results = [];
    for (const scanner of SCANNERS) {
      scanner.regex.lastIndex = 0;
      const found = [];
      let m;
      while ((m = scanner.regex.exec(text)) !== null) {
        found.push({
          full: m[0],
          masked: maskValue(m[0]),
        });
      }
      if (found.length > 0) {
        results.push({ scanner, matches: found });
      }
    }
    return results;
  }

  /** Partially mask a value: show first 6 and last 4 chars */
  function maskValue(val) {
    if (val.length <= 12) {
      return val.slice(0, 3) + "••••••" + val.slice(-2);
    }
    return val.slice(0, 6) + "••••••••" + val.slice(-4);
  }

  /** Replace all matched tokens with their placeholders */
  function sanitizeText(text, detections) {
    let safe = text;
    for (const det of detections) {
      for (const match of det.matches) {
        safe = safe.split(match.full).join(det.scanner.placeholder);
      }
    }
    return safe;
  }

  /* ── Input helpers ─────────────────────────────────────────────── */

  /** Determine if an element is an editable target */
  function isEditableTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT" && (el.type === "text" || el.type === "search" || el.type === "url" || el.type === "")) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  /** Get the closest editable ancestor (handles nested contenteditable) */
  function findEditableAncestor(el) {
    let node = el;
    while (node && node !== document.body) {
      if (isEditableTarget(node)) return node;
      node = node.parentElement;
    }
    return null;
  }

  /** Insert text into a target element */
  function insertText(target, text) {
    if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
      /* For standard form fields, set value and dispatch input event */
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      const before = target.value.slice(0, start);
      const after = target.value.slice(end);
      target.value = before + text + after;
      target.selectionStart = target.selectionEnd = start + text.length;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (target.isContentEditable) {
      /* For contenteditable, use execCommand for best compat with React/frameworks */
      target.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
      }
      document.execCommand("insertText", false, text);
    }
  }

  /* ── Modal UI ──────────────────────────────────────────────────── */

  function removeModal() {
    if (activeOverlay) {
      activeOverlay.classList.remove("privalens-visible");
      setTimeout(() => {
        activeOverlay.remove();
        activeOverlay = null;
      }, 280);
    }
    if (activeTarget) {
      activeTarget.classList.remove("privalens-warn-border");
      activeTarget = null;
    }
    interceptedRawText = null;
  }

  function showModal(target, rawText, detections) {
    /* Remove any existing modal */
    if (activeOverlay) activeOverlay.remove();

    activeTarget = target;
    interceptedRawText = rawText;
    target.classList.add("privalens-warn-border");

    const totalSecrets = detections.reduce((sum, d) => sum + d.matches.length, 0);
    const isCritical = totalSecrets >= 2 || detections.some((d) => ["openai_key", "aws_key", "db_uri", "jwt", "credential"].includes(d.scanner.id));
    const badgeClass = isCritical ? "privalens-badge-critical" : "privalens-badge-warning";
    const badgeText = isCritical
      ? `Critical Risk: ${totalSecrets} Secret${totalSecrets > 1 ? "s" : ""} Found`
      : `Warning: ${totalSecrets} Item${totalSecrets > 1 ? "s" : ""} Detected`;

    /* Build entity rows */
    let entityRowsHTML = "";
    for (const det of detections) {
      const s = det.scanner;
      const count = det.matches.length;
      const preview = det.matches[0].masked;
      entityRowsHTML += `
        <div class="privalens-entity-row">
          <div class="privalens-entity-icon ${s.iconClass}">${s.icon}</div>
          <div class="privalens-entity-info">
            <div class="privalens-entity-name">${s.label}</div>
            <div class="privalens-entity-preview">${escapeHTML(preview)}</div>
          </div>
          <div class="privalens-entity-count">${count}×</div>
        </div>`;
    }

    const domain = location.hostname || "unknown";

    const overlay = document.createElement("div");
    overlay.className = "privalens-overlay";
    overlay.innerHTML = `
      <div class="privalens-modal" role="dialog" aria-label="PrivaLens Security Intercept">
        <div class="privalens-header">
          <div class="privalens-header-left">
            <div class="privalens-shield-icon">🛡️</div>
            <div>
              <div class="privalens-title">PrivaLens Security Intercept</div>
              <div class="privalens-subtitle">Data Loss Prevention</div>
            </div>
          </div>
          <div class="privalens-badge ${badgeClass}">
            <span class="privalens-badge-dot"></span>
            ${escapeHTML(badgeText)}
          </div>
        </div>
        <div class="privalens-domain-tag">Target: <span>${escapeHTML(domain)}</span></div>
        <div class="privalens-body">
          <div class="privalens-section-label">Detected Entities</div>
          <div class="privalens-entity-list">
            ${entityRowsHTML}
          </div>
        </div>
        <div class="privalens-actions">
          <button class="privalens-btn privalens-btn-sanitize" data-action="sanitize">
            🧹 Smart Sanitize &amp; Paste
          </button>
          <button class="privalens-btn privalens-btn-block" data-action="block">
            ✋ Block / Cancel
          </button>
          <button class="privalens-btn privalens-btn-bypass" data-action="bypass">
            Bypass (Unsafe) — paste original text
          </button>
        </div>
      </div>`;

    /* Action handlers */
    overlay.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === "sanitize") {
        const sanitized = sanitizeText(interceptedRawText, detections);
        insertText(target, sanitized);
        logIncident(detections, "sanitized");
        removeModal();
      } else if (action === "block") {
        logIncident(detections, "blocked");
        removeModal();
      } else if (action === "bypass") {
        insertText(target, interceptedRawText);
        logIncident(detections, "bypassed");
        removeModal();
      }
    });

    /* Clicking backdrop closes (acts as block) */
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        logIncident(detections, "blocked");
        removeModal();
      }
    });

    /* Escape key */
    const escHandler = (e) => {
      if (e.key === "Escape" && activeOverlay) {
        logIncident(detections, "blocked");
        removeModal();
        document.removeEventListener("keydown", escHandler, true);
      }
    };
    document.addEventListener("keydown", escHandler, true);

    document.body.appendChild(overlay);
    activeOverlay = overlay;

    /* Trigger transition */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add("privalens-visible");
      });
    });
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ── Storage / Logging ─────────────────────────────────────────── */

  async function logIncident(detections, action) {
    const entry = {
      timestamp: new Date().toISOString(),
      domain: location.hostname || "unknown",
      url: location.href,
      categories: detections.map((d) => ({
        type: d.scanner.id,
        label: d.scanner.label,
        count: d.matches.length,
      })),
      action: action, /* "sanitized" | "blocked" | "bypassed" */
      totalSecrets: detections.reduce((s, d) => s + d.matches.length, 0),
    };

    try {
      const res = await chrome.storage.local.get({ incidents: [], stats: { intercepted: 0, redacted: 0 } });
      const incidents = res.incidents;
      const stats = res.stats;

      incidents.push(entry);
      stats.intercepted += 1;
      if (action === "sanitized") {
        stats.redacted += entry.totalSecrets;
      }

      await chrome.storage.local.set({ incidents, stats });
    } catch (err) {
      console.warn("[PrivaLens] Storage write failed:", err);
    }
  }

  /* ── Event Interception ────────────────────────────────────────── */

  /**
   * Primary paste interceptor.
   * Attached at the document level in the capture phase so it fires
   * before any host-page React / framework handler.
   */
  document.addEventListener(
    "paste",
    (e) => {
      if (!protectionEnabled) return;
      if (activeOverlay) return; /* already showing a modal */

      const target = findEditableAncestor(e.target);
      if (!target) return;

      const text = (e.clipboardData || window.clipboardData).getData("text/plain");
      if (!text || text.trim().length === 0) return;

      const detections = scanText(text);
      if (detections.length === 0) return;

      /* Block the paste */
      e.preventDefault();
      e.stopImmediatePropagation();

      showModal(target, text, detections);
    },
    true /* capture phase */
  );

  /**
   * Submission guard – intercept Enter (without Shift) on fields
   * that still contain sensitive data, e.g. if a user typed a secret
   * rather than pasting it.
   */
  document.addEventListener(
    "keydown",
    (e) => {
      if (!protectionEnabled) return;
      if (activeOverlay) return;
      if (e.key !== "Enter" || e.shiftKey) return;

      const target = findEditableAncestor(e.target);
      if (!target) return;

      const text = target.isContentEditable ? (target.innerText || "") : (target.value || "");
      if (!text || text.trim().length === 0) return;

      const detections = scanText(text);
      if (detections.length === 0) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      showModal(target, text, detections);
    },
    true
  );

  /**
   * Form submit guard – catches submit buttons & form actions.
   */
  document.addEventListener(
    "submit",
    (e) => {
      if (!protectionEnabled) return;
      if (activeOverlay) return;

      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;

      /* Gather all text inputs in this form */
      const fields = form.querySelectorAll("textarea, input[type='text'], input[type='search'], input[type='url'], input:not([type]), [contenteditable='true']");
      for (const field of fields) {
        const text = field.isContentEditable ? (field.innerText || "") : (field.value || "");
        const detections = scanText(text);
        if (detections.length > 0) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showModal(field, text, detections);
          return;
        }
      }
    },
    true
  );

  /* ── Initialization log ────────────────────────────────────────── */
  console.log(
    "%c🛡️ PrivaLens%c Content guard active on %c" + location.hostname,
    "color:#10b981;font-weight:bold;font-size:13px",
    "color:#a1a1aa",
    "color:#06b6d4;font-weight:bold"
  );
})();
