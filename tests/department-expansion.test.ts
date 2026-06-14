import { describe, it, expect } from "vitest";
import { expandDepartments } from "@/lib/department-expansion";

describe("department expansion rule", () => {
  it("MSE always considers physics, chemistry, chemical engineering", () => {
    const out = expandDepartments({
      majorAbbrev: "MSE",
      keywords: [],
      tier: "foundation",
    });
    expect(out).toEqual(expect.arrayContaining(["MSE", "PHYS", "CHEM", "ChemE"]));
  });

  it("reach searches broadly (more departments than foundation)", () => {
    const reach = expandDepartments({ majorAbbrev: "MSE", keywords: [], tier: "reach" });
    const foundation = expandDepartments({
      majorAbbrev: "MSE",
      keywords: [],
      tier: "foundation",
    });
    expect(reach.length).toBeGreaterThan(foundation.length);
  });

  it("semiconductor interest adds EE / applied physics", () => {
    const out = expandDepartments({
      majorAbbrev: "MSE",
      keywords: ["semiconductor devices"],
      tier: "foundation",
    });
    expect(out).toEqual(expect.arrayContaining(["EE", "AP"]));
  });

  it("nuclear materials adds nuclear engineering", () => {
    const out = expandDepartments({
      majorAbbrev: "MSE",
      keywords: ["nuclear materials"],
      tier: "foundation",
    });
    expect(out).toContain("NucE");
  });

  it("battery adds chemical & mechanical engineering", () => {
    const out = expandDepartments({
      majorAbbrev: "MSE",
      keywords: ["battery"],
      tier: "target",
    });
    expect(out).toEqual(expect.arrayContaining(["ChemE", "ME"]));
  });

  it("de-duplicates departments", () => {
    const out = expandDepartments({
      majorAbbrev: "MSE",
      secondMajorAbbrev: "MSE",
      keywords: ["battery", "battery"],
      tier: "reach",
    });
    expect(new Set(out).size).toBe(out.length);
  });
});
