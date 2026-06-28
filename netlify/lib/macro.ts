// Macro pipeline — fetch BNR FX + Eurostat HICP (each fail-soft), assemble the
// macro doc and store it in Blobs. One source failing never sinks the other.

import { fetchFx, type FxBlock } from "./bnr";
import { fetchInflation, type InflationBlock } from "./eurostat";
import { writeMacro } from "./blobs";

export interface MacroDoc {
  fetchedAt: string;
  ok: boolean;
  fx: FxBlock;
  inflation: InflationBlock;
}

export interface MacroSummary {
  ok: boolean;
  fxOk: boolean;
  inflationOk: boolean;
  fxError: string | null;
  inflationError: string | null;
  fetchedAt: string;
}

export async function refreshMacro(): Promise<MacroSummary> {
  const fetchedAt = new Date().toISOString();
  // Both fetchers swallow their own errors and return ok:false blocks.
  const [fx, inflation] = await Promise.all([fetchFx(), fetchInflation()]);
  const doc: MacroDoc = { fetchedAt, ok: fx.ok && inflation.ok, fx, inflation };
  await writeMacro(doc);
  return {
    ok: doc.ok,
    fxOk: fx.ok,
    inflationOk: inflation.ok,
    fxError: fx.error,
    inflationError: inflation.error,
    fetchedAt,
  };
}
