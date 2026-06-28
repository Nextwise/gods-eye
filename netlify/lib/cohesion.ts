// Cohesion Open Data (Socrata) absorption fetcher. Returns, per Policy Objective,
// Romania + EU figures for both periods:
//  - 2014-2020: absorption rate (spent / planned) by Thematic Objective → PO
//  - 2021-2027: planned / decided / spent by Policy Objective (the active envelope)
// Fail-soft: a failed query yields nulls for that slice, never throws.

import { COHESION } from "./config";
import { PO_IDS, TO_TO_PO, poFromShortName } from "./themes";

export interface POAbsorption {
  po: string;
  planned21: number; // EU-amount planned 2021-2027 (RO)
  spentPct21: number | null; // RO spend rate 2021-2027
  decidedPct21: number | null; // RO selection rate 2021-2027
  absorb14: number | null; // RO absorption rate 2014-2020
  euSpentPct21: number | null; // EU avg spend rate 2021-2027
  euAbsorb14: number | null; // EU avg absorption rate 2014-2020
}

export interface AbsorptionBlock {
  ok: boolean;
  error: string | null;
  country: string;
  ro2127TotalPlanned: number;
  ro2127SpentPct: number | null;
  byPO: Record<string, POAbsorption>;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const num = (v: unknown) => Number(v) || 0;

async function soql(dataset: string, query: string): Promise<Array<Record<string, unknown>>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), COHESION.timeoutMs);
  try {
    const res = await fetch(`${COHESION.base}/${dataset}.json?${query}`, {
      headers: { accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`cohesion ${dataset} HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error(`cohesion ${dataset}: ${JSON.stringify(data).slice(0, 120)}`);
    return data as Array<Record<string, unknown>>;
  } finally {
    clearTimeout(timer);
  }
}

// 2014-2020: planned + spent by Thematic Objective → bucketed to PO. ms="" = EU.
async function fetch2014(ms: string): Promise<Record<string, { planned: number; spent: number }>> {
  const where = `latest_period='Y'${ms ? ` AND ms='${ms}'` : ""}`;
  const q =
    `$select=to,sum(total_eligible_cost) as planned,sum(total_eligible_expenditure) as spent` +
    `&$where=${encodeURIComponent(where)}&$group=to&$limit=200`;
  const rows = await soql(COHESION.ds2014, q);
  const byPO: Record<string, { planned: number; spent: number }> = {};
  for (const r of rows) {
    const po = TO_TO_PO[String(r.to)];
    if (!po) continue;
    (byPO[po] ??= { planned: 0, spent: 0 }).planned += num(r.planned);
    byPO[po].spent += num(r.spent);
  }
  return byPO;
}

// 2021-2027: planned/decided/spent by Policy Objective. ms="" = EU.
async function fetch2127(
  ms: string,
): Promise<Record<string, { planned: number; decided: number; spent: number }>> {
  const where =
    `dimension_type='Intervention Field' AND is_latest_tod_cycle='Y'${ms ? ` AND ms='${ms}'` : ""}`;
  const q =
    `$select=pol_obj_short_name,` +
    `sum(total_amount) as planned,` +
    `sum(total_eligiblecost_of_selectedoperations) as decided,` +
    `sum(totalspendeligibleexpenditure_declared) as spent` +
    `&$where=${encodeURIComponent(where)}&$group=pol_obj_short_name&$limit=200`;
  const rows = await soql(COHESION.ds2127, q);
  const byPO: Record<string, { planned: number; decided: number; spent: number }> = {};
  for (const r of rows) {
    const po = poFromShortName(String(r.pol_obj_short_name));
    if (!po) continue;
    const b = (byPO[po] ??= { planned: 0, decided: 0, spent: 0 });
    b.planned += num(r.planned);
    b.decided += num(r.decided);
    b.spent += num(r.spent);
  }
  return byPO;
}

const pct = (n: number, d: number): number | null => (d > 0 ? (100 * n) / d : null);

export async function fetchAbsorption(): Promise<AbsorptionBlock> {
  const country = COHESION.country;
  try {
    const [ro14, eu14, ro21, eu21] = await Promise.all([
      fetch2014(country),
      fetch2014(""),
      fetch2127(country),
      fetch2127(""),
    ]);

    const byPO: Record<string, POAbsorption> = {};
    let totalPlanned = 0;
    let totalSpent = 0;
    for (const po of PO_IDS) {
      const r21 = ro21[po] ?? { planned: 0, decided: 0, spent: 0 };
      const e21 = eu21[po] ?? { planned: 0, decided: 0, spent: 0 };
      const r14 = ro14[po];
      const e14 = eu14[po];
      totalPlanned += r21.planned;
      totalSpent += r21.spent;
      byPO[po] = {
        po,
        planned21: r21.planned,
        spentPct21: pct(r21.spent, r21.planned),
        decidedPct21: pct(r21.decided, r21.planned),
        absorb14: r14 ? pct(r14.spent, r14.planned) : null,
        euSpentPct21: pct(e21.spent, e21.planned),
        euAbsorb14: e14 ? pct(e14.spent, e14.planned) : null,
      };
    }

    return {
      ok: true,
      error: null,
      country,
      ro2127TotalPlanned: totalPlanned,
      ro2127SpentPct: pct(totalSpent, totalPlanned),
      byPO,
    };
  } catch (e) {
    return {
      ok: false,
      error: msg(e),
      country,
      ro2127TotalPlanned: 0,
      ro2127SpentPct: null,
      byPO: {},
    };
  }
}
