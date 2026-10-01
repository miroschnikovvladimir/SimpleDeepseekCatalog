import { z } from "zod";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const title = z.string().trim().min(1).max(100).refine(value => !/[\r\n\0]/.test(value));
const imageUrl = z.string().refine(value => /^https:\/\//.test(value) || /^(?:assets|templates)\/[a-zA-Z0-9_./-]+$/.test(value));
const image = z.object({ thumbnail: imageUrl, detail: imageUrl, width: z.number().positive(), height: z.number().positive(), alt: z.string(),
  variants: z.array(z.object({ url: imageUrl, width: z.number().int().positive() })).max(8).optional() });
const author = z.object({ name: z.string().max(100) }).default({ name: "Редакция" });
export const moduleSchema = z.object({
  id, type: z.enum(["setting", "plot", "character"]), title,
  role: z.enum(["prompt", "setting", "opening", "player", "lead", "support"]).optional(),
  mode: z.enum(["story", "quick"]).default("story"), adult: z.boolean().default(false),
  summary: z.string().max(1000).default(""), description: z.string().trim().min(1).max(24000),
  preview_description: z.string().trim().min(1).max(6000).optional(),
  image: image.nullable().default(null), tags: z.array(z.string().max(80)).max(30).default([]), author,
});
export const storySchema = z.object({
  id, title, summary: z.string().max(1000).default(""), cover: image.nullable().default(null),
  categories: z.array(z.string().max(80)).max(30).default([]), tags: z.array(z.string().max(80)).max(30).default([]),
  mode: z.enum(["story", "quick"]).default("story"), adult: z.boolean().default(false),
  author, setting_id: id.optional(), plot_id: id.optional(), prompt_id: id.optional(), lead_id: id.optional(), character_ids: z.array(id).min(1).max(20),
  template: z.object({ manifest: z.string().regex(/^templates\/[A-Za-z0-9_-]+\/r\d+\/manifest\.json$/), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).optional(),
});
export const catalogSchema = z.object({ version: z.literal(2), stories: z.array(storySchema).max(2000), modules: z.array(moduleSchema).max(10000) })
  .superRefine((data, ctx) => {
    const ids = [...data.stories, ...data.modules].map(item => item.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Повторяющиеся ID" });
    const modules = new Map(data.modules.map(item => [item.id, item]));
    for (const story of data.stories) {
      const badRoles = story.mode === "quick"
        ? !story.template || modules.get(story.prompt_id || "")?.role !== "prompt" || modules.get(story.lead_id || "")?.role !== "lead" || story.character_ids.length !== 1 || story.character_ids[0] !== story.lead_id
        : modules.get(story.setting_id || "")?.type !== "setting" || modules.get(story.plot_id || "")?.type !== "plot";
      if (badRoles ||
          new Set(story.character_ids).size !== story.character_ids.length || story.character_ids.some(key => modules.get(key)?.type !== "character")) {
        ctx.addIssue({ code: "custom", message: "Некорректный состав истории" });
      }
    }
  });
export type Catalog = z.infer<typeof catalogSchema>;
export type Story = z.infer<typeof storySchema>;
export type StoryModule = z.infer<typeof moduleSchema>;
export const labels = { setting: "Сеттинг", plot: "Сюжет", character: "Персонаж" };
export const FAVORITES_KEY = "simpledeepseek-catalog-favorites-v1";

export function visibleStories(data: Catalog, mode: "story" | "quick", showAdult: boolean) {
  return data.stories.filter(story => story.mode === mode && (showAdult || !story.adult));
}

export function readFavorites(): string[] {
  try { return z.array(id).max(10000).parse(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]")); }
  catch { return []; }
}

export function importPayload(data: Catalog, selection: { story_id: string } | { title: string; setting_id: string; plot_id: string; character_ids: string[] }) {
  if ("story_id" in selection) {
    if (!data.stories.some(story => story.id === selection.story_id)) throw new Error("История больше не доступна.");
    return { action: "catalog_import", version: 1, story_id: selection.story_id };
  }
  const selected = storySchema.parse({ id: "custom", ...selection });
  const modules = new Map(data.modules.map(item => [item.id, item]));
  if (modules.get(selected.setting_id || "")?.type !== "setting" || modules.get(selected.plot_id || "")?.type !== "plot" ||
      new Set(selected.character_ids).size !== selected.character_ids.length || selected.character_ids.some(id => modules.get(id)?.type !== "character")) {
    throw new Error("Проверь состав истории.");
  }
  return { action: "catalog_build", version: 1, title: selected.title, setting_id: selected.setting_id, plot_id: selected.plot_id, character_ids: selected.character_ids };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: { platform: string; initData?: string; ready(): void; expand(): void; sendData(data: string): void; enableClosingConfirmation?(): void; disableClosingConfirmation?(): void } };
  }
}
