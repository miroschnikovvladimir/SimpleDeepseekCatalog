import { describe, expect, it } from "vitest";
import { catalogSchema, importPayload } from "./catalog";
import emptyCatalog from "../public/catalog.json";

const fixture = () => catalogSchema.parse({
  version: 2,
  modules: ["setting", "plot", "character"].map(type => ({ id: type, type, title: type, description: "fixture" })),
  stories: [{ id: "story", title: "Test", setting_id: "setting", plot_id: "plot", character_ids: ["character"] }],
});

describe("published catalog contract", () => {
  it("validates the generated catalog index", () => {
    expect(catalogSchema.safeParse(emptyCatalog).success).toBe(true);
  });
  it("sends only a published story ID, never its prompt", () => {
    const payload = importPayload(fixture(), { story_id: "story" });
    expect(payload).toEqual({ action: "catalog_import", version: 1, story_id: "story" });
    expect(() => importPayload(fixture(), { story_id: "removed" })).toThrow();
  });
  it("rejects missing, wrong-type and repeated character references", () => {
    for (const characters of [["missing"], ["plot"], ["character", "character"]]) {
      const data = fixture();
      data.stories[0].character_ids = characters;
      expect(catalogSchema.safeParse(data).success).toBe(false);
    }
  });
  it("rejects duplicate IDs across stories and modules", () => {
    const data = fixture();
    data.stories[0].id = "character";
    expect(catalogSchema.safeParse(data).success).toBe(false);
  });
  it("builds a compact selection and validates its references", () => {
    const selection = { title: "My story", setting_id: "setting", plot_id: "plot", character_ids: ["character"] };
    expect(importPayload(fixture(), selection)).toEqual({ action: "catalog_build", version: 1, ...selection });
    expect(() => importPayload(fixture(), { ...selection, setting_id: "character" })).toThrow();
  });
  it("rejects executable image URLs", () => {
    const data = fixture();
    expect(catalogSchema.safeParse({ ...data, stories: [{ ...data.stories[0], cover: { thumbnail: "javascript:alert(1)", detail: "https://example.com/a.webp", width: 1, height: 1, alt: "" } }] }).success).toBe(false);
  });
});
