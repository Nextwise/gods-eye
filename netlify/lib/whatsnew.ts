// "What's new" diff — compares the current calls/news against the snapshot stored
// at the previous run, so the dashboard can show what changed since you last
// looked: new calls appeared, calls closed, new high-relevance signals.

import { readCalls, readNews, readWhatsNew, writeWhatsNew } from "./blobs";
import { WHATSNEW } from "./config";

export interface NewCall {
  id: string;
  title: string;
  programme: string;
  deadline: string | null;
  status: string;
  url: string | null;
}
export interface NewSignal {
  id: string;
  title: string;
  source: string;
  score: number;
  link: string;
}

export interface WhatsNewDoc {
  takenAt: string;
  since: string | null;
  newCalls: NewCall[];
  newCallsCount: number;
  closedCount: number;
  newNews: NewSignal[];
  newNewsCount: number;
  // baseline for the next diff
  callIds: string[];
  newsIds: string[];
}

export interface WhatsNewSummary {
  ok: boolean;
  source: "whatsnew";
  newCalls: number;
  newNews: number;
  since: string | null;
  takenAt: string;
}

export async function refreshWhatsNew(): Promise<WhatsNewSummary> {
  const takenAt = new Date().toISOString();
  const [calls, news, prior] = await Promise.all([readCalls(), readNews(), readWhatsNew()]);
  const callsArr = calls?.calls ?? [];
  const newsArr = news?.items ?? [];

  const priorCallIds = new Set(prior?.callIds ?? []);
  const priorNewsIds = new Set(prior?.newsIds ?? []);
  // First run (no baseline) → don't flag everything as "new"; just set the baseline.
  const hadPrior = !!prior && (prior.callIds?.length ?? 0) > 0;

  const newCalls = hadPrior ? callsArr.filter((c) => !priorCallIds.has(c.id)) : [];
  const currentIds = new Set(callsArr.map((c) => c.id));
  const closedCount = hadPrior
    ? [...priorCallIds].filter((id) => !currentIds.has(id)).length
    : 0;

  const newNews = hadPrior
    ? newsArr.filter(
        (n) => (n.score ?? 0) >= WHATSNEW.newsScoreThreshold && !priorNewsIds.has(n.id),
      )
    : [];

  const doc: WhatsNewDoc = {
    takenAt,
    since: prior?.takenAt ?? null,
    newCalls: newCalls.slice(0, WHATSNEW.maxList).map((c) => ({
      id: c.id,
      title: c.title,
      programme: c.programme,
      deadline: c.deadline,
      status: c.status,
      url: c.url,
    })),
    newCallsCount: newCalls.length,
    closedCount,
    newNews: newNews.slice(0, WHATSNEW.maxList).map((n) => ({
      id: n.id,
      title: n.title,
      source: n.source,
      score: n.score,
      link: n.link,
    })),
    newNewsCount: newNews.length,
    callIds: callsArr.map((c) => c.id),
    newsIds: newsArr.map((n) => n.id),
  };
  await writeWhatsNew(doc);
  return {
    ok: true,
    source: "whatsnew",
    newCalls: newCalls.length,
    newNews: newNews.length,
    since: doc.since,
    takenAt,
  };
}
