// RSS/Atom news fetcher — authority feeds + Google News. Dependency-free parsing
// (regex over the XML). Each feed fails soft; one bad feed never sinks the run.

import { NEWS } from "./config";

export interface NewsItemRaw {
  id: string;
  title: string;
  link: string;
  source: string;
  sourceId: string;
  lang: string;
  published: string | null; // ISO
  summary: string;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Stable id from the link (djb2) — used to detect already-processed items.
function hashId(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}
function stripTags(s: string): string {
  return decodeEntities(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m ? m[1] : null;
}
function linkFrom(block: string): string {
  const rss = tag(block, "link");
  if (rss && rss.trim() && !rss.includes("<")) return decodeEntities(rss).trim();
  const atom = /<link[^>]*href="([^"]+)"/i.exec(block);
  return atom ? decodeEntities(atom[1]).trim() : "";
}
function parseDate(s: string | null): string | null {
  if (!s) return null;
  const t = Date.parse(s.trim());
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

async function fetchFeed(feed: (typeof NEWS.feeds)[number]): Promise<NewsItemRaw[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), NEWS.timeoutMs);
  try {
    const res = await fetch(feed.url, {
      headers: {
        "user-agent": "GodsEye/1.0 (+https://gods-eye-arvest.netlify.app)",
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${feed.id} HTTP ${res.status}`);
    const xml = await res.text();

    const items: NewsItemRaw[] = [];
    const re = /<(item|entry)[\s>]([\s\S]*?)<\/\1>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) && items.length < NEWS.maxItemsPerFeed) {
      const block = m[2];
      const title = stripTags(tag(block, "title") ?? "");
      const link = linkFrom(block);
      if (!title || !link) continue;
      const summary = stripTags(
        tag(block, "description") ?? tag(block, "summary") ?? tag(block, "content") ?? "",
      ).slice(0, 600);
      items.push({
        id: hashId(link),
        title,
        link,
        source: feed.name,
        sourceId: feed.id,
        lang: feed.lang,
        published: parseDate(
          tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated"),
        ),
        summary,
      });
    }
    return items;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAllNews(): Promise<{ items: NewsItemRaw[]; errors: string[] }> {
  const settled = await Promise.allSettled(NEWS.feeds.map(fetchFeed));
  const errors: string[] = [];
  const seen = new Set<string>();
  const items: NewsItemRaw[] = [];
  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      for (const it of s.value) {
        if (!seen.has(it.id)) {
          seen.add(it.id);
          items.push(it);
        }
      }
    } else {
      errors.push(`${NEWS.feeds[i].id}: ${msg(s.reason)}`);
    }
  });
  return { items, errors };
}
