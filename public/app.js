// Phase 1: prove both layers work from one screen — the static site
// fetches the /api/ping function and reflects its status in the UI.
async function checkPipe() {
  const dot = document.getElementById("dot");
  const status = document.getElementById("status");
  const meta = document.getElementById("meta");

  try {
    const res = await fetch("/api/ping", { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    dot.dataset.state = "ok";
    status.textContent = "Pipe live";
    const ts = new Date(data.ts).toLocaleString();
    const region = data.region ?? "unknown region";
    meta.textContent = `ping ok · ${region} · ${ts}`;
  } catch (err) {
    dot.dataset.state = "err";
    status.textContent = "Pipe down";
    meta.textContent = err && err.message ? err.message : String(err);
  }
}

checkPipe();
