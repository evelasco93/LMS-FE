import { describe, expect, it } from "vitest";
import { formatPhone, normalizeFieldLabel } from "@/lib/utils";

describe("normalizeFieldLabel", () => {
  it("handles mixed key formats with abbreviations", () => {
    expect(normalizeFieldLabel("trusted_form_claim")).toBe(
      "Trusted Form Claim",
    );
    expect(normalizeFieldLabel("clientID")).toBe("Client ID");
    expect(normalizeFieldLabel("ipqsPhone")).toBe("IPQS Phone");
    expect(normalizeFieldLabel("utm_source")).toBe("UTM Source");
  });
});

describe("formatPhone", () => {
  it("formats 10 digit phone numbers", () => {
    expect(formatPhone("3055551212")).toBe("(305) 555-1212");
  });

  it("returns original value when not a standard US 10-digit number", () => {
    expect(formatPhone("123")).toBe("123");
  });

  it("does not modify values already in E.164 format", () => {
    expect(formatPhone("+13055551212")).toBe("+13055551212");
  });
});
