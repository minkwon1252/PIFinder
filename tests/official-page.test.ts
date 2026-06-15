import { describe, it, expect } from "vitest";
import { parseMitEecsFaculty } from "@/lib/sources/parsers/mit.mjs";
import {
  parseStanfordPersonsObj,
  parseStanfordEe,
  parseStanfordHbCard,
} from "@/lib/sources/parsers/stanford.mjs";

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

describe("Stanford JSON:API person parser", () => {
  const page = {
    data: [
      {
        attributes: {
          title: "Jane Researcher",
          su_person_full_title: "Associate Professor of Materials Science and Engineering",
          su_person_email: "jane@stanford.edu",
          su_person_profile_link: { uri: "https://profiles.stanford.edu/12345" },
          su_person_research_interests: { value: "<p>Batteries and <b>solid electrolytes</b>.</p>" },
        },
      },
      // emeritus → excluded
      { attributes: { title: "Old Prof", su_person_full_title: "Professor of Chemistry, Emeritus" } },
      // non-faculty (PI) → excluded
      { attributes: { title: "Some Investigator", su_person_full_title: "Principal Investigator" } },
    ],
  };
  const rows = parseStanfordPersonsObj(page);

  it("keeps professorial faculty and drops emeritus / non-faculty", () => {
    expect(rows).toHaveLength(1);
    expect(rows[0]?.fullName).toBe("Jane Researcher");
  });

  it("maps title, email, and the Stanford Profiles homepage", () => {
    expect(rows[0]).toMatchObject({
      title: "Associate Professor of Materials Science and Engineering",
      email: "jane@stanford.edu",
      homepageUrl: "https://profiles.stanford.edu/12345",
    });
  });

  it("derives a research identity from interests with HTML stripped", () => {
    expect(rows[0]?.researchIdentity).toBe("Batteries and solid electrolytes.");
  });
});

describe("Stanford EE orglist parser", () => {
  const html = `<h3 class="orglist__display-name"><a href="https://profiles.stanford.edu/sara-achour">Sara Achour</a>
    <small class="orglist__person-title d-block"> Assistant Professor </small></h3>`;
  it("extracts name, title, and the Profiles homepage", () => {
    const rows = parseStanfordEe(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fullName: "Sara Achour",
      title: "Assistant Professor",
      homepageUrl: "https://profiles.stanford.edu/sara-achour",
    });
  });
});

describe("Stanford hb-card parser", () => {
  const html = `<div class="hb-card__title"><h2><div class="views-field views-field-title"><span class="field-content">
    <a href="/people/tom-abel" hreflang="en">Tom Abel</a></span></div></h2></div>
    <div class="hb-card__subcontent"><span class="field-content hb-subtitle">Professor of Physics</span></div>`;
  const rows = parseStanfordHbCard(html, "https://physics.stanford.edu/people/faculty");
  it("extracts name + title and absolutizes the relative profile link", () => {
    expect(rows[0]).toMatchObject({
      fullName: "Tom Abel",
      title: "Professor of Physics",
      homepageUrl: "https://physics.stanford.edu/people/tom-abel",
    });
  });
});
