// Policy Objective taxonomy + mappings for the JOIN. The 5 cohesion Policy
// Objectives (2021-2027) are the unifying buckets: 2014-2020 Thematic Objectives,
// 2021-2027 data, and SEDIA calls are all mapped onto them. Coarse by design —
// this is a strategic signal ("which themes have money + open calls"), and the
// mappings are config you can tune.

export interface PolicyObjective {
  id: string;
  name: string;
  blurb: string;
}

export const POLICY_OBJECTIVES: PolicyObjective[] = [
  { id: "PO1", name: "Smarter Europe", blurb: "Innovation, digital, SME competitiveness" },
  { id: "PO2", name: "Greener Europe", blurb: "Energy, climate, environment, just transition" },
  { id: "PO3", name: "Connected Europe", blurb: "Transport & digital connectivity" },
  { id: "PO4", name: "Social Europe", blurb: "Employment, education, health, inclusion" },
  { id: "PO5", name: "Closer to citizens", blurb: "Urban & territorial development" },
];
export const PO_IDS = POLICY_OBJECTIVES.map((p) => p.id);

// 2014-2020 Thematic Objective code -> Policy Objective bucket.
export const TO_TO_PO: Record<string, string> = {
  "1": "PO1", // research & innovation
  "2": "PO1", // ICT
  "3": "PO1", // SME competitiveness
  "4": "PO2", // low-carbon
  "5": "PO2", // climate adaptation
  "6": "PO2", // environment
  "7": "PO3", // transport
  "8": "PO4", // employment
  "9": "PO4", // social inclusion
  "10": "PO4", // education
  "11": "PO4", // institutional capacity
};

// 2021-2027 pol_obj_short_name -> Policy Objective bucket (handles JTF + HOME funds).
export function poFromShortName(shortName: string): string | null {
  const s = (shortName || "").toUpperCase();
  if (/JTF|JUST TRANSITION/.test(s)) return "PO2";
  if (/BORDER|ASYLUM|SECURITY|MIGRATION/.test(s)) return "PO4";
  if (/PO1|SMARTER/.test(s)) return "PO1";
  if (/PO2|GREENER/.test(s)) return "PO2";
  if (/PO3|CONNECTED/.test(s)) return "PO3";
  if (/PO4|SOCIAL/.test(s)) return "PO4";
  if (/PO5|CLOSER/.test(s)) return "PO5";
  return null; // Technical Assistance / other → excluded from the JOIN
}

// SEDIA call (programme + identifier) -> Policy Objective bucket.
export function callToPO(programme: string, identifier: string): string {
  const p = `${programme} ${identifier}`.toUpperCase();
  if (/JTF|JUST TRANSITION/.test(p)) return "PO2";
  if (/CEF|TRANSPORT|CONNECT/.test(p)) return "PO3";
  if (/LIFE|ENERG|CLIMAT|ENVIRON|GREEN|RENEW|EURATOM|EMFAF/.test(p)) return "PO2";
  if (/ERASMUS|ESF|SOCIAL|EMPLOY|EDUCAT|HEALTH|EU4H|AMIF|CERV|JUSTICE|MIGRAT|CITIZEN|ISF/.test(p)) return "PO4";
  if (/URBAN|TERRITOR|INTERREG/.test(p)) return "PO5";
  if (/HORIZON|DIGITAL|INNOV|SME|RESEARCH|COMPET|EDF|DEFENCE/.test(p)) return "PO1";
  return "PO1"; // default: most SEDIA calls are Horizon-style R&I
}
