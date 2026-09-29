# Каталог историй SimpleDeepseekBot

Отдельный репозиторий каталога, расположенный внутри рабочего проекта бота
для совместной работы в одном чате.

- Рабочая папка: `E:\GIT\SimpleDeepseekBot\catalog`.
- Родительский репозиторий исключает `/catalog/` через `.gitignore`.
- У каталога своя история Git; это не submodule.
- GitHub-аккаунт для будущей публикации: `miroschnikovvladimir`.
- Репозиторий: https://github.com/miroschnikovvladimir/SimpleDeepseekCatalog.
- SSH origin: `git@github-miroschnikovvladimir:miroschnikovvladimir/SimpleDeepseekCatalog.git`.
- Адрес сайта: https://miroschnikovvladimir.github.io/SimpleDeepseekCatalog/.
- Интерфейс: React + TypeScript + Vite, статический `public/catalog.json`.
- В исходном каталоге нет историй, модулей и изображений.

Референс: https://github.com/miroschnikovvladimir/Catalog.
Это существующий каталог другого проекта, а не origin нового каталога.

Разбор его устройства и точек интеграции: [REFERENCE.md](REFERENCE.md).

Локальные базы, ключи, присланные изображения и видео бота не являются
содержимым этого репозитория. Публикация историй будет отдельным явным действием.

## Разработка

```powershell
cd E:\GIT\SimpleDeepseekBot\catalog
npm ci
npm test
npm run build
npm run dev
```

`npm run build` создаёт `dist/`. Workflow `.github/workflows/pages.yml`
проверяет и публикует эту папку при push в `main`; источник Pages — GitHub Actions.
Относительные пути Vite позволяют размещать сайт в подпапке репозитория.
Cloudflare и API старого проекта не используются. Избранное хранится в браузере.

## Подключение бота

В приватном `.env` бота задать `CATALOG_URL=https://<account>.github.io/<repository>/`.
После перезапуска доступны `/catalog` и кнопка в меню. Mini App открывается
через reply-клавиатуру: этот способ поддерживает `Telegram.WebApp.sendData`.

Браузер передаёт только ID истории или набор ID модулей с названием сборки.
Бот загружает `<CATALOG_URL>/catalog.json`, проверяет выбранные записи и создаёт
отдельную историю в фазе выбора первого хода. Генерация при импорте не запускается.
Текст заготовки не принимается из браузера; текущая игра не перезаписывается.
Личные базы, медиа и авторские черновики не загружаются на Pages.

## Формат содержимого

Контракт: `src/catalog.ts`, версия 2. История ссылается на сеттинг, сюжет
и 1–20 персонажей. У модуля обязательны уникальный ID, тип, название и описание.
Описание входит в промпт игры. Все данные в `public/catalog.json` общедоступны.
Обложки необязательны. Размер JSON для импорта ботом — до 2 МиБ, собранного
промпта — до 60 000 символов. Идентификаторы: латинские буквы, цифры, `_`, `-`.

Исходники готовых историй — отдельные Markdown/JPEG-файлы в `public/templates/`.
`npm run build` собирает из них `public/catalog.json`; его не редактируют вручную.
Формат, версии и подготовка публикации: [TEMPLATE_FORMAT.md](TEMPLATE_FORMAT.md).

В боте работает `/builder`: личные модульные черновики с ИИ, картинки,
выгрузка файлов и пробная игра. Процесс будущих пользовательских заявок:
[UGC.md](UGC.md).
