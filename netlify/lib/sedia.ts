// SEDIA fetcher — EU Funding & Tenders Portal open/forthcoming calls.
//
// Transport quirk (reverse-engineered, see memory/sedia-search-api):
// the API needs multipart/form-data where EVERY part declares
// `Content-Type: application/json` and has NO filename. Node's FormData+Blob
// adds filename="blob" and the server 500s ("internal error"), so we build the
// multipart body by hand. A plain urlencoded `query=` field is silently ignored.

import {
  SEDIA,
  STATUS_LABELS,
  TYPE_LABELS,
  PROGRAMMES,
  PROGRAMME_PREFIXES,
} from "./config";

export interface Call {
  id: string;
  title: string;
  status: string; // open | forthcoming | closed | unknown
  statusCode: string | null;
  deadline: string | null; // ISO
  deadlineModel: string | null;
  opens: string | null; // ISO
  programme: string;
  programmeId: string | null;
  call: string | null; // parent call identifier
  callTitle: string | null;
  action: string | null; // typesOfAction
  type: string;
  url: string | null;
  keywords: string[];
}

export interface CallsDoc {
  source: "SEDIA";
  fetchedAt: string;
  ok: boolean;
  total: number;
  count: number;
  error: string | null;
  calls: Call[];
}

type Meta = Record<string, unknown>;

// Every SEDIA metadata field is an array — take the first element.
function first(v: unknown): string | null {
  if (Array.isArray(v)) return v.length ? String(v[0]) : null;
  if (v === null || v === undefined) return null;
  return String(v);
}
function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (v === null || v === undefined) return [];
  return [String(v)];
}

function programmeName(programmeId: string | null, identifier: string): string {
  if (programmeId && PROGRAMMES[programmeId]) return PROGRAMMES[programmeId];
  const up = identifier.toUpperCase();
  for (const [prefix, name] of PROGRAMME_PREFIXES) {
    if (up.startsWith(prefix)) return name;
  }
  return programmeId ? `Programme ${programmeId}` : "Unknown";
}

function normalize(metadata: Meta): Call | null {
  const id = first(metadata.identifier);
  if (!id) return null; // skip docs without an identifier
  const statusCode = first(metadata.status);
  const typeCode = first(metadata.type);
  const programmeId = first(metadata.frameworkProgramme);
  return {
    id,
    title: first(metadata.title) ?? id,
    status: (statusCode && STATUS_LABELS[statusCode]) || "unknown",
    statusCode,
    deadline: first(metadata.deadlineDate),
    deadlineModel: first(metadata.deadlineModel),
    opens: first(metadata.startDate),
    programme: programmeName(programmeId, id),
    programmeId,
    call: first(metadata.callIdentifier),
    callTitle: first(metadata.callTitle),
    action: first(metadata.typesOfAction),
    type: (typeCode && TYPE_LABELS[typeCode]) || typeCode || "?",
    url: first(metadata.url),
    keywords: arr(metadata.keywords),
  };
}

