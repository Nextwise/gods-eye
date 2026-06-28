// Scheduled function — recomputes the "what's new" diff once a day (after the
// SEDIA and news crons have refreshed their blobs). Schedule in netlify.toml.

import { refreshWhatsNew } from "../lib/whatsnew";

export default async () => {
  const summary = await refreshWhatsNew();
  console.log("[cron-diff]", JSON.stringify(summary));
};
