// BNR (National Bank of Romania) reference FX rates.
// The per-year XML holds every publishing day YTD, so one fetch yields the
// latest rate AND the trend. Rates are RON per 1 unit of currency (per
// `multiplier` units when the attribute is present, e.g. HUF/JPY = per 100).

import { BNR } from "./config";

export interface FxRate {
  currency: string;
  rate: number; // RON per `multiplier` units of the currency
  multiplier: number;
  date: string; // latest publishing date (YYYY-MM-DD)
  prev: number | null; // previous publishing day's rate
  changePct: number | null; // day-over-day % change
  spark: number[]; // last N rates, oldest -> newest
}

export interface FxBlock {
  ok: boolean;
  error: string | null;
  date: string | null;
  base: "RON";
  rates: FxRate[];
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function fetchYearXml(year: number): Promise<string> {
  const url = `${BNR.yearUrlBase}${year}.xml`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), BNR.timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`BNR HTTP ${res.status} (${year})`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseCubes(xml: string): Array<{ date: string; body: string }> {
  const cubes: Array<{ date: string; body: string }> = [];
  const re = /<Cube date="([0-9-]+)">([\s\S]*?)<\/Cube>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) cubes.push({ date: m[1], body: m[2] });
  return cubes;
}

export async function fetchFx(): Promise<FxBlock> {
  const year = new Date().getUTCFullYear();
  try {
    let cubes = parseCubes(await fetchYearXml(year));
    // Early-January fallback: if this year has too little history, prepend last year.
    if (cubes.length < 2) {
      try {
        cubes = parseCubes(await fetchYearXml(year - 1)).concat(cubes);
      } catch {
        /* keep what we have */
      }
    }
    if (!cubes.length) throw new Error("no rate data in BNR XML");

    const latestDate = cubes[cubes.length - 1].date;
    const rates: FxRate[] = [];

    for (const cur of BNR.currencies) {
      const rateRe = new RegExp(
        `<Rate currency="${cur}"(?: multiplier="(\\d+)")?>([0-9.]+)</Rate>`,
      );
      const series: Array<{ rate: number; mult: number }> = [];
      for (const c of cubes) {
        const rm = rateRe.exec(c.body);
        if (rm) series.push({ rate: parseFloat(rm[2]), mult: rm[1] ? Number(rm[1]) : 1 });
      }
      if (!series.length) continue;
      const last = series[series.length - 1];
      const prev = series.length > 1 ? series[series.length - 2] : null;
      rates.push({
        currency: cur,
        rate: last.rate,
        multiplier: last.mult,
        date: latestDate,
        prev: prev ? prev.rate : null,
        changePct: prev ? ((last.rate - prev.rate) / prev.rate) * 100 : null,
        spark: series.slice(-BNR.sparkDays).map((s) => s.rate),
      });
    }

    return { ok: true, error: null, date: latestDate, base: "RON", rates };
  } catch (e) {
    return { ok: false, error: msg(e), date: null, base: "RON", rates: [] };
  }
}
