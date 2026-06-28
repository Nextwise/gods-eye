// News pipeline: fetch feeds -> diff against stored (only NEW items cost LLM) ->
// Haiku score all new -> Grok fact-check the relevant ones -> merge, prune, store.

import { fetchAllNews, type NewsItemRaw } from "./news";
import { scoreItem } from "./anthropic";
import { factCheck, type FactCheck } from "./grok";
import { readNews, writeNews } from "./blobs";
import { NEWS } from "./config";

export interface NewsItem extends NewsItemRaw {
  score: number;
  angles: Record<string, number>;
  sector: string;
  region: string;
  programme: string;
  why: string;
  factCheck: FactCheck | null;
  scoredAt: string;
}

export interface NewsDoc {
  fetchedAt: string;
  ok: boolean;
  count: number;
  newThisRun: number;
  errors: string[];
  items: NewsItem[];
}

export interface NewsSummary {
  ok: boolean;
  source: "news";
  count: number;
  newThisRun: number;
  errors: string[];
  fetchedAt: string;
}

// Bounded-concurrency map.
async function pool<T, R>(items: T[], conc: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(conc, items.length || 1) }, worker));
  return out;
}

export async function refreshNews(): Promise<NewsSummary> {
  const fetchedAt = new Date().toISOString();
  const prior = await readNews();
  const priorItems = prior?.items ?? [];
  const seen = new Set(priorItems.map((it) => it.id));
  const errors: string[] = [];

  const fetchResult = await fetchAllNews();
  errors.push(...fetchResult.errors);

  // New items only, newest first, capped to bound LLM spend.
  const fresh = fetchResult.items.filter((it) => !seen.has(it.id));
  fresh.sort((a, b) => (Date.parse(b.published ?? "") || 0) - (Date.parse(a.published ?? "") || 0));
  const toProcess = fresh.slice(0, NEWS.maxNewPerRun);

  // Score every new item (cheap Haiku call).
  const scored: NewsItem[] = await pool(toProcess, NEWS.scoreConcurrency, async (it) => {
    try {
      const s = await scoreItem(it);
      return { ...it, ...s, factCheck: null, scoredAt: fetchedAt };
    } catch (e) {
      errors.push(`score ${it.id}: ${e instanceof Error ? e.message : String(e)}`);
      return {
        ...it,
        score: 0,
        angles: {},
        sector: "n/a",
        region: "n/a",
        programme: "n/a",
        why: "",
        factCheck: null,
        scoredAt: fetchedAt,
      };
    }
  });

  // Fact-check only the relevant ones (Grok is fail-soft and never throws).
  const relevant = scored.filter((it) => it.score >= NEWS.scoreThresholdForGrok);
  await pool(relevant, NEWS.factCheckConcurrency, async (it) => {
    it.factCheck = await factCheck(it);
  });

  // Merge with prior, drop items older than keepDays, dedupe (new wins), sort.
  const cutoff = Date.now() - NEWS.keepDays * 86400000;
  const byId = new Map<string, NewsItem>();
  for (const it of [...scored, ...priorItems]) {
    const ts = Date.parse(it.scoredAt ?? it.published ?? "") || Date.now();
    if (ts >= cutoff && !byId.has(it.id)) byId.set(it.id, it);
  }
  const items = [...byId.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (Date.parse(b.published ?? "") || 0) - (Date.parse(a.published ?? "") || 0);
  });

  const doc: NewsDoc = {
    fetchedAt,
    ok: errors.length === 0,
    count: items.length,
    newThisRun: scored.length,
    errors,
    items,
  };
  await writeNews(doc);
  return {
    ok: doc.ok,
    source: "news",
    count: doc.count,
    newThisRun: doc.newThisRun,
    errors,
    fetchedAt,
  };
}
