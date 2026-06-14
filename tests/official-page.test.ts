import { describe, it, expect } from "vitest";
import { parseMitEecsFaculty } from "@/lib/sources/parsers/mit.mjs";

// Fixture mirrors the real MIT EECS people-page markup (verified 2026-06).
const FIXTURE = `
<div class="people-mod">
  <a href="https://www.eecs.mit.edu/people/hal-abelson/"><img alt="Hal Abelson" /></a>
  <h5><a href="https://www.eecs.mit.edu/people/hal-abelson/" rel="bookmark">Hal Abelson</a></h5>
  <p>Class of 1922 Professor, [CS and AI+D]</p>
  <ul><li><a href="mailto:hal@mit.edu">hal@mit.edu</a></li></ul>
  <div class="people-research">
    <p><a href="?fwp_research=ai-and-society">AI and Society</a></p>
    <p><a href="?fwp_research=artificial-intelligence-machine-learning">Artificial Intelligence + Machine Learning</a></p>
  </div>
</div>
<div class="people-mod">
  <h5><a href="https://www.eecs.mit.edu/people/akintunde-akinwande/" rel="bookmark">Akintunde Akinwande</a></h5>
  <p>Thomas and Gerd Perkins Professor; Professor of EE, [EE]</p>
  <ul><li><a href="mailto:akinwand@mit.edu">akinwand@mit.edu</a></li></ul>
</div>`;

describe("MIT EECS faculty parser", () => {
  const rows = parseMitEecsFaculty(FIXTURE, "https://www.eecs.mit.edu/role/faculty/");

  it("extracts each faculty member with name + homepage", () => {
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      fullName: "Hal Abelson",
      homepageUrl: "https://www.eecs.mit.edu/people/hal-abelson/",
      email: "hal@mit.edu",
    });
  });

  it("reads the bracketed area tag used to route CS vs EE", () => {
    expect(rows[0]?.areaTag).toBe("CS and AI+D");
    expect(rows[1]?.areaTag).toBe("EE");
  });

  it("captures research themes when present, lowercased and de-duped", () => {
    expect(rows[0]?.researchThemes).toContain("ai and society");
    expect(rows[1]?.researchThemes).toEqual([]); // none in this entry → empty, not invented
  });

  it("never throws on unexpected markup (returns [])", () => {
    expect(parseMitEecsFaculty("<html>no faculty here</html>", "x")).toEqual([]);
  });
});
