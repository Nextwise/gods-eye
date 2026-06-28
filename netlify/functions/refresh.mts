// On-demand refresh — POST /api/refresh, protected by REFRESH_TOKEN.
// For Nex and "refresh on open". Returns 401 without a valid token.
// The token lives ONLY in a Netlify env var, never in code or the repo.

import type { Config } from "@netlify/functions";
import { refreshCalls } from "../lib/pipeline";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "method not allowed" }, { status: 405 });
  }

  const expected = process.env.REFRESH_TOKEN;
  if (!expected) {
    // Misconfiguration, not an auth failure — make it obvious in logs/response.
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

  const summary = await refreshCalls();
  return Response.json(summary, { status: summary.ok ? 200 : 502 });
};

export const config: Config = {
  path: "/api/refresh",
};
