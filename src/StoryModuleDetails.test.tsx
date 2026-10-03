import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { moduleSchema } from "./catalog";
import { StoryModuleDetails } from "./StoryModuleDetails";

describe("story dossier descriptions", () => {
  it.each(["setting", "character", "plot"] as const)("shows the complete public %s description immediately without revealing the hidden game text", type => {
    const item = moduleSchema.parse({ id: type, type, title: "Название", summary: "Краткая аннотация", description: "Секретная развязка для модели", preview_description: "Мир и герои.\n\nЗавязка и главный конфликт.\n\nПоследний абзац." });
    const html = renderToStaticMarkup(<StoryModuleDetails item={item} image={null} action={null} />);
    expect(html).toContain("Мир и герои.");
    expect(html).toContain("Завязка и главный конфликт.");
    expect(html).toContain("Последний абзац.");
    expect(html).not.toContain("Секретная развязка для модели");
    expect(html).not.toContain("Краткая аннотация");
    expect(html).not.toMatch(/<button|<details|role="dialog"/);
  });

  it("also renders descriptions from the lightweight browse index without a preview field", () => {
    const item = moduleSchema.parse({ id: "legacy", type: "plot", title: "Начало", description: "Полное публичное описание из browse.json" });
    expect(renderToStaticMarkup(<StoryModuleDetails item={item} image={null} action={null} />)).toContain(item.description);
  });
});
