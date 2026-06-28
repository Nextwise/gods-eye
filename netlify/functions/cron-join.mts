// Scheduled function — recomputes the absorption × calls JOIN. Absorption data
// changes slowly (weekly cadence in netlify.toml). Reads the latest calls blob.

import { refreshJoin } from "../lib/join-pipeline";

export default async () => {
  const summary = await refreshJoin();
  console.log("[cron-join]", JSON.stringify(summary));
};
