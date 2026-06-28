// Scheduled function — refreshes macro (BNR FX + Eurostat HICP) daily.
// Schedule lives in netlify.toml ([functions."cron-macro"].schedule).

import { refreshMacro } from "../lib/macro";

export default async () => {
  const summary = await refreshMacro();
  console.log("[cron-macro]", JSON.stringify(summary));
};
