// Read API — GET /api/whatsnew. Returns the "what's new since last run" diff.

import type { Config } from "@netlify/functions";
import { readWhatsNew } from "../lib/blobs";

export default async () => {
  const doc = await readWhatsNew();
  if (!doc) {
    return Response.json(
      {
        takenAt: null,
        since: null,
        newCalls: [],
        newCallsCount: 0,
        closedCount: 0,
        newNews: [],
        newNewsCount: 0,
      },
      { headers: { "cache-control": "public, max-age=300" } },
    );
  }
  // Don't ship the baseline id arrays to the browser — they're large and internal.
  const { callIds, newsIds, ...pub } = doc;
  return Response.json(pub, { headers: { "cache-control": "public, max-age=300" } });
};

export const config: Config = {
  path: "/api/whatsnew",
};
