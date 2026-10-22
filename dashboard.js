/* ═══════════════════════════════════════════════════════════════════
   PrivaLens – Dashboard Script
   Reads incident log from chrome.storage.local, renders metrics,
   top-type bar chart, and incident table. Handles log clearing.
   ═══════════════════════════════════════════════════════════════════ */

(async () => {
  "use strict";

  /* ── DOM refs ───────────────────────────────────────────────────── */
  const mTotal    = document.getElementById("mTotal");
  const mRedacted = document.getElementById("mRedacted");
  const mDomains  = document.getElementById("mDomains");
  const mScore    = document.getElementById("mScore");
  const typeBars  = document.getElementById("typeBars");
  const tbody     = document.getElementById("incidentBody");
  const btnClear  = document.getElementById("btnClear");

  /* ── Load data ─────────────────────────────────────────────────── */
  async function loadDashboard() {
    const data = await chrome.storage.local.get({
      incidents: [],
      stats: { intercepted: 0, redacted: 0 },
    });

    const incidents = data.incidents;
    const stats = data.stats;

    /* Unique domains */
    const domains = new Set(incidents.map((i) => i.domain));

    /* Security score: % of incidents that were sanitized or blocked (not bypassed) */
    const safe = incidents.filter((i) => i.action !== "bypassed").length;
    const score = incidents.length > 0 ? Math.round((safe / incidents.length) * 100) : 100;

    /* Animate counters */
    animateCounter(mTotal, stats.intercepted);
    animateCounter(mRedacted, stats.redacted);
    animateCounter(mDomains, domains.size);
    mScore.textContent = score + "%";

    /* ── Top types ─────────────────────────────────────────────── */
    const typeCounts = {};
    for (const inc of incidents) {
      for (const cat of inc.categories) {
        typeCounts[cat.label] = (typeCounts[cat.label] || 0) + cat.count;
      }
    }

    const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const maxCount = sorted.length > 0 ? sorted[0][1] : 1;

    const TYPE_COLORS = {
      "OpenAI API Key":         "#ef4444",
      "AWS Access Key":         "#f97316",
      "Database URI":           "#a855f7",
      "JWT Token":              "#f59e0b",
      "Credential / Password":  "#ec4899",
      "Email Address":          "#06b6d4",
      "Phone Number":           "#10b981",
    };

    if (sorted.length > 0) {
      typeBars.innerHTML = sorted
        .map(([label, count]) => {
          const pct = Math.max(4, Math.round((count / maxCount) * 100));
          const color = TYPE_COLORS[label] || "#71717a";
          return `
            <div class="type-row">
              <div class="type-label">${escapeHTML(label)}</div>
              <div class="type-bar-track">
                <div class="type-bar-fill" style="width:${pct}%;background:${color}"></div>
              </div>
              <div class="type-count">${count}</div>
            </div>`;
        })
        .join("");
    } else {
      typeBars.innerHTML = '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:12px 0;">No data yet</div>';
    }

    /* ── Incident table ────────────────────────────────────────── */
    if (incidents.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="4">
          <div class="empty-state">
            <div class="icon">🔒</div>
            <h3>No Incidents Recorded</h3>
            <p>PrivaLens is watching. Paste something sensitive into an AI chat to test.</p>
          </div>
        </td></tr>`;
      return;
    }

    /* Show newest first */
    const rows = [...incidents].reverse();
    tbody.innerHTML = rows
      .map((inc) => {
        const ts = formatTimestamp(inc.timestamp);
        const domain = escapeHTML(inc.domain);
        const cats = inc.categories
          .map((c) => {
            const cls = tagClass(c.type);
            return `<span class="cat-tag ${cls}">${c.count}× ${escapeHTML(c.label)}</span>`;
          })
          .join("");
        const actionCls =
          inc.action === "sanitized" ? "action-sanitized" :
          inc.action === "blocked"   ? "action-blocked" :
          "action-bypassed";
        const actionLabel =
          inc.action === "sanitized" ? "✅ Sanitized" :
          inc.action === "blocked"   ? "🚫 Blocked" :
          "⚠️ Bypassed";

        return `
          <tr>
            <td>${ts}</td>
            <td class="domain-cell">${domain}</td>
            <td><div class="category-tags">${cats}</div></td>
            <td><span class="action-badge ${actionCls}">${actionLabel}</span></td>
          </tr>`;
      })
      .join("");
  }

  /* ── Clear logs ────────────────────────────────────────────────── */
  btnClear.addEventListener("click", async () => {
    if (!confirm("Clear all PrivaLens audit logs? This cannot be undone.")) return;
    await chrome.storage.local.set({
      incidents: [],
      stats: { intercepted: 0, redacted: 0 },
    });
    loadDashboard();
  });

  /* ── Helpers ───────────────────────────────────────────────────── */

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTimestamp(iso) {
    try {
      const d = new Date(iso);
      const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      return `${date}<br><span style="color:var(--text-muted);font-size:11px;">${time}</span>`;
    } catch {
      return iso;
    }
  }

  function tagClass(type) {
    const map = {
      openai_key: "cat-tag-key",
      aws_key:    "cat-tag-key",
      db_uri:     "cat-tag-db",
      jwt:        "cat-tag-jwt",
      credential: "cat-tag-cred",
      email:      "cat-tag-email",
      phone:      "cat-tag-phone",
    };
    return map[type] || "cat-tag-key";
  }

  function animateCounter(el, target) {
    if (target === 0) { el.textContent = "0"; return; }
    const duration = 700;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ── Init ──────────────────────────────────────────────────────── */
  loadDashboard();

  /* Re-render when storage changes (e.g. from another tab) */
  chrome.storage.onChanged.addListener(() => {
    loadDashboard();
  });
})();
