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

/* ---------- macro panel (Slice 2) ---------- */

function sparkline(values) {
  if (!values || values.length < 2) return "";
  const w = 130, h = 30, pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = pad + (1 - (v - min) / range) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const dir = values[values.length - 1] >= values[0] ? "up" : "down";
  return `<svg class="spark ${dir}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

function fxTile(r) {
  const chg = r.changePct;
  const cls = chg == null ? "" : chg > 0 ? "pos" : chg < 0 ? "neg" : "";
  const arrow = chg == null ? "" : chg > 0 ? "▲" : chg < 0 ? "▼" : "";
  const chgTxt = chg == null ? "" : `${arrow} ${Math.abs(chg).toFixed(2)}%`;
  const mult = r.multiplier && r.multiplier !== 1 ? `${r.multiplier} ` : "";
  return `
  <div class="tile">
    <div class="tile-head">
      <span class="tile-name">${mult}${esc(r.currency)} / RON</span>
      <span class="chg ${cls}">${chgTxt}</span>
    </div>
    <div class="tile-val">${r.rate.toFixed(4)}</div>
    ${sparkline(r.spark)}
  </div>`;
}

function inflTile(s) {
  const v = s.latest;
  const chg = v != null && s.prev != null ? v - s.prev : null;
  const chgTxt = chg == null ? "" : `${chg > 0 ? "+" : ""}${chg.toFixed(1)}pp`;
  return `
  <div class="tile">
    <div class="tile-head">
      <span class="tile-name">Inflation · ${esc(s.label)}</span>
      <span class="chg muted">${chgTxt}</span>
    </div>
    <div class="tile-val">${v != null ? v.toFixed(1) + "%" : "—"}</div>
    <div class="tile-sub">${esc(s.latestPeriod || "")}</div>
    ${sparkline((s.spark || []).map((p) => p.value))}
  </div>`;
}

function renderMacro(doc) {
  const el = document.getElementById("macro");
  if (!el) return;
  const tiles = [];
  if (doc.fx && doc.fx.rates) tiles.push(...doc.fx.rates.map(fxTile));
  if (doc.inflation && doc.inflation.series) tiles.push(...doc.inflation.series.map(inflTile));
  el.innerHTML = tiles.length ? `<div class="tiles">${tiles.join("")}</div>` : "";
}

async function loadMacro() {
  try {
    const res = await fetch("/api/macro", { headers: { accept: "application/json" } });
    renderMacro(await res.json());
  } catch (e) {
    /* macro is non-critical — leave the panel empty on failure */
  }
}

/* ---------- newswire panel (Slice 3) ---------- */

function scoreClass(n) {
  return n >= 70 ? "hot" : n >= 45 ? "warm" : "low";
}

function factChip(fc) {
  if (!fc || fc.verdict === "skipped") return "";
  const map = {
    corroborated: ["ok", "✓ corroborated"],
    disputed: ["err", "! disputed"],
    unverified: ["muted", "? unverified"],
  };
  const [cls, label] = map[fc.verdict] || ["muted", "? unverified"];
  const title = fc.note ? ` title="${esc(fc.note)}"` : "";
  return `<span class="fc fc-${cls}"${title}>${label}</span>`;
}

function newsCard(it) {
  const sc = scoreClass(it.score);
  const meta = [it.sector, it.region, it.programme]
    .filter((x) => x && x !== "n/a")
    .map(esc)
    .join(" · ");
  return `
  <a class="ncard u-${sc}" href="${esc(it.link)}" target="_blank" rel="noopener noreferrer">
    <div class="ncard-top">
      <span class="nsource">${esc(it.source)}</span>
      <span class="nscore s-${sc}">${it.score}</span>
    </div>
    <h4>${esc(it.title)}</h4>
    ${it.why ? `<p class="nwhy">${esc(it.why)}</p>` : ""}
    <div class="ncard-bot">
      ${factChip(it.factCheck)}
      ${meta ? `<span class="ntags">${meta}</span>` : ""}
    </div>
  </a>`;
}

function renderNews(doc) {
  const el = document.getElementById("news");
  if (!el) return;
  const items = (doc.items || []).slice(0, 6);
  if (!items.length) {
    el.innerHTML = "";
    return;
  }
  const when = doc.fetchedAt ? new Date(doc.fetchedAt).toLocaleString() : "";
  el.innerHTML = `
    <div class="news-head">
      <span class="news-title">Newswire · top signals</span>
      <span class="news-meta">${doc.count} tracked${when ? " · " + esc(when) : ""}</span>
    </div>
    <div class="ncards">${items.map(newsCard).join("")}</div>`;
}

async function loadNews() {
  try {
    const res = await fetch("/api/news", { headers: { accept: "application/json" } });
    renderNews(await res.json());
  } catch (e) {
    /* newswire is non-critical — leave empty on failure */
  }
}

/* ---------- money on the table — the JOIN (Slice 4) ---------- */

function eurB(n) {
  return "€" + (Number(n || 0) / 1e9).toFixed(1) + "B";
}
function pctOrDash(n) {
  return n == null ? "—" : Math.round(n) + "%";
}

function joinCard(r) {
  const dl = r.soonestDeadline ? new Date(r.soonestDeadline) : null;
  const dlText = dl ? dl.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  return `
  <div class="jcard">
    <div class="jcard-head">
      <span class="jpo">${esc(r.po)}</span>
      <span class="jname">${esc(r.name)}</span>
    </div>
    <div class="junspent">${eurB(r.unspent21)}<span>on the table</span></div>
    <div class="jstats">
      <div><span class="jlbl">spent 21–27</span><span class="jval">RO ${pctOrDash(r.spentPct21)} · EU ${pctOrDash(r.euSpentPct21)}</span></div>
      <div><span class="jlbl">absorb 14–20</span><span class="jval">RO ${pctOrDash(r.absorb14)} · EU ${pctOrDash(r.euAbsorb14)}</span></div>
    </div>
    <div class="jcalls">${r.openCalls} open · ${r.forthcomingCalls} forthcoming${dlText ? " · next " + dlText : ""}</div>
    <div class="jblurb">${esc(r.blurb)}</div>
  </div>`;
}

function renderJoin(doc) {
  const el = document.getElementById("join");
  if (!el) return;
  const rows = doc.rows || [];
  if (!rows.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <div class="join-head">
      <span class="join-title">Money on the table · ${esc(doc.country || "RO")}</span>
      <span class="join-meta">${eurB(doc.ro2127Unspent)} unspent of ${eurB(doc.ro2127TotalPlanned)} · 2021–2027 · ${pctOrDash(doc.ro2127SpentPct)} spent</span>
    </div>
    <div class="jcards">${rows.map(joinCard).join("")}</div>`;
}

async function loadJoin() {
  try {
    const res = await fetch("/api/join", { headers: { accept: "application/json" } });
    renderJoin(await res.json());
  } catch (e) {
    /* JOIN is non-critical — leave empty on failure */
  }
}

for (const el of [els.search, els.programme, els.status, els.deadline]) {
  el.addEventListener("input", applyFilters);
}
load();
loadMacro();
loadNews();
loadJoin();
