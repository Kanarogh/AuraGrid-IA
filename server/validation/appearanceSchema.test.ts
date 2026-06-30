import { describe, expect, it } from "vitest";
import { parseAppearanceSettingsBody } from "./appearanceSchema";

describe("parseAppearanceSettingsBody", () => {
  it("accepts aura accent", () => {
    const result = parseAppearanceSettingsBody({ accentId: "aura" });
    expect(result.accentId).toBe("aura");
  });

  it("rejects invalid accent id", () => {
    expect(() => parseAppearanceSettingsBody({ accentId: "invalid" })).toThrow();
  });
});
