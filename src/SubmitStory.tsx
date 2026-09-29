import { useEffect, useRef, useState } from "react";
import { draftDB, draftSchema, newDraft, newModule, payload, prepareImage, roles } from "./submission";
import type { Draft } from "./submission";
import { z } from "zod";

const hints = { prompt: "Правила повествования, стиль, ограничения и инструкции ведущему.", setting: "Мир, эпоха, места, атмосфера и правила, по которым всё устроено.", player: "Персонаж, которым управляет игрок: внешность, характер, прошлое и цель.", lead: "Второй главный герой или романтический интерес: характер, желания и отношения с игроком.", support: "Роль в сюжете, внешность, характер и связи с другими героями.", opening: "Откуда начинается игра: первая сцена, конфликт и отправная точка для игрока." };
const errorText = (e: unknown) => e instanceof z.ZodError ? e.issues[0].message : e instanceof Error ? e.message : "Не удалось выполнить действие.";

export function SubmitStory() {
  const [draft, setDraft] = useState<Draft>(newDraft);
  const [loaded, setLoaded] = useState(false), [saved, setSaved] = useState("Загружаем черновик…");
  const [preview, setPreview] = useState(false), [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false), [imageBusy, setImageBusy] = useState(false), [error, setError] = useState("");
  const [config, setConfig] = useState({ api_url: "", bot_url: "" });
  const top = useRef<HTMLHeadingElement>(null);
  const latest = useRef(draft); latest.current = draft;
  const initData = window.Telegram?.WebApp?.initData || "";
  useEffect(() => {
    let alive = true;
    draftDB().then(value => { if (alive && value) setDraft(value); }).catch(() => { if (alive) setError("Не удалось восстановить черновик. Скачивай резервную копию перед закрытием."); }).finally(() => { if (alive) setLoaded(true); });
    fetch(`${import.meta.env.BASE_URL}submission-config.json`, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => {
      const url = data.api_url ? new URL(data.api_url) : null;
      const api_url = url?.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash ? url.href.replace(/\/$/, "") : "";
      const bot_url = /^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=submit_story$/.test(data.bot_url) ? data.bot_url : "";
      if (alive) setConfig({ api_url, bot_url });
    }).catch(() => { if (alive) setError("Не удалось подключить отправку. Можно заполнить и сохранить черновик."); });
    window.Telegram?.WebApp?.enableClosingConfirmation?.();
    return () => { alive = false; window.Telegram?.WebApp?.disableClosingConfirmation?.(); };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    setSaved("Сохраняем…");
    // Start writes immediately; IndexedDB serializes them in transaction order.
    draftDB(draft).then(() => { if (alive) setSaved("Черновик сохранён на этом устройстве"); }).catch(() => { if (alive) setSaved("Не удалось сохранить: скачай черновик перед закрытием"); });
    return () => { alive = false; };
  }, [draft, loaded]);
  function change(value: Partial<Draft>) { setDraft(d => ({ ...d, ...value, requestId: crypto.randomUUID(), receipt: undefined })); setError(""); setConsent(false); }
  function moduleChange(id: string, value: Partial<Draft["modules"][number]>) { change({ modules: latest.current.modules.map(m => m.id === id ? { ...m, ...value } : m) }); }
  function review() {
    try { payload(draft); setError(""); setPreview(true); top.current?.scrollIntoView({ behavior: "smooth" }); }
    catch (e) { setError(errorText(e)); }
  }
  async function send() {
    if (busy || !consent || !initData || !config.api_url) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(config.api_url + "/ugc/submissions", { method: "POST", signal: AbortSignal.timeout(90000), headers: { "Content-Type": "application/json", Authorization: "tma " + initData, "Idempotency-Key": draft.requestId }, body: JSON.stringify(payload(draft)) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Сервис временно недоступен. Повтори отправку позже.");
      if (!Number.isSafeInteger(result?.submission_id) || result.submission_id < 1) throw new Error("Не удалось получить подтверждение. Повтори отправку: дубля не будет.");
      setDraft(d => ({ ...d, receipt: result.submission_id }));
      setPreview(false); top.current?.scrollIntoView({ behavior: "smooth" });
    } catch (e) { setError(e instanceof TypeError || (e instanceof DOMException && e.name === "TimeoutError") ? "Нет подтверждения от сервера. Черновик остался здесь — повтори отправку, дубля не будет." : errorText(e)); }
    finally { setBusy(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "story-draft.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 64 * 1024 * 1024) throw new Error("Черновик слишком большой.");
      const restored = draftSchema.parse(JSON.parse(await file.text()));
      if (!confirm("Заменить текущий черновик файлом?")) return;
      setDraft(restored); setPreview(false); setConsent(false); setError("");
    } catch (e) { setError(errorText(e)); }
  }
  async function image(id: string, file?: File) {
    if (!file) return;
    setImageBusy(true); setError("");
    try { moduleChange(id, { image: await prepareImage(file) }); }
    catch (e) { setError(errorText(e)); }
    finally { setImageBusy(false); }
  }
  const count = draft.modules.reduce((n, m) => n + [...m.body].length, 0);
  const supportCount = draft.modules.filter(m => m.kind === "support").length;
  return <main className="content-page submit-page">
    <a className="back-link" href="#/authors">← Авторам</a>
    <div className="submit-heading"><div><p className="eyebrow">Твоя история · твои правила</p><h1 ref={top}>Дай миру<br />первую страницу</h1></div><span className="submit-emblem" aria-hidden="true">✧</span></div>
    <p className="lead">Перенеси готовые тексты, познакомь нас с героями и добавь иллюстрации. После проверки история появится в каталоге.</p>
    {draft.receipt ? <section className="submit-success" role="status"><span aria-hidden="true">✓</span><h2>История отправлена</h2><p>Заявка №{draft.receipt}. Подтверждение и решение придут в Telegram. Статус — /submissions, редактирование сборки — /builder.</p><p className="muted">После одобрения история публикуется автоматически.</p><button className="primary-action" onClick={() => { setDraft(newDraft()); setConsent(false); }}>Создать другую историю</button></section> : <>
      {!initData && <aside className="submit-info"><strong>Отправка — из Telegram</strong><p>Открой эту форму через /submitstory в боте: так заявка будет связана с твоим аккаунтом. Здесь можно подготовить черновик, скачать его и открыть файлом в Telegram.</p>{config.bot_url && <a className="primary-action" href={config.bot_url}>Открыть в боте ↗</a>}</aside>}
      {!config.api_url && <p className="muted">Отправка пока подключается. Форму уже можно заполнить и сохранить.</p>}
      <div className="draft-tools"><span role="status">{saved}</span><button type="button" onClick={download} disabled={!loaded || busy}>Скачать черновик</button><label className="file-button">Открыть черновик<input aria-label="Открыть файл черновика" type="file" accept=".json,application/json" disabled={!loaded || busy} onChange={e => { void restore(e.target.files?.[0]); e.target.value = ""; }} /></label></div>
      {preview ? <section className="submission-preview"><p className="eyebrow">Предпросмотр публикации</p><h2>{draft.title}</h2><p className="author">{draft.alias}</p><p className="long-copy">{draft.summary}</p>{draft.modules.map(m => <article key={m.id}><p className="eyebrow">{roles[m.kind]}</p><h3>{m.title}</h3>{m.image && <img src={`data:image/jpeg;base64,${m.image}`} alt={m.title} />}<p className="long-copy">{m.body}</p></article>)}<label className="consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} /><span>У меня есть права на эти тексты и картинки. Я согласен на публикацию всех модулей, изображений и псевдонима в открытом каталоге и GitHub. После одобрения файлы можно будет копировать для игры.</span></label><p className="muted">В заявку входят только заполненные модули и выбранные картинки. Решение модератора придёт в бот.</p><div className="submit-actions"><button disabled={busy} onClick={() => { setPreview(false); setConsent(false); }}>← Исправить</button><button className="primary-action" disabled={!consent || busy || !initData || !config.api_url} onClick={() => void send()}>{busy ? "Отправляем…" : "Отправить на модерацию"}</button></div></section> : <form className="submission-form" onSubmit={e => { e.preventDefault(); review(); }}>
        <fieldset disabled={!loaded || imageBusy}><legend><span>01</span> Об истории</legend><p className="muted">Так история будет выглядеть в каталоге.</p><div className="form-columns"><label>Название<input required maxLength={80} value={draft.title} placeholder="Имя твоего мира" onChange={e => change({ title: e.target.value })} /></label><label>Псевдоним автора<input required maxLength={80} value={draft.alias} placeholder="Как тебя представить" onChange={e => change({ alias: e.target.value })} /></label></div><label>Аннотация<textarea required rows={4} maxLength={1000} value={draft.summary} placeholder="О чём эта история — без главных спойлеров" onChange={e => change({ summary: e.target.value })} /><small>{draft.summary.length} / 1 000</small></label></fieldset>
        {draft.modules.map((m, index) => <fieldset key={m.id} disabled={!loaded || imageBusy}><legend><span>{String(index + 2).padStart(2, "0")}</span> {roles[m.kind]}</legend><p className="muted">{hints[m.kind]}</p><label>{["player", "lead", "support"].includes(m.kind) ? "Имя персонажа" : "Название модуля"}<input required maxLength={80} value={m.title} onChange={e => moduleChange(m.id, { title: e.target.value })} /></label><label>{["player", "lead", "support"].includes(m.kind) ? "Анкета" : "Текст"}<textarea required rows={7} maxLength={12000} value={m.body} placeholder={hints[m.kind]} onChange={e => moduleChange(m.id, { body: e.target.value })} /><small>{[...m.body].length.toLocaleString("ru")} / 12 000 · можно использовать Markdown</small></label>{!["prompt", "opening"].includes(m.kind) && <div className="image-upload">{m.image && <img src={`data:image/jpeg;base64,${m.image}`} alt={`Иллюстрация: ${m.title || roles[m.kind]}`} />}<div><label className="file-button">{m.image ? "Заменить картинку" : "+ Добавить картинку"}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Картинка: ${roles[m.kind]}`} onChange={e => { void image(m.id, e.target.files?.[0]); e.target.value = ""; }} /></label><p className="muted">Необязательно · JPEG, PNG, WebP до 10 МБ<br />От 256 × 256 px. Уменьшим автоматически.</p>{m.image && <button type="button" onClick={() => moduleChange(m.id, { image: null })}>Убрать картинку</button>}</div></div>}{m.kind === "support" && <button type="button" className="remove-character" onClick={() => { if (confirm("Удалить этого персонажа из черновика?")) change({ modules: draft.modules.filter(item => item.id !== m.id) }); }}>Удалить персонажа</button>}</fieldset>)}
        <button type="button" className="add-character" disabled={supportCount >= 18 || imageBusy || !loaded} onClick={() => change({ modules: [...draft.modules.slice(0, -1), newModule("support"), draft.modules.at(-1)!] })}>+ Второстепенный персонаж <small>{supportCount} / 18</small></button>
        <div className="submit-actions"><p className={count > 60000 ? "form-error" : "muted"}>{count.toLocaleString("ru")} / 60 000 символов</p><button className="primary-action" disabled={!loaded || imageBusy || count > 60000}>{imageBusy ? "Обрабатываем картинку…" : "Проверить историю →"}</button></div>
      </form>}
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </main>;
}
