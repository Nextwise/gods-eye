import type { Config, Context } from "@netlify/functions";

// Phase 1 health check — proves the function pipe is live end-to-end.
// Reachable at /api/ping via Functions 2.0 native routing (see config below).
export default async (_req: Request, context: Context) => {
  const body = {
    ok: true,
    service: "gods-eye",
    phase: 1,
    ts: new Date().toISOString(),
    region: context.geo?.country?.code ?? null,
    requestId: context.requestId ?? null,
  };

  return Response.json(body, {
    headers: { "cache-control": "no-store" },
  });
};

export const config: Config = {
  path: "/api/ping",
};
