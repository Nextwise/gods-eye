// Eurostat dissemination API (JSON-stat) — HICP annual rate of change.
// JSON-stat stores all numbers in a flat `value` map keyed by a single index
// computed from each dimension's position (`id`) and size (`size`).

import { EUROSTAT, GEO_LABELS } from "./config";

export interface InflationSeries {
  geo: string;
  label: string;
  latest: number | null;
  latestPeriod: string | null;
  prev: number | null;
  spark: Array<{ period: string; value: number }>;
}

export interface InflationBlock {
  ok: boolean;
  error: string | null;
  label: string;
  unit: string;
  updated: string | null;
  series: InflationSeries[];
}

interface JsonStat {
  label?: string;
  updated?: string;
  id: string[];
  size: number[];
  value: Record<string, number | null>;
  dimension: Record<
    string,
    { category: { index: Record<string, number>; label?: Record<string, string> } }
  >;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Flat index for a coordinate given as dimensionId -> categoryIndex.
function flatIndex(stat: JsonStat, coords: Record<string, number>): number {
  let flat = 0;
  for (let i = 0; i < stat.id.length; i++) {
    let stride = 1;
    for (let j = i + 1; j < stat.id.length; j++) stride *= stat.size[j];
    flat += (coords[stat.id[i]] ?? 0) * stride;
  }
  return flat;
}

export async function fetchInflation(): Promise<InflationBlock> {
  const { dataset, coicop, geos, months } = EUROSTAT.hicp;
  const params = new URLSearchParams({
    format: "JSON",
    lang: "EN",
    coicop,
    lastTimePeriod: String(months),
  });
  for (const g of geos) params.append("geo", g);
  const url = `${EUROSTAT.base}/${dataset}?${params.toString()}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EUROSTAT.timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Eurostat HTTP ${res.status}`);
    const stat = (await res.json()) as JsonStat;

    const geoIndex = stat.dimension.geo.category.index;
    const geoLabel = stat.dimension.geo.category.label ?? {};
    const timeIndex = stat.dimension.time.category.index;
    const unit =
      Object.values(stat.dimension.unit?.category.label ?? {})[0] ?? "annual % change";

    // Periods oldest -> newest.
    const periods = Object.entries(timeIndex)
      .sort((a, b) => a[1] - b[1])
      .map(([p]) => p);

    const series: InflationSeries[] = [];
    for (const geo of geos) {
      if (!(geo in geoIndex)) continue;
      const spark: Array<{ period: string; value: number }> = [];
      for (const period of periods) {
        const v = stat.value[
          String(flatIndex(stat, { geo: geoIndex[geo], time: timeIndex[period] }))
        ];
        if (typeof v === "number") spark.push({ period, value: v });
      }
      const latest = spark.length ? spark[spark.length - 1] : null;
      const prev = spark.length > 1 ? spark[spark.length - 2] : null;
      series.push({
        geo,
        label: GEO_LABELS[geo] ?? geoLabel[geo] ?? geo,
        latest: latest ? latest.value : null,
        latestPeriod: latest ? latest.period : null,
        prev: prev ? prev.value : null,
        spark,
      });
    }

    return {
      ok: true,
      error: null,
      label: stat.label ?? "HICP — annual rate of change",
      unit,
      updated: stat.updated ?? null,
      series,
    };
  } catch (e) {
    return {
      ok: false,
      error: msg(e),
      label: "HICP — annual rate of change",
      unit: "annual % change",
      updated: null,
      series: [],
    };
  } finally {
    clearTimeout(timer);
  }
}
