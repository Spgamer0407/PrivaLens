/* ═══════════════════════════════════════════════════════════════════
   PrivaLens – Popup Script
   Reads stats from chrome.storage.local, handles protection toggle,
   and opens the full audit dashboard.
   ═══════════════════════════════════════════════════════════════════ */

(async () => {
  "use strict";

  const statusDot  = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const toggle     = document.getElementById("toggleProtection");
  const statInter  = document.getElementById("statIntercepted");
  const statRedact = document.getElementById("statRedacted");
  const btnDash    = document.getElementById("btnDashboard");

  /* ── Load persisted state ──────────────────────────────────────── */
  const data = await chrome.storage.local.get({
    protectionEnabled: true,
    stats: { intercepted: 0, redacted: 0 },
  });

  toggle.checked = data.protectionEnabled;
  updateStatusUI(data.protectionEnabled);
  animateCounter(statInter, data.stats.intercepted);
  animateCounter(statRedact, data.stats.redacted);

  /* ── Toggle protection ─────────────────────────────────────────── */
  toggle.addEventListener("change", async () => {
    const enabled = toggle.checked;
    await chrome.storage.local.set({ protectionEnabled: enabled });
    updateStatusUI(enabled);
  });

  function updateStatusUI(enabled) {
    if (enabled) {
      statusDot.classList.remove("off");
      statusText.textContent = "Active";
      statusText.classList.remove("off");
    } else {
      statusDot.classList.add("off");
      statusText.textContent = "Disabled";
      statusText.classList.add("off");
    }
  }

  /* ── Animate counters from 0 ───────────────────────────────────── */
  function animateCounter(el, target) {
    if (target === 0) { el.textContent = "0"; return; }
    const duration = 600;
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); /* ease-out cubic */
      el.textContent = Math.round(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ── Open dashboard ────────────────────────────────────────────── */
  btnDash.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  });
})();
