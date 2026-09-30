# Telegram Mini App SDK

`telegram-web-app.js` is an unmodified copy fetched on 2026-09-30 from
https://telegram.org/js/telegram-web-app.js.

SHA-256: `3549138a7934039fe7dfd1291a4ee739bd2b705a614308053a8b08a87d85c451`.

The catalog serves the official SDK from its own origin so opening a Mini App
does not require a blocking connection to telegram.org. The script is deferred;
React signals `ready()` and `expand()` both for an already loaded SDK and on its
load event. Keep the SDK unchanged; refresh deliberately from the official URL,
record its date/hash here, run the launch tests and verify the deployed app.
