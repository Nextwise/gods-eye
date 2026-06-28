// The JOIN — the actual product. Cross Romania's cohesion absorption gaps (per
// Policy Objective) with the open SEDIA calls tagged to the same PO = "where the
// money is on the table": themes with a big unspent envelope AND open calls.

import { fetchAbsorption } from "./cohesion";
import { readCalls, writeJoin } from "./blobs";
import { POLICY_OBJECTIVES, callToPO } from "./themes";

export interface JoinRow {
  po: string;
  name: string;
  blurb: string;
  planned21: number; // 2021-2027 planned (RO)
  unspent21: number; // money still on the table = planned × (1 − spent%)
  spentPct21: number | null;
  euSpentPct21: number | null;
  absorb14: number | null; // 2014-2020 RO absorption
  euAbsorb14: number | null;
  openCalls: number;
  forthcomingCalls: number;
  soonestDeadline: string | null;
}

export interface JoinDoc {
  fetchedAt: string;
  ok: boolean;
  error: string | null;
  country: string;
  ro2127TotalPlanned: number;
  ro2127Unspent: number;
  ro2127SpentPct: number | null;
  rows: JoinRow[];
}

export interface JoinSummary {
  ok: boolean;
  source: "join";
  rows: number;
  unspentTotalB: number;
  error: string | null;
  fetchedAt: string;
}

export async function refreshJoin(): Promise<JoinSummary> {
  const fetchedAt = new Date().toISOString();
  const absorption = await fetchAbsorption();

  // Tag open/forthcoming calls by PO; track soonest FUTURE deadline per PO.
  const now = Date.now();
  const callStats: Record<string, { open: number; forthcoming: number; soonest: number | null }> = {};
  const callsDoc = await readCalls();
  for (const c of callsDoc?.calls ?? []) {
    if (c.status !== "open" && c.status !== "forthcoming") continue;
    const po = callToPO(c.programme ?? "", c.id ?? "");
    const s = (callStats[po] ??= { open: 0, forthcoming: 0, soonest: null });
    if (c.status === "open") s.open++;
    else s.forthcoming++;
    const t = c.deadline ? Date.parse(c.deadline) : NaN;
    if (!Number.isNaN(t) && t >= now && (s.soonest === null || t < s.soonest)) s.soonest = t;
  }

  const rows: JoinRow[] = POLICY_OBJECTIVES.map((po) => {
    const a = absorption.byPO[po.id];
    const planned21 = a?.planned21 ?? 0;
    const spentPct21 = a?.spentPct21 ?? null;
    const unspent21 = planned21 * (1 - (spentPct21 ?? 0) / 100);
    const cs = callStats[po.id] ?? { open: 0, forthcoming: 0, soonest: null };
    return {
      po: po.id,
      name: po.name,
      blurb: po.blurb,
      planned21,
      unspent21,
      spentPct21,
      euSpentPct21: a?.euSpentPct21 ?? null,
      absorb14: a?.absorb14 ?? null,
      euAbsorb14: a?.euAbsorb14 ?? null,
      openCalls: cs.open,
      forthcomingCalls: cs.forthcoming,
      soonestDeadline: cs.soonest !== null ? new Date(cs.soonest).toISOString() : null,
    };
  });

  // Rank by money on the table (unspent envelope) descending.
  rows.sort((a, b) => b.unspent21 - a.unspent21);

  const doc: JoinDoc = {
    fetchedAt,
    ok: absorption.ok,
    error: absorption.error,
    country: absorption.country,
    ro2127TotalPlanned: absorption.ro2127TotalPlanned,
    ro2127Unspent: rows.reduce((s, r) => s + r.unspent21, 0),
    ro2127SpentPct: absorption.ro2127SpentPct,
    rows,
  };
  await writeJoin(doc);
  return {
    ok: doc.ok,
    source: "join",
    rows: rows.length,
    unspentTotalB: Math.round((doc.ro2127Unspent / 1e9) * 10) / 10,
    error: doc.error,
    fetchedAt,
  };
}
