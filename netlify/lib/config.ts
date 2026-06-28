// God's Eye — central config.
// RULE: endpoints, magic codes and cadences live here, never hardcoded in logic.
// (Cron schedules live in netlify.toml, the other half of "config not code".)

export const SEDIA = {
  endpoint: "https://api.tech.ec.europa.eu/search-api/prod/rest/search",
  apiKey: "SEDIA",
  text: "***",
  languages: ["en"],
  // Document types we care about: 1=topic (Horizon-style), 8=competitive call
  // (Digital/others), 2=other grant.
  types: ["1", "2", "8"],
  status: {
    forthcoming: "31094501",
    open: "31094502",
    closed: "31094503",
  },
  // Server caps pageSize at 100 (larger requests are clamped), so we page.
  pageSize: 100,
  // Safety cap so a paging bug can never loop forever: 40*100 = 4000 (> ~2071 today).
  maxPages: 40,
  // Pages are fetched with this much concurrency to stay well under the
  // function timeout (~21 pages sequentially was ~20s; concurrent is ~4s).
  concurrency: 6,
  timeoutMs: 20000,
} as const;

// status code -> label
export const STATUS_LABELS: Record<string, string> = {
  "31094501": "forthcoming",
  "31094502": "open",
  "31094503": "closed",
};

// document type code -> label
export const TYPE_LABELS: Record<string, string> = {
  "1": "Topic",
  "2": "Grant",
  "8": "Competitive call",
};

// Framework programme ID -> human name. Extend as new programmes appear;
// unknown IDs fall back to an identifier-prefix heuristic, then to the raw ID.
export const PROGRAMMES: Record<string, string> = {
  "43108390": "Horizon Europe",
  "43152860": "Digital Europe",
  "31045243": "Horizon 2020",
  "111111": "EuropeAid",
  "44181033": "European Defence Fund",
  "43251814": "Creative Europe",
  "43252368": "Internal Security Fund",
  "43089234": "Innovation Fund",
  "44773066": "Just Transition Mechanism",
  "43392145": "EMFAF (Maritime & Fisheries)",
  "43637601": "Pilot Projects & Preparatory Actions",
  "43254037": "European Solidarity Corps",
  "43252517": "ESF+ / Social",
  "43298916": "Euratom",
  "45876777": "NDICI-Global Europe",
  "43251882": "CAP — Information Measures",
  "43697167": "European Parliament",
  "45532249": "EU Agencies & Bodies",
  "43253967": "Renewable Energy Financing",
  "46324255": "ERDF / Interreg",
  "43252433": "Pericles IV",
};

// Identifier-prefix -> programme name (fallback when the framework ID is unknown).
export const PROGRAMME_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["HORIZON", "Horizon Europe"],
  ["DIGITAL", "Digital Europe"],
  ["ERASMUS", "Erasmus+"],
  ["EUROPEAID", "EuropeAid"],
  ["CEF", "Connecting Europe Facility"],
  ["LIFE", "LIFE"],
  ["EU4H", "EU4Health"],
  ["CERV", "Citizens, Equality, Rights and Values"],
  ["CREA", "Creative Europe"],
  ["EDF", "European Defence Fund"],
  ["ESC", "European Solidarity Corps"],
  ["ISF", "Internal Security Fund"],
  ["EMFAF", "EMFAF (Maritime & Fisheries)"],
  ["INNOVFUND", "Innovation Fund"],
  ["EURATOM", "Euratom"],
  ["NDICI", "NDICI-Global Europe"],
  ["JTM", "Just Transition Mechanism"],
  ["SMP", "Single Market Programme"],
  ["JUST", "Justice Programme"],
  ["AMIF", "Asylum, Migration and Integration Fund"],
  ["ESF", "European Social Fund+"],
  ["RFCS", "Research Fund for Coal and Steel"],
  ["I3", "Interregional Innovation Investments"],
  ["IMET", "Internal Market"],
];

export const BLOBS = {
  store: "gods-eye",
  keys: {
    calls: "calls.json",
  },
} as const;
