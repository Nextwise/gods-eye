// On-demand refresh — POST /api/refresh, protected by REFRESH_TOKEN.
// For Nex and "refresh on open". Returns 401 without a valid token.
// The token lives ONLY in a Netlify env var, never in code or the repo.
//
// Selective: ?source=calls|macro|all (default all), so "refresh on open" can
// pull just what it needs instead of re-running the whole pipeline.

import type { Config } from "@netlify/functions";
import { refreshCalls } from "../lib/pipeline";
import { refreshMacro } from "../lib/macro";

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
  if (!wantCalls && !wantMacro) {
    return Response.json(
      { ok: false, error: `unknown source "${source}" (use calls|macro|all)` },
      { status: 400 },
    );
  }

  const results: Record<string, unknown> = {};
  await Promise.all([
    wantCalls ? refreshCalls().then((r) => void (results.calls = r)) : null,
    wantMacro ? refreshMacro().then((r) => void (results.macro = r)) : null,
  ]);

  const ok = Object.values(results).every((r) => (r as { ok: boolean }).ok);
  return Response.json({ ok, ...results }, { status: ok ? 200 : 502 });
};

export const config: Config = {
  path: "/api/refresh",
};
