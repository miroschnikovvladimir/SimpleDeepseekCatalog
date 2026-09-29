import { z } from "zod";

export const roles = { prompt: "Исходный промпт", setting: "Сеттинг", player: "Альтер-эго игрока", lead: "Второй главный герой", support: "Второстепенный персонаж", opening: "Стартовый сюжет" };
export type Kind = keyof typeof roles;
export const required: Kind[] = ["prompt", "setting", "player", "lead", "opening"];
const line = z.string().trim().min(1, "Заполни название или имя").max(80).refine(s => !/[\r\n\0]/.test(s), "Нужна одна строка");
export const draftSchema = z.object({
  requestId: z.string().uuid(), title: z.string().max(80), alias: z.string().max(80), summary: z.string().max(1000),
  modules: z.array(z.object({ id: z.string().uuid(), kind: z.enum(["prompt", "setting", "player", "lead", "support", "opening"]), title: z.string().max(80), body: z.string().max(12000), image: z.string().max(3 * 1024 * 1024).regex(/^[A-Za-z0-9+/]*={0,2}$/).nullable() })).min(5).max(23),
  receipt: z.number().int().positive().optional(),
});
export type Draft = z.infer<typeof draftSchema>;
export function newModule(kind: Kind) { return { id: crypto.randomUUID(), kind, title: ["player", "lead", "support"].includes(kind) ? "" : roles[kind], body: "", image: null as string | null }; }
export function newDraft(): Draft { return { requestId: crypto.randomUUID(), title: "", alias: "", summary: "", modules: required.map(newModule) }; }
export function payload(draft: Draft) {
  const title = line.parse(draft.title), alias = line.parse(draft.alias);
  const summary = z.string().trim().min(1, "Добавь аннотацию").max(1000).parse(draft.summary);
  const names = new Set<string>();
  for (const kind of required) if (draft.modules.filter(m => m.kind === kind).length !== 1) throw new Error("Нужен один модуль каждой основной роли.");
  for (const m of draft.modules) {
    line.parse(m.title);
    if (!m.body.trim() || m.body.includes("\0")) throw new Error(`Заполни: ${roles[m.kind]}.`);
    if (["player", "lead", "support"].includes(m.kind)) {
      const name = m.title.trim().normalize("NFC").toLocaleLowerCase();
      if (names.has(name)) throw new Error("У персонажей должны быть разные имена.");
      names.add(name);
    }
  }
  if (draft.modules.reduce((n, m) => n + [...m.body].length, 0) > 60000) throw new Error("Сократи историю до 60 000 символов.");
  return { title, alias, summary, consent: true, modules: draft.modules.map(({ kind, title, body, image }) => ({ kind, title: title.trim(), body: body.trim(), image })) };
}

// Images and text are local until the explicit submission, including across reloads.
export async function draftDB(value?: Draft): Promise<Draft | undefined> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("story-submission-v1", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("drafts");
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("drafts", value ? "readwrite" : "readonly");
      const r = value ? tx.objectStore("drafts").put(value, "current") : tx.objectStore("drafts").get("current");
      tx.oncomplete = () => { try { resolve(value || (r.result ? draftSchema.parse(r.result) : undefined)); } catch (e) { reject(e); } };
      tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function prepareImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("Выбери JPEG, PNG или WebP до 10 МБ.");
  const bitmap = await createImageBitmap(file);
  try {
    if (Math.min(bitmap.width, bitmap.height) < 256 || bitmap.width * bitmap.height > 20_000_000) throw new Error("Картинка: от 256 × 256 до 20 мегапикселей.");
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    if (Math.min(canvas.width, canvas.height) < 256) throw new Error("Картинка слишком узкая. Выбери менее вытянутую.");
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encoded = canvas.toDataURL("image/jpeg", .9).split(",")[1];
    if (encoded.length > 2 * 1024 * 1024 * 4 / 3) throw new Error("Не удалось уменьшить картинку до 2 МБ.");
    return encoded;
  } finally { bitmap.close(); }
}
