import { describe, expect, it } from "vitest";
import { draftSchema, newDraft, newModule, payload } from "./submission";

function ready() { const d = newDraft(); d.title = "История"; d.alias = "Автор"; d.summary = "Аннотация"; d.modules.forEach(m => { m.title = m.kind; m.body = "Текст"; }); return d; }
describe("submission form", () => {
  it("requires complete modules and unique character names", () => {
    expect(() => payload(newDraft())).toThrow();
    const d = ready(); expect(payload(d).modules).toHaveLength(5);
    d.modules[3].title = d.modules[2].title;
    expect(() => payload(d)).toThrow("разные имена");
  });
  it("bounds imported drafts and total text", () => {
    const d = ready(); d.modules.push({ ...newModule("support"), title: "Друг", body: "x" });
    d.modules.forEach(m => { m.body = "x".repeat(12000); });
    expect(() => payload(d)).toThrow("60 000");
    d.modules[0].body += "x"; expect(draftSchema.safeParse(d).success).toBe(false);
  });
  it("does not send browser draft identifiers or receipts as story content", () => {
    const d = ready(); d.receipt = 42;
    const value = payload(d);
    expect(value).not.toHaveProperty("receipt");
    expect(value).not.toHaveProperty("requestId");
    expect(value.modules[0]).not.toHaveProperty("id");
    expect(value.consent).toBe(true);
  });
});
