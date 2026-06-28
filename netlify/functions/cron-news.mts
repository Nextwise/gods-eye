// Scheduled trigger — fires the news background function (the pipeline is long,
// so it can't run inside a normal scheduled invocation). Schedule lives in
// netlify.toml ([functions."cron-news"].schedule).

export default async () => {
  const base = process.env.URL ?? "";
  const res = await fetch(`${base}/.netlify/functions/news-refresh-background`, {
    method: "POST",
    headers: { "x-refresh-token": process.env.REFRESH_TOKEN ?? "" },
  });
  console.log("[cron-news] triggered background:", res.status);
};
