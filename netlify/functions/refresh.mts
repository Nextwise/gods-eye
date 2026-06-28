// On-demand refresh — POST /api/refresh, protected by REFRESH_TOKEN.
// For Nex and "refresh on open". Returns 401 without a valid token.
// The token lives ONLY in a Netlify env var, never in code or the repo.
//
// Selective: ?source=calls|macro|all (default all), so "refresh on open" can
// pull just what it needs instead of re-running the whole pipeline.

import type { Config } from "@netlify/functions";
import { refreshCalls } from "../lib/pipeline";
import { refreshMacro } from "../lib/macro";
import { refreshJoin } from "../lib/join-pipeline";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "method not allowed" }, { status: 405 });
  }

  const expected = process.env.REFRESH_TOKEN;
  if (!expected) {
    return Response.json(
      { ok: false, error: "REFRESH_TOKEN not configured" },
      { status: 503 },
    );
  }

  const provided =
    req.headers.get("x-refresh-token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  if (provided !== expected) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const source = (new URL(req.url).searchParams.get("source") ?? "all").toLowerCase();
  const wantCalls = source === "all" || source === "calls";
  const wantMacro = source === "all" || source === "macro";
  const wantNews = source === "all" || source === "news";
  const wantJoin = source === "all" || source === "join";
  if (!wantCalls && !wantMacro && !wantNews && !wantJoin) {
    return Response.json(
      { ok: false, error: `unknown source "${source}" (use calls|macro|news|join|all)` },
      { status: 400 },
    );
  }

  // News is a long job (live Grok web searches) → kick off the background
  // function instead of running inline, so this request doesn't time out.
  if (wantNews) {
    const base = process.env.URL ?? new URL(req.url).origin;
    try {
      await fetch(`${base}/.netlify/functions/news-refresh-background`, {
        method: "POST",
        headers: { "x-refresh-token": expected },
      });
    } catch {
      /* trigger is best-effort */
    }
  }

  const results: Record<string, unknown> = {};
  await Promise.all([
    wantCalls ? refreshCalls().then((r) => void (results.calls = r)) : null,
    wantMacro ? refreshMacro().then((r) => void (results.macro = r)) : null,
    wantJoin ? refreshJoin().then((r) => void (results.join = r)) : null,
  ]);
  if (wantNews) results.news = { queued: true };

  const ok = Object.values(results).every((r) => (r as { ok?: boolean }).ok !== false);
  return Response.json({ ok, ...results }, { status: ok ? 200 : 502 });
};

export const config: Config = {
  path: "/api/refresh",
};
