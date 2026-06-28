// Read API — GET /api/join. Returns the pre-computed "money on the table" JOIN.

import type { Config } from "@netlify/functions";
import { readJoin } from "../lib/blobs";

export default async () => {
  const doc = await readJoin();
  if (!doc) {
    return Response.json(
      {
        fetchedAt: null,
        ok: false,
        error: "no data yet",
        country: "RO",
        ro2127TotalPlanned: 0,
        ro2127Unspent: 0,
        ro2127SpentPct: null,
        rows: [],
      },
      { headers: { "cache-control": "public, max-age=300" } },
    );
  }
  return Response.json(doc, { headers: { "cache-control": "public, max-age=300" } });
};

export const config: Config = {
  path: "/api/join",
};
