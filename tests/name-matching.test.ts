import { describe, expect, it } from "vitest";
import { findProfileNameMatches, findUniqueProfileByName, normalizePersonName } from "../lib/users/name-matching";

const profiles = [
  { id: "tarneem", full_name: "ترنيم الزهراني" },
  { id: "bashayer", full_name: "بشائر باحجري" },
  { id: "mohammed-j", full_name: "محمد الجديعي" },
  { id: "mohammed-b", full_name: "محمد بارحمة" },
  { id: "atheer", full_name: "أثير" },
];

describe("profile name matching", () => {
  it("normalizes common Arabic name variants", () => {
    expect(normalizePersonName("أثير")).toBe("اثير");
    expect(normalizePersonName(" تـرنيم  ")).toBe("ترنيم");
  });

  it("matches a unique imported first name to a registered full name", () => {
    expect(findUniqueProfileByName("ترنيم", profiles)?.id).toBe("tarneem");
    expect(findUniqueProfileByName("بشائر", profiles)?.id).toBe("bashayer");
  });

  it("matches exact multi-part names", () => {
    expect(findUniqueProfileByName("محمد الجديعي", profiles)?.id).toBe("mohammed-j");
  });

  it("refuses ambiguous short names", () => {
    expect(findProfileNameMatches("محمد", profiles)).toHaveLength(2);
    expect(findUniqueProfileByName("محمد", profiles)).toBeNull();
  });

  it("ignores empty imported names", () => {
    expect(findUniqueProfileByName("", profiles)).toBeNull();
    expect(findUniqueProfileByName(null, profiles)).toBeNull();
  });
});
