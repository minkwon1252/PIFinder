import { describe, it, expect } from "vitest";
import { scoreFit, WEIGHTS } from "@/lib/scoring/fit";

describe("fit scoring", () => {
  it("weights sum to 1 (before risk penalty)", () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("scores a strong match higher than a weak match", () => {
    const strong = scoreFit({
      studentKeywords: ["batteries", "solid electrolytes"],
      professorThemes: ["batteries", "solid electrolytes", "in-situ tem"],
      studentMethod: "experimental",
      professorMethod: "experimental",
      applicationArea: "batteries",
      latestPublicationYear: new Date().getFullYear(),
      projectKeywords: ["batteries"],
      deptSchoolMatch: true,
      dataCompleteness: 0.9,
    });
    const weak = scoreFit({
      studentKeywords: ["batteries"],
      professorThemes: ["quantum gravity"],
      studentMethod: "experimental",
      professorMethod: "theoretical",
      applicationArea: "batteries",
      latestPublicationYear: 2008,
      projectKeywords: [],
      deptSchoolMatch: false,
      dataCompleteness: 0.2,
    });
    expect(strong.total).toBeGreaterThan(weak.total);
    expect(strong.total).toBeLessThanOrEqual(100);
    expect(weak.total).toBeGreaterThanOrEqual(0);
  });

  it("applies a risk penalty when data is incomplete", () => {
    const complete = scoreFit({
      studentKeywords: ["a"],
      professorThemes: ["a"],
      studentMethod: "mixed",
      projectKeywords: [],
      deptSchoolMatch: true,
      dataCompleteness: 1,
    });
    const incomplete = scoreFit({
      studentKeywords: ["a"],
      professorThemes: ["a"],
      studentMethod: "mixed",
      projectKeywords: [],
      deptSchoolMatch: true,
      dataCompleteness: 0,
    });
    expect(incomplete.components.risk_penalty).toBeGreaterThan(
      complete.components.risk_penalty,
    );
    expect(incomplete.total).toBeLessThan(complete.total);
  });

  it("stores every component (explainable)", () => {
    const r = scoreFit({
      studentKeywords: ["a"],
      professorThemes: ["a"],
      studentMethod: "mixed",
      projectKeywords: [],
      deptSchoolMatch: true,
    });
    expect(Object.keys(r.components)).toEqual(
      expect.arrayContaining([
        "keyword_fit",
        "method_fit",
        "application_domain_fit",
        "publication_recency",
        "project_overlap",
        "dept_school_match",
        "lab_activity",
        "mentorship_proxy",
        "risk_penalty",
      ]),
    );
  });
});
