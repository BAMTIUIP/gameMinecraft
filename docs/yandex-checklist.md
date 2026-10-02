# Чек-лист интеграции с Яндекс Играми

Работа идёт по списку документации: **одна ссылка → реализация → проверка → коммит**.
В таблице — что именно сделано по каждой странице и где это лежит в коде.

Легенда: ✅ сделано и проверено · 🟡 частично / требует ручной проверки в Консоли · ⬜ ещё не взято в работу

## SDK

| Ссылка | Что требуется | Где в коде | Статус |
| --- | --- | --- | --- |
| [sdk-about](https://yandex.ru/dev/games/doc/ru/sdk/sdk-about) | Подключение `<script src="/sdk.js">` в `<head>` выше кода игры, `YaGames.init()` один раз, никаких вызовов до `init()` | `index.html`, `src/main.tsx`, `src/game/yandex.ts`; проверка наличия и порядка тега — `scripts/package-yandex.mjs` | ✅ |
| [sdk-game-events](https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events) | `LoadingAPI.ready()` когда игрок реально может играть; `GameplayAPI.start()/stop()` на каждый старт/паузу/возврат | `src/App.tsx` (эффект по `hud.phase`), `yaOnPause`/`yaOnResume` в `src/game/yandex.ts` | ✅ |
| [sdk-player](https://yandex.ru/dev/games/doc/ru/sdk/sdk-player) | `getPlayer()`, авторизация, облачные сохранения (`setData`/`getData`), статистика (`setStats`/`incrementStats`), ник и аватар, `safeStorage` | `src/game/yandex.ts`, `src/game/profile.ts`, `src/game/storage.ts`, карточка профиля в `src/ui/Screens.tsx` | ✅ |
| [sdk-config](https://yandex.ru/dev/games/doc/ru/sdk/sdk-config) | `ysdk.getFlags()` один раз на старте, `defaultFlags` с локальной конфигурацией, `clientFeatures` из данных игрока, приоритет remote → кэш → локальные | `src/game/flags.ts`, вызов в `src/App.tsx`, применение флагов в `src/ui/Screens.tsx`, `src/ui/Hud.tsx` | ✅ |
| [sdk-adv](https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv) | | | ⬜ |
| [sdk-purchases](https://yandex.ru/dev/games/doc/ru/sdk/sdk-purchases) | | | ⬜ |
| [sdk-leaderboard](https://yandex.ru/dev/games/doc/ru/sdk/sdk-leaderboard) | | | ⬜ |
| [sdk-multiplayer-sessions](https://yandex.ru/dev/games/doc/ru/sdk/sdk-multiplayer-sessions) | Кооператив до 5 игроков в режиме выживания | | ⬜ |
| [sdk-review](https://yandex.ru/dev/games/doc/ru/sdk/sdk-review) | | | ⬜ |
| [sdk-shortcut](https://yandex.ru/dev/games/doc/ru/sdk/sdk-shortcut) | | | ⬜ |
| [sdk-environment](https://yandex.ru/dev/games/doc/ru/sdk/sdk-environment) | | | ⬜ |
| [sdk-server-time](https://yandex.ru/dev/games/doc/ru/sdk/sdk-server-time) | | | ⬜ |
| [sdk-events](https://yandex.ru/dev/games/doc/ru/sdk/sdk-events) | | | ⬜ |
| [sdk-params](https://yandex.ru/dev/games/doc/ru/sdk/sdk-params) | | | ⬜ |
| [sdk-example](https://yandex.ru/dev/games/doc/ru/sdk/sdk-example) | | | ⬜ |

## Правила и рекомендации

| Ссылка | Что требуется | Где в коде | Статус |
| --- | --- | --- | --- |
| [1/3](https://yandex.ru/dev/games/doc/ru/requirements/1/3) | | | ⬜ |
| [1/6](https://yandex.ru/dev/games/doc/ru/requirements/1/6) | | | ⬜ |
| [1/6/3](https://yandex.ru/dev/games/doc/ru/requirements/1/6/3) | | | ⬜ |
| [1/9](https://yandex.ru/dev/games/doc/ru/requirements/1/9) | | | ⬜ |
| [1/10](https://yandex.ru/dev/games/doc/ru/requirements/1/10) | | | ⬜ |
| [1/13](https://yandex.ru/dev/games/doc/ru/requirements/1/13) | | | ⬜ |
| [1/14](https://yandex.ru/dev/games/doc/ru/requirements/1/14) | | | ⬜ |
| [1/15](https://yandex.ru/dev/games/doc/ru/requirements/1/15) | | | ⬜ |
| [1/19](https://yandex.ru/dev/games/doc/ru/requirements/1/19) | | | ⬜ |
| [2/4](https://yandex.ru/dev/games/doc/ru/requirements/2/4) | | | ⬜ |
| [2/7](https://yandex.ru/dev/games/doc/ru/requirements/2/7) | | | ⬜ |
| [2/9](https://yandex.ru/dev/games/doc/ru/requirements/2/9) | | | ⬜ |
| [2/14](https://yandex.ru/dev/games/doc/ru/requirements/2/14) | | | ⬜ |
| [4/4](https://yandex.ru/dev/games/doc/ru/requirements/4/4) | | | ⬜ |
| [5/1/1/2](https://yandex.ru/dev/games/doc/ru/requirements/5/1/1/2) | | | ⬜ |
| [5/1/3](https://yandex.ru/dev/games/doc/ru/requirements/5/1/3) | | | ⬜ |
| [8/2/3](https://yandex.ru/dev/games/doc/ru/requirements/8/2/3) | | | ⬜ |
| [8/3/4](https://yandex.ru/dev/games/doc/ru/requirements/8/3/4) | | | ⬜ |
| [8/3/5](https://yandex.ru/dev/games/doc/ru/requirements/8/3/5) | | | ⬜ |
| [8/3/6](https://yandex.ru/dev/games/doc/ru/requirements/8/3/6) | | | ⬜ |

## Как проверяется

| Команда | Что проверяет |
| --- | --- |
| `npm run build` | сборка игры одним файлом `dist/index.html` |
| `npm run yandex:check` | требования к архиву: размер, имена файлов, `index.html` в корне, подключение `/sdk.js` выше кода игры |
| `npm run test:profile` | юнит-тесты облачного прогресса на мок-SDK (лимиты, батчинг, слияние с облаком) |
| `npm run yandex:sdk-check` | живые вызовы SDK в headless-браузере с подменённым `/sdk.js`: последовательность `init → LoadingAPI.ready → GameplayAPI.start/stop`, чтение и запись облачных данных |
