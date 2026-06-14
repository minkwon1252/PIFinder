import { describe, it, expect, beforeAll } from "vitest";
import { checkDomainGate, emailHasAllowedDomain } from "@/lib/membership";

beforeAll(() => {
  process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN = "snu.ac.kr";
});

describe("membership domain gate", () => {
  it("accepts an snu.ac.kr email", () => {
    expect(checkDomainGate("student@snu.ac.kr")).toBe(true);
  });

  it("accepts a subdomain of snu.ac.kr", () => {
    expect(emailHasAllowedDomain("a@eng.snu.ac.kr")).toBe(true);
  });

  it("rejects a non-snu email", () => {
    expect(checkDomainGate("someone@gmail.com")).toBe(false);
  });

  it("rejects a lookalike domain", () => {
    expect(checkDomainGate("attacker@snu.ac.kr.evil.com")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(checkDomainGate("Student@SNU.AC.KR")).toBe(true);
  });
});
