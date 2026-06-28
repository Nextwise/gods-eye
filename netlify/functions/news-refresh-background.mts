// Background function (~15-min limit). The news pipeline runs real Grok live web
// searches and exceeds the synchronous request timeout, so it runs here. Triggered
// by cron-news and by /api/refresh?source=news. Token-gated even though background
// functions always 202 the caller — we don't want anonymous triggers of paid work.

import { refreshNews } from "../lib/news-pipeline";

export default async (req: Request) => {
  if (process.env.REFRESH_TOKEN) {
    const token = req.headers.get("x-refresh-token") ?? "";
    if (token !== process.env.REFRESH_TOKEN) {
      return new Response("unauthorized", { status: 401 });
    }
  }
  const summary = await refreshNews();
  console.log("[news-background]", JSON.stringify(summary));
  return new Response("ok");
};
