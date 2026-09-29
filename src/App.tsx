import { SubmitStory } from "./SubmitStory";
import { useEffect, useState } from "react";
import { catalogSchema, FAVORITES_KEY, importPayload, labels, readFavorites } from "./catalog";
import type { Catalog, Story, StoryModule } from "./catalog";

function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="empty"><span className="empty-mark" aria-hidden="true">✧</span><h2>{title}</h2><p>{children}</p></section>;
}

export function App() {
  const [data, setData] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const [route, setRoute] = useState(location.hash.slice(2) || "catalog");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [favorites, setFavorites] = useState(readFavorites);
  const [notice, setNotice] = useState("");
  const [opened, setOpened] = useState<StoryModule | null>(null);
  const [selection, setSelection] = useState({ title: "", setting_id: "", plot_id: "", character_ids: [] as string[] });
  useEffect(() => {
    const change = () => { setRoute(location.hash.slice(2) || "catalog"); setOpened(null); setNotice(""); };
    window.addEventListener("hashchange", change);
    window.addEventListener("popstate", change);
    const abort = new AbortController();
    fetch(`${import.meta.env.BASE_URL}catalog.json`, { signal: abort.signal, cache: "no-cache" })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(value => setData(catalogSchema.parse(value)))
      .catch(() => { if (!abort.signal.aborted) setError("Не удалось загрузить каталог. Попробуй обновить страницу."); });
    return () => { abort.abort(); window.removeEventListener("hashchange", change); window.removeEventListener("popstate", change); };
  }, []);
  useEffect(() => {
    if (!opened) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpened(null); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [opened]);
  const toggle = (id: string) => {
    const next = favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id];
    setFavorites(next);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); }
    catch { setNotice("Сохранённое доступно до закрытия страницы: браузер ограничил хранилище."); }
  };
  const heart = (id: string) => <button type="button" className={`heart ${favorites.includes(id) ? "is-active" : ""}`} aria-pressed={favorites.includes(id)} aria-label={favorites.includes(id) ? "Убрать из сохранённого" : "Сохранить"} onClick={() => toggle(id)}>{favorites.includes(id) ? "♥" : "♡"}</button>;
  const send = (value: Parameters<typeof importPayload>[1]) => {
    const app = window.Telegram?.WebApp;
    if (!app || app.platform === "unknown") { setNotice("Открой каталог кнопкой в боте: команда /catalog."); return; }
    try { app.sendData(JSON.stringify(importPayload(data!, value))); }
    catch { setNotice("Не удалось передать выбор. Проверь состав истории и открой каталог заново через /catalog."); }
  };
  const picture = (image: Story["cover"], className: string, priority = false) => image
    ? <img className={`${className}${image.width > image.height ? " is-landscape" : ""}`} src={image.thumbnail}
      srcSet={image.variants?.map(v => `${v.url} ${v.width}w`).join(", ")}
      sizes={className === "dialog-image" ? "(min-width: 800px) 345px, (min-width: 500px) 440px, 90vw" : className === "module-image" ? image.width > image.height ? "(min-width: 800px) 340px, (min-width: 500px) 32vw, 90vw" : "(min-width: 800px) 340px, (min-width: 500px) 44vw, 32vw" : className === "story-cover" ? "(min-width: 800px) 460px, 90vw" : "(min-width: 800px) 350px, (min-width: 500px) 44vw, 90vw"}
      alt={image.alt} width={image.width} height={image.height} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" />
    : <div className={`${className} image-placeholder`} aria-hidden="true">✧</div>;
  const storyCard = (story: Story, index: number) => <article className="story-card" key={story.id}><div className="cover-wrap"><a href={`#/stories/${story.id}`}>{picture(story.cover, "cover-card", index === 0)}</a>{heart(story.id)}</div><a className="story-card-copy" href={`#/stories/${story.id}`}><p>{story.categories.join(" · ")}</p><h2>{story.title}</h2><span>{story.summary}</span></a><button className="primary-action card-play" onClick={() => send({ story_id: story.id })}>Играть</button></article>;
  const moduleCard = (item: StoryModule) => <article className="module-card" key={item.id}><button className={`module-open ${item.image ? "" : "without-image"}`} onClick={() => setOpened(item)}>{item.image && picture(item.image, "module-image")}<span className="module-copy"><span className="eyebrow">{labels[item.type]}</span><strong>{item.title}</strong><span>{item.summary}</span></span></button>{heart(item.id)}</article>;
  const stories = data?.stories.filter(story => (!category || story.categories.includes(category)) && [story.title, story.summary, ...story.tags, ...story.categories].join(" ").toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru"))) || [];
  const selectedStory = data?.stories.find(story => route === `stories/${story.id}`);
  const savedStories = data?.stories.filter(story => favorites.includes(story.id)) || [];
  const savedModules = data?.modules.filter(item => favorites.includes(item.id)) || [];
  const canBuild = ["setting", "plot", "character"].every(type => savedModules.some(item => item.type === type));
  return <div className="app-shell" onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#/"]');
    if (!link) return;
    event.preventDefault();
    history.pushState(null, "", link.hash);
    setRoute(link.hash.slice(2) || "catalog"); setOpened(null); setNotice("");
  }}>
    <header className="topbar"><a className="brand" href="#/catalog">Истории<span> ✧</span></a><nav aria-label="Каталог"><a href="#/catalog" aria-current={route === "catalog" ? "page" : undefined}>Каталог</a><a href="#/favorites" aria-current={route === "favorites" ? "page" : undefined}>Сохранённое</a><a href="#/builder" aria-current={route === "builder" ? "page" : undefined}>Конструктор</a><a href="#/authors" aria-current={route === "authors" ? "page" : undefined}>Авторам</a></nav></header>
    {notice && <p className="notice" role="status">{notice}</p>}
    {route === "submit" ? <SubmitStory /> : !data ? <main className="content-page"><Empty title={error ? "Каталог недоступен" : "Открываем каталог"}>{error || "Ещё немного…"}</Empty>{error && <button className="primary-action" onClick={() => location.reload()}>Обновить</button>}</main> : <>
      {route === "catalog" && <main className="catalog-page"><section className="catalog-tools"><div><p className="eyebrow">Миры · сюжеты · персонажи</p><h1>Твоя следующая<br />история</h1></div><label className="search"><span aria-hidden="true">⌕</span><input aria-label="Поиск историй" value={query} onChange={event => setQuery(event.target.value)} placeholder="Название, жанр или тег" /></label><div className="filters"><button className={!category ? "active" : ""} onClick={() => setCategory("")}>Все истории</button>{[...new Set(data.stories.flatMap(story => story.categories))].map(value => <button key={value} className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{value}</button>)}</div></section>
        {stories.length ? <section className="story-grid">{stories.map(storyCard)}</section> : <Empty title={data.stories.length ? "Ничего не нашлось" : "Первая история ещё впереди"}>{data.stories.length ? "Попробуй другое название, тег или категорию." : "Здесь появятся миры, сюжеты и персонажи, с которыми можно начать приключение в боте."}</Empty>}
      </main>}
      {route === "favorites" && <main className="content-page"><p className="eyebrow">Личная коллекция</p><h1>Сохранённое</h1><p className="lead">Твои истории и части для конструктора. Хранятся в этом браузере.</p>{!savedStories.length && !savedModules.length && <Empty title="Пока ничего не сохранено">Нажми на сердечко у истории или персонажа, чтобы вернуться к ним позже.</Empty>}<div className="story-grid">{savedStories.map(storyCard)}</div><div className="module-list">{savedModules.map(moduleCard)}</div></main>}
      {route === "builder" && <main className="content-page"><p className="eyebrow">Собери по-своему</p><h1>Конструктор</h1><p className="lead">Сочетай сохранённые сеттинги, сюжеты и персонажей.</p>{!canBuild ? <Empty title="Начни с коллекции">Для своей истории сохрани хотя бы один сеттинг, сюжет и персонажа из каталога.</Empty> : <form className="builder-form" onSubmit={event => { event.preventDefault(); send(selection); }}><label>Название истории<input required maxLength={100} value={selection.title} onChange={event => setSelection({ ...selection, title: event.target.value })} /></label>{(["setting", "plot"] as const).map(type => <label key={type}>{labels[type]}<select required value={selection[`${type}_id`]} onChange={event => setSelection({ ...selection, [`${type}_id`]: event.target.value })}><option value="">Выбери…</option>{savedModules.filter(item => item.type === type).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>)}<fieldset><legend>Персонажи</legend>{savedModules.filter(item => item.type === "character").map(item => <label className="check-row" key={item.id}><input type="checkbox" checked={selection.character_ids.includes(item.id)} onChange={event => setSelection({ ...selection, character_ids: event.target.checked ? [...selection.character_ids, item.id] : selection.character_ids.filter(id => id !== item.id) })} />{item.title}</label>)}</fieldset><button className="primary-action" disabled={!selection.character_ids.length || selection.character_ids.length > 20}>Начать в боте</button></form>}</main>}
      {route === "authors" && <main className="content-page author-page"><p className="eyebrow">Истории сообщества</p><h1>Место для<br />твоих миров</h1><p className="lead">Собери историю вместе с ИИ прямо в Telegram: команда /builder или «Собрать историю» в меню «Мои истории».</p><div className="hero-actions"><a className="primary-action" href="#/submit">✍ Отправить готовую историю</a></div><p className="muted">Уже всё написано? Заполни веб-форму, загрузи картинки и отправь на модерацию.</p><div className="author-steps"><article><span>01</span><h2>Создай</h2><p>Подготовь промпт, мир, альтер-эго, второго главного героя, других персонажей и завязку. Прикрепи картинки по желанию.</p></article><article><span>02</span><h2>Проверь</h2><p>Сохрани варианты, попробуй личную игру и нажми «Отправить в каталог». Укажи псевдоним и аннотацию, проверь публикуемые файлы.</p></article><article><span>03</span><h2>Поделись</h2><p>Отправь сборку на модерацию. Бот сообщит решение, а после одобрения и публикации пришлёт ссылку на историю.</p></article></div><p className="muted">Статус заявки — /submissions в боте. При отклонении придёт причина: исправь сборку и отправь новую версию. Переписка и прохождение остаются личными.</p></main>}
      {selectedStory && <main className="detail-page">
        <a className="back-link" href="#/catalog">← Каталог</a>
        <section className="story-hero">{picture(selectedStory.cover, "story-cover", true)}<div><p className="eyebrow">{selectedStory.categories.join(" · ")}</p><h1>{selectedStory.title}</h1><p className="lead">{selectedStory.summary}</p><p className="author">{selectedStory.author.name}</p><div className="hero-actions">{heart(selectedStory.id)}<button className="primary-action" onClick={() => send({ story_id: selectedStory.id })}>Играть</button></div></div></section>
        <div className="story-parts">
          <section><div className="section-heading"><h2>Мир истории</h2></div>{moduleCard(data.modules.find(m => m.id === selectedStory.setting_id)!)}</section>
          <section><div className="section-heading"><h2>Персонажи</h2></div><div className="character-grid">{selectedStory.character_ids.map(id => moduleCard(data.modules.find(m => m.id === id)!))}</div></section>
          <section><div className="section-heading"><h2>Начало приключения</h2></div>{moduleCard(data.modules.find(m => m.id === selectedStory.plot_id)!)}</section>
        </div>
      </main>}
      {!["catalog", "favorites", "builder", "authors"].includes(route) && !selectedStory && <main className="content-page"><Empty title="Страница не найдена">Возможно, история была снята с публикации.</Empty><a className="back-link" href="#/catalog">← В каталог</a></main>}
    </>}
    {opened && <div className="dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) setOpened(null); }}><article className={`dialog ${opened.image ? "" : "without-image"}`} role="dialog" aria-modal="true" aria-labelledby="module-title"><button autoFocus className="dialog-close" aria-label="Закрыть" onClick={() => setOpened(null)}>×</button>{opened.image && picture(opened.image, "dialog-image", true)}<div className="dialog-copy"><p className="eyebrow">{labels[opened.type]}</p><h2 id="module-title">{opened.title}</h2><p className="long-copy">{opened.preview_description || opened.description}</p>{heart(opened.id)}</div></article></div>}
  </div>;
}
