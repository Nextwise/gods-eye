// Dashboard logic — reads /api/calls (pre-processed blob) and renders a
// filterable list. No framework, no inline script (keeps the strict CSP).

const state = { all: [] };

const els = {
  list: document.getElementById("list"),
  search: document.getElementById("search"),
  programme: document.getElementById("programme"),
  status: document.getElementById("status"),
  deadline: document.getElementById("deadline"),
  freshness: document.getElementById("freshness"),
  count: document.getElementById("count"),
  source: document.getElementById("source"),
};

function daysLeft(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso) - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.ceil(ms / 86400000);
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

function cardHtml(c) {
  const dl = daysLeft(c.deadline);
  let urgency = "";
  let dlText = fmtDate(c.deadline);
  if (dl !== null && dl >= 0) {
    urgency = dl <= 14 ? "u-hot" : dl <= 30 ? "u-warm" : "";
    dlText = `${fmtDate(c.deadline)} · <strong>${dl}d</strong>`;
  }
  const sClass =
    c.status === "open" ? "s-open" : c.status === "forthcoming" ? "s-fc" : "s-other";
  const href = c.url || "#";
  return `
  <a class="card ${urgency}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">
    <div class="card-main">
      <div class="badges">
        <span class="badge ${sClass}">${esc(c.status)}</span>
        <span class="badge prog">${esc(c.programme)}</span>
        ${c.action ? `<span class="badge action">${esc(c.action)}</span>` : ""}
      </div>
      <h3>${esc(c.title)}</h3>
      <div class="ids">
        <code>${esc(c.id)}</code>
        ${c.callTitle ? `<span class="sep">·</span><span>${esc(c.callTitle)}</span>` : ""}
      </div>
    </div>
    <div class="card-deadline ${urgency}">
      <span class="dl-label">deadline</span>
      <span class="dl-val">${dlText}</span>
    </div>
  </a>`;
}

function applyFilters() {
  const q = els.search.value.trim().toLowerCase();
  const prog = els.programme.value;
  const status = els.status.value;
  const dlMax = els.deadline.value ? Number(els.deadline.value) : null;

  const filtered = state.all.filter((c) => {
    if (prog && c.programme !== prog) return false;
    if (status && c.status !== status) return false;
    if (dlMax !== null) {
      const dl = daysLeft(c.deadline);
      if (dl === null || dl < 0 || dl > dlMax) return false;
    }
    if (q) {
      const hay = `${c.title} ${c.id} ${c.call ?? ""} ${c.callTitle ?? ""} ${c.programme} ${(c.keywords || []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  els.count.textContent = `${filtered.length} shown`;
  els.list.innerHTML = filtered.length
    ? filtered.map(cardHtml).join("")
    : `<div class="empty">No calls match your filters.</div>`;
}

function populateProgrammes() {
  const names = [...new Set(state.all.map((c) => c.programme))].sort();
  for (const n of names) {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    els.programme.appendChild(opt);
  }
}

function setFreshness(doc) {
  if (!doc.fetchedAt) {
    els.freshness.textContent = "no data yet — run a refresh";
    els.freshness.className = "freshness stale";
  } else {
    const when = new Date(doc.fetchedAt);
    els.freshness.textContent = `updated ${when.toLocaleString()}`;
    els.freshness.className = doc.ok ? "freshness" : "freshness stale";
  }
  els.source.textContent = doc.fetchedAt
    ? `${doc.count} calls · ${doc.source}${doc.error ? " · partial: " + doc.error : ""}`
    : "";
}

async function load() {
  try {
    const res = await fetch("/api/calls", { headers: { accept: "application/json" } });
    const doc = await res.json();
    state.all = doc.calls || [];
    setFreshness(doc);
    populateProgrammes();
    applyFilters();
  } catch (e) {
    els.list.innerHTML = `<div class="empty">Failed to load: ${esc(e && e.message ? e.message : e)}</div>`;
  }
}

for (const el of [els.search, els.programme, els.status, els.deadline]) {
  el.addEventListener("input", applyFilters);
}
load();
