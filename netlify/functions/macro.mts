// Read API — GET /api/macro. Returns the pre-processed macro blob.

import type { Config } from "@netlify/functions";
import { readMacro } from "../lib/blobs";

export default async () => {
  const doc = await readMacro();
  if (!doc) {
    return Response.json(
      {
        fetchedAt: null,
        ok: false,
        fx: { ok: false, error: "no data yet", date: null, base: "RON", rates: [] },
        inflation: {
          ok: false,
          error: "no data yet",
          label: "HICP — annual rate of change",
          unit: "annual % change",
          updated: null,
          series: [],
        },
      },
      { headers: { "cache-control": "public, max-age=300" } },
    );
  }
  return Response.json(doc, {
    headers: { "cache-control": "public, max-age=300" },
  });
};

export const config: Config = {
  path: "/api/macro",
};
