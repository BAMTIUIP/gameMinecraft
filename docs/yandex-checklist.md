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
| [sdk-adv](https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv) | Полноэкранный блок по действию игрока (кулдаун 60 с + грейс-период), rewarded-видео с наградой в `onRewarded` (возрождение в забеге), стики-баннер через API только в меню, флаги `adv.*` | `src/game/ads.ts`, обёртки в `src/game/yandex.ts`, кнопки в `src/ui/Screens.tsx`, вызовы в `src/App.tsx` | ✅ |
| [sdk-purchases](https://yandex.ru/dev/games/doc/ru/sdk/sdk-purchases) | `getPayments()`, `purchase()`, `getCatalog()` (цена и иконка валюты только из каталога, п. 1.13.2), порядок «сохранить → `consumePurchase`», проверка незакрытых покупок на старте (п. 1.13.1), алмазы в облачном профиле | `src/game/shop.ts`, обёртки в `src/game/yandex.ts`, баланс в `src/game/profile.ts`, магазин и платное возрождение в `src/ui/Screens.tsx`, вызовы в `src/App.tsx` | ✅ |
| [sdk-leaderboard](https://yandex.ru/dev/games/doc/ru/sdk/sdk-leaderboard) | `ysdk.leaderboards` (без устаревшего `getLeaderboards()`), `setScore` только для авторизованных и с паузой 1 с, `getPlayerEntry` для места, `getEntries` с `quantityTop`/`quantityAround` в допустимых пределах, лимиты 20/5 мин и 60/5 мин, «Пользователь скрыт» | `src/game/leaderboard.ts`, обёртки в `src/game/yandex.ts`, вкладки рейтинга в `src/ui/Screens.tsx`, вызовы в `src/App.tsx`; лидерборд `orerush-best-score` заводится в Консоли | ✅ |
| [sdk-multiplayer-sessions](https://yandex.ru/dev/games/doc/ru/sdk/sdk-multiplayer-sessions) | Кооператив до 5 игроков в выживании: `sessions.init` с `count` и `meta`-диапазонами, `commit` разреженно (лимит 200 КБ на сессию), `push` по итогам смены, события `multiplayer-sessions-transaction`/`-finish`, запуск и пауза воспроизведения через `GameplayAPI` | `src/game/multiplayer.ts`, фигурки напарников и панель в `src/game/engine.ts`/`src/ui/Hud.tsx`, таблица отряда в `src/ui/Screens.tsx`, обёртки в `src/game/yandex.ts`, старт смены в `src/App.tsx` | ✅ |
| [sdk-review](https://yandex.ru/dev/games/doc/ru/sdk/sdk-review) | `feedback.canReview()` перед запросом (иначе «use canReview before requestReview»), `requestReview()` только по действию игрока и один раз за сессию, причины отказа не показываются, неделя тишины после показа диалога | `src/game/review.ts`, обёртки в `src/game/yandex.ts`, кнопка и благодарность в `src/ui/Screens.tsx`, вызовы в `src/App.tsx` | ✅ |
| [sdk-shortcut](https://yandex.ru/dev/games/doc/ru/sdk/sdk-shortcut) | `shortcut.canShowPrompt()` перед кнопкой, `showPrompt()` по действию игрока, награда за `outcome: 'accepted'` один раз, две недели тишины после показа окна | `src/game/shortcut.ts`, обёртки в `src/game/yandex.ts`, кнопка в настройках `src/ui/Screens.tsx`, вызовы в `src/App.tsx` | ✅ |
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
| `npm run test:profile` | юнит-тесты на мок-SDK: облачный прогресс (лимиты, батчинг, слияние), флаги, реклама (кулдаун, награда, выключенные флаги, работа вне Яндекса), покупки (каталог, отмена, порядок «начислить → сохранить → погасить», повторная выдача без дубля), лидерборды (лимиты, кэш, скрытый профиль, формат счёта, отправка без авторизации) |
| `npm run yandex:sdk-check` | живые вызовы SDK в headless-браузере с подменённым `/sdk.js`: `init → LoadingAPI.ready → GameplayAPI.start/stop`, облачные данные, флаги, полный цикл рекламы (забег → итоги → rewarded → возврат), магазин (каталог, покупка, алмазы, платное возрождение, выдача незакрытой покупки на старте) и лидерборды (топ по вкладке, `setScore` за забег, место на экране итогов), а также кооператив (загрузка сессий, транзакции соперников в панели отряда, отметка о финише) оценка игры (кнопка после canReview, диалог по клику, повтор не предлагается) и ярлык (кнопка после canShowPrompt, окно по клику, начисление алмазов) |
