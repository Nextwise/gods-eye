// Read API — GET /api/news. Returns the pre-processed, scored newswire blob.

import type { Config } from "@netlify/functions";
import { readNews } from "../lib/blobs";

export default async () => {
  const doc = await readNews();
  if (!doc) {
    return Response.json(
      { fetchedAt: null, ok: false, count: 0, newThisRun: 0, errors: ["no data yet"], items: [] },
      { headers: { "cache-control": "public, max-age=300" } },
    );
  }
  return Response.json(doc, { headers: { "cache-control": "public, max-age=300" } });
};

export const config: Config = {
  path: "/api/news",
};