// Build multipart body by hand: each part is JSON + Content-Type application/json,
// no filename. This is the only shape the SEDIA endpoint accepts.
function buildMultipart(parts: Record<string, unknown>): {
  body: string;
  contentType: string;
} {
  const boundary =
    "----godseye" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  let body = "";
  for (const [name, value] of Object.entries(parts)) {
    body +=
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${name}"\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${JSON.stringify(value)}\r\n`;
  }
  body += `--${boundary}--\r\n`;
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function fetchPage(
  pageNumber: number,
): Promise<{ total: number; metas: Meta[] }> {
  const url = `${SEDIA.endpoint}?apiKey=${SEDIA.apiKey}&text=${encodeURIComponent(SEDIA.text)}`;
  const query = {
    bool: {
      must: [
        { terms: { type: SEDIA.types } },
        { terms: { status: [SEDIA.status.open, SEDIA.status.forthcoming] } },
      ],
    },
  };
  const { body, contentType } = buildMultipart({
    query,
    languages: SEDIA.languages,
    // Stable, unique sort key → exhaustive pagination with no skips or repeats
    // across pages. (sortStatus is unstable and silently skips ~27 calls; the
    // API still returns ~2071 raw rows with ~454 duplicate identifiers, which
    // we dedupe below to ~1617 unique calls.)
    sort: { field: "identifier", order: "ASC" },
    pageSize: SEDIA.pageSize,
    pageNumber,
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SEDIA.timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": contentType, Accept: "application/json" },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`SEDIA HTTP ${res.status}`);
    const data = (await res.json()) as {
      totalResults?: number;
      results?: Array<{ metadata?: Meta }>;
      type?: string;
      message?: string;
    };
    if (data.type === "throwable" || (data.message && !data.results)) {
      throw new Error(`SEDIA error: ${data.message ?? "unknown"}`);
    }
    const metas = (data.results ?? []).map((r) => r.metadata ?? {});
    return { total: Number(data.totalResults ?? 0), metas };
  } finally {
    clearTimeout(timer);
  }
}

// Fetch all open + forthcoming calls, paginating up to the safety cap.
// Fails soft: on a page error it stops and returns what it has, ok=false + error.
export async function fetchCalls(): Promise<CallsDoc> {
  const fetchedAt = new Date().toISOString();
  const calls: Call[] = [];
  const seen = new Set<string>();
  const errors: string[] = [];
  let total = 0;

  const collect = (metas: Meta[]) => {
    for (const m of metas) {
      const c = normalize(m);
      if (c && !seen.has(c.id)) {
        seen.add(c.id);
        calls.push(c);
      }
    }
  };
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  // Page 1 first, to learn the total result count.
  try {
    const firstPage = await fetchPage(1);
    total = firstPage.total;
    collect(firstPage.metas);
  } catch (e) {
    // Without page 1 we can't size the run — fail soft with an empty result.
    return {
      source: "SEDIA",
      fetchedAt,
      ok: false,
      total: 0,
      count: 0,
      error: `page 1: ${msg(e)}`,
      calls: [],
    };
  }

  // Remaining pages, fetched with bounded concurrency. A failed page is logged
  // and skipped — one bad page never sinks the whole refresh.
  const totalPages = Math.min(Math.ceil(total / SEDIA.pageSize), SEDIA.maxPages);
  const rest: number[] = [];
  for (let p = 2; p <= totalPages; p++) rest.push(p);

  for (let i = 0; i < rest.length; i += SEDIA.concurrency) {
    const batch = rest.slice(i, i + SEDIA.concurrency);
    const settled = await Promise.allSettled(batch.map((p) => fetchPage(p)));
    settled.forEach((s, idx) => {
      if (s.status === "fulfilled") collect(s.value.metas);
      else errors.push(`page ${batch[idx]}: ${msg(s.reason)}`);
    });
  }

  // Display order: open before forthcoming; within a status, upcoming deadlines
  // first (soonest first), then undated/rolling, then already-passed cut-offs.
  const rank: Record<string, number> = {
    open: 0,
    forthcoming: 1,
    closed: 2,
    unknown: 3,
  };
  const now = Date.now();
  const deadlineKey = (c: Call): [number, number] => {
    const t = c.deadline ? Date.parse(c.deadline) : NaN;
    if (Number.isNaN(t)) return [1, 0]; // no/invalid deadline → middle bucket
    return t >= now ? [0, t] : [2, t]; // upcoming first, passed last
  };
  calls.sort((a, b) => {
    const s = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    if (s !== 0) return s;
    const [ba, ta] = deadlineKey(a);
    const [bb, tb] = deadlineKey(b);
    if (ba !== bb) return ba - bb;
    return ta - tb;
  });

  return {
    source: "SEDIA",
    fetchedAt,
    ok: errors.length === 0,
    total,
    count: calls.length,
    error: errors.length ? errors.join("; ") : null,
    calls,
  };
}
