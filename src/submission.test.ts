import { describe, expect, it } from "vitest";
import { draftSchema, newDraft, newModule, payload, switchMode } from "./submission";

function ready() { const d = newDraft(); d.title = "История"; d.alias = "Автор"; d.summary = "Аннотация"; d.modules.forEach(m => { m.title = m.kind; m.body = "Текст"; }); return d; }
describe("submission form", () => {
  it("requires only two quick modules, a portrait and preserves the rating", () => {
    const d = newDraft("quick"); Object.assign(d, {title:"Квики",alias:"Автор",summary:"Описание",adult:true});
    d.modules.forEach(m => {m.title=m.kind;m.body="Текст";});
    expect(() => payload(d)).toThrow("портрет");
    d.modules[1].image="YWJj";
    expect(payload(d)).toMatchObject({mode:"quick",adult:true});
    expect(payload(d).modules).toHaveLength(2);
    expect(payload(d)).not.toHaveProperty("inactiveModules");
  });
  it("preserves inactive story modules when switching formats and restores old drafts", () => {
    const story = ready();
    const quick = switchMode(story,"quick");
    expect(quick.modules.map(m => m.kind)).toEqual(["prompt","lead"]);
    const restored = switchMode(quick,"story");
    expect(restored.modules).toEqual(story.modules);
    const {mode,adult,...old} = story;
    expect(draftSchema.parse(old)).toMatchObject({mode:"story",adult:false});
  });
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
