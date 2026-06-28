// Orchestration shared by the scheduled cron and the on-demand refresh endpoint:
// fetch SEDIA -> store the (possibly partial) result in Blobs -> return a summary.

import { fetchCalls } from "./sedia";
import { writeCalls } from "./blobs";

export interface RefreshSummary {
  ok: boolean;
  source: "SEDIA";
  total: number;
  count: number;
  error: string | null;
  fetchedAt: string;
}

export async function refreshCalls(): Promise<RefreshSummary> {
  const doc = await fetchCalls();
  // Store whatever we got — even a partial fetch is better than stale/empty,
  // and the dashboard surfaces ok/partial state to the user.
  await writeCalls(doc);
  return {
    ok: doc.ok,
    source: doc.source,
    total: doc.total,
    count: doc.count,
    error: doc.error,
    fetchedAt: doc.fetchedAt,
  };
}
