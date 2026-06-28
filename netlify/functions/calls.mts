// Read API — GET /api/calls. Returns the pre-processed calls blob for the
// dashboard. The browser never touches SEDIA directly (CORS + cleanliness).

import type { Config } from "@netlify/functions";
import { readCalls } from "../lib/blobs";

export default async () => {
  const doc = await readCalls();
  if (!doc) {
    return Response.json(
      {
        source: "SEDIA",
        fetchedAt: null,
        ok: false,
        total: 0,
        count: 0,
        error: "no data yet — trigger a refresh",
        calls: [],
      },
      { headers: { "cache-control": "public, max-age=300" } },
    );
  }
  return Response.json(doc, {
    headers: { "cache-control": "public, max-age=300" },
  });
};

export const config: Config = {
  path: "/api/calls",
};
