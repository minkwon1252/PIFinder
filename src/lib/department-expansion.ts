/**
 * Department expansion rule.
 *
 * The set of departments PI Finder searches must vary per student and per
 * school tier:
 *   - Reach:      broad — major + related engineering + relevant math/science.
 *   - Target:     major + closely related departments.
 *   - Foundation: mainly the major + directly keyword-related departments.
 *
 * Keyword-driven add-ons layer on top (semiconductor → EE/applied physics, etc).
 */

export type Tier = "reach" | "target" | "foundation";

// Department abbreviations as used in the seed data.
const RELATED_ENGINEERING = ["EE", "ME", "ChemE", "BME", "AeroE", "CEE", "ISE"];
const RELATED_SCIENCE = ["PHYS", "AP", "CHEM", "MATH"];

/** Keyword → extra departments to consider, regardless of tier. */
const KEYWORD_DEPARTMENTS: Record<string, string[]> = {
  semiconductor: ["EE", "AP", "PHYS"],
  device: ["EE", "AP"],
  nanofabrication: ["EE", "AP"],
  "nuclear materials": ["NucE"],
  nuclear: ["NucE"],
  biomaterials: ["BME", "CHEM"],
  bio: ["BME"],
  battery: ["ChemE", "ME"],
  energy: ["ChemE", "ME"],
  catalysis: ["CHEM", "ChemE"],
  photonics: ["EE", "AP", "PHYS"],
  computational: ["CS", "MATH"],
  simulation: ["CS", "MATH"],
};

export interface ExpansionInput {
  /** Primary major department abbreviation, e.g. "MSE". */
  majorAbbrev: string;
  /** Optional second major. */
  secondMajorAbbrev?: string | null;
  /** Lowercased research interest keywords. */
  keywords: string[];
  tier: Tier;
}

/**
 * Returns the ordered, de-duplicated list of department abbreviations to search
 * for a given school tier and student profile.
 */
export function expandDepartments(input: ExpansionInput): string[] {
  const out = new Set<string>();
  out.add(input.majorAbbrev);
  if (input.secondMajorAbbrev) out.add(input.secondMajorAbbrev);

  // MSE always also considers physics/chemistry/chemical engineering (per spec).
  if (input.majorAbbrev === "MSE") {
    ["PHYS", "CHEM", "ChemE"].forEach((d) => out.add(d));
  }

  if (input.tier === "reach") {
    RELATED_ENGINEERING.forEach((d) => out.add(d));
    RELATED_SCIENCE.forEach((d) => out.add(d));
  } else if (input.tier === "target") {
    // Closely related engineering only.
    ["EE", "ME", "ChemE"].forEach((d) => out.add(d));
  }
  // foundation: major only (plus keyword-driven below).

  // Keyword-driven additions (apply to all tiers).
  for (const kw of input.keywords.map((k) => k.toLowerCase().trim())) {
    for (const [needle, depts] of Object.entries(KEYWORD_DEPARTMENTS)) {
      if (kw.includes(needle)) depts.forEach((d) => out.add(d));
    }
  }

  return [...out];
}
