// Scheduled function — refreshes SEDIA calls daily.
// Schedule is set in netlify.toml ([functions."cron-sedia"].schedule), keeping
// cadence in config rather than code.

import { refreshCalls } from "../lib/pipeline";

export default async () => {
  const summary = await refreshCalls();
  console.log("[cron-sedia]", JSON.stringify(summary));
  // Scheduled functions don't need to return a body.
};
