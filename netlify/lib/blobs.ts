// Netlify Blobs access. Site context auto-injects siteID + token, so getStore
// needs no configuration when called from a Function.

import { getStore } from "@netlify/blobs";
import { BLOBS } from "./config";
import type { CallsDoc } from "./sedia";
import type { MacroDoc } from "./macro";
import type { NewsDoc } from "./news-pipeline";
import type { JoinDoc } from "./join-pipeline";

function store() {
  return getStore(BLOBS.store);
}

export async function writeCalls(doc: CallsDoc): Promise<void> {
  await store().setJSON(BLOBS.keys.calls, doc);
}

export async function readCalls(): Promise<CallsDoc | null> {
  return (await store().get(BLOBS.keys.calls, { type: "json" })) as CallsDoc | null;
}

export async function writeMacro(doc: MacroDoc): Promise<void> {
  await store().setJSON(BLOBS.keys.macro, doc);
}

export async function readMacro(): Promise<MacroDoc | null> {
  return (await store().get(BLOBS.keys.macro, { type: "json" })) as MacroDoc | null;
}

export async function writeNews(doc: NewsDoc): Promise<void> {
  await store().setJSON(BLOBS.keys.news, doc);
}

export async function readNews(): Promise<NewsDoc | null> {
  return (await store().get(BLOBS.keys.news, { type: "json" })) as NewsDoc | null;
}

export async function writeJoin(doc: JoinDoc): Promise<void> {
  await store().setJSON(BLOBS.keys.join, doc);
}

export async function readJoin(): Promise<JoinDoc | null> {
  return (await store().get(BLOBS.keys.join, { type: "json" })) as JoinDoc | null;
}
