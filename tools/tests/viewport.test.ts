/**
 * Requirement 1.10 — «Корректное отображение» (https://yandex.ru/dev/games/doc/ru/requirements/1/10).
 *
 * Two parts of the page can only be checked in a real browser (cut/overlap of the UI and the missing
 * page scrollbar — that is `scenarioLayout` in tools/yandex-sdk-check/run.mjs), but the gesture guard
 * and the layout rules are checked here:
 *  - the page never scrolls itself and never pulls to refresh: `overflow: hidden` + `overscroll-behavior:
 *    none` + `100dvh` + `touch-action: none` on the canvas (CSS scan);
 *  - iOS Safari ignores `overscroll-behavior`, so `lockViewport()` arms a non-passive `touchmove`
 *    listener: a plain swipe is swallowed, while a swipe inside the game's own scrollable panel (the
 *    shop list, a long menu) is left alone — the docs allow the game to scroll its own content;
 *  - pinch-zoom gestures are swallowed as well.
 * Bundled with esbuild and executed by tools/tests/run.mjs (`npm run test:profile`).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { existsSync } from 'node:fs';

// bundled into a temporary directory: the repository root is found from the working directory
function findRoot(start: string): string {
  let dir = path.resolve(start);
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(path.join(dir, 'package.json')) && existsSync(path.join(dir, 'src'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`repository root not found from ${start}`);
}

const root = findRoot(process.cwd());

/* ------------------------------- DOM stubs ------------------------------- */

type Listener = { fn: (event: unknown) => void; options?: unknown };

const listeners = new Map<string, Listener[]>();
const styleOf = new Map<object, Record<string, string>>();

class FakeElement {
  parentElement: FakeElement | null = null;
  style: Record<string, string> = {};
  scrollHeight = 0;
  clientHeight = 0;
  scrollWidth = 0;
  clientWidth = 0;
}

type FakeNode = FakeElement;

function makeNode(overrides: Partial<FakeNode> = {}): FakeNode {
  return Object.assign(new FakeElement(), overrides);
}

const bodyNode = makeNode();
const htmlNode = makeNode();
const documentStub = {
  documentElement: htmlNode as unknown as HTMLElement,
  body: bodyNode as unknown as HTMLElement,
  addEventListener: (event: string, fn: (e: unknown) => void, options?: unknown) => {
    listeners.set(event, [...(listeners.get(event) ?? []), { fn, options }]);
  },
  removeEventListener: (event: string, fn: (e: unknown) => void) => {
    listeners.set(event, (listeners.get(event) ?? []).filter((item) => item.fn !== fn));
  },
};

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
g.document = documentStub;
g.Element = FakeElement; // so `target instanceof Element` works with the fake nodes
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });
g.getComputedStyle = (el: FakeNode) => ({
  visibility: 'visible',
  display: 'block',
  overflowY: el.style.overflowY ?? 'visible',
  overflowX: el.style.overflowX ?? 'visible',
});

/* --------------------------------- test ---------------------------------- */

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

const { blocksTouchGesture, lockViewport, scrollableAncestor } = await import('../../src/game/viewport');

/* ---- 1. the rule: swallow the swipe unless something under the finger can scroll ---- */

const page = makeNode();
const toolbar = makeNode({ parentElement: page });
const plainButton = makeNode({ parentElement: toolbar });
ok(scrollableAncestor(plainButton as unknown as EventTarget) === null, 'Обычная кнопка не считается прокручиваемой');
ok(blocksTouchGesture(plainButton as unknown as EventTarget, 1) === true, 'Свайп по кнопке гасится: страница не перезагружается');

const shopList = makeNode({ parentElement: page, style: { overflowY: 'auto' }, scrollHeight: 900, clientHeight: 300 });
const row = makeNode({ parentElement: shopList });
ok(scrollableAncestor(row as unknown as EventTarget) === shopList, 'Находится игровая панель с собственной прокруткой');
ok(blocksTouchGesture(row as unknown as EventTarget, 1) === false, 'Внутри игровой панели свайп не гасится — панель прокручивается сама');

const shortList = makeNode({ parentElement: page, style: { overflowY: 'auto' }, scrollHeight: 300, clientHeight: 300 });
const shortRow = makeNode({ parentElement: shortList });
ok(scrollableAncestor(shortRow as unknown as EventTarget) === null, 'Панель без прокрутки (всё влезло) не считается прокручиваемой');

const wideList = makeNode({ parentElement: page, style: { overflowX: 'scroll' }, scrollWidth: 1200, clientWidth: 400 });
const wideRow = makeNode({ parentElement: wideList });
ok(scrollableAncestor(wideRow as unknown as EventTarget) === wideList, 'Горизонтальная прокрутка тоже уважается');

ok(blocksTouchGesture(plainButton as unknown as EventTarget, 2) === true, 'Жест двумя пальцами (масштабирование) гасится всегда');
ok(blocksTouchGesture(row as unknown as EventTarget, 2) === true, 'Даже внутри панели щипок не проходит');

/* ---- 2. arming the guard ---- */

const dispose = lockViewport();
ok(htmlNode.style.overscrollBehavior === 'none', 'Прокрутка страницы отключается на html (overscroll-behavior)');
ok(bodyNode.style.overscrollBehavior === 'none', 'И на body');
ok((listeners.get('touchmove') ?? []).length === 1, 'Слушатель touchmove установлен один');
ok((listeners.get('contextmenu') ?? []).length === 1, 'Контекстное меню отключается на всей странице игры');
ok((listeners.get('touchmove') ?? [])[0]?.options === undefined || JSON.stringify((listeners.get('touchmove') ?? [])[0]?.options) === '{"passive":false}', 'Слушатель не passive — preventDefault сработает', JSON.stringify((listeners.get('touchmove') ?? [])[0]?.options));

const fire = (event: string, payload: Record<string, unknown>) => {
  let prevented = false;
  const full = { preventDefault: () => void (prevented = true), ...payload };
  for (const item of listeners.get(event) ?? []) item.fn(full);
  return prevented;
};

ok(
  fire('touchmove', { target: plainButton, touches: [{}, {}] }) && fire('touchmove', { target: plainButton, touches: [{}] }),
  'Свайп по странице гасится в самом обработчике',
);
ok(!fire('touchmove', { target: row, touches: [{}] }), 'Свайп внутри игровой панели не гасится и там работает своя прокрутка');
ok(fire('gesturestart', {}) && fire('gesturechange', {}), 'Жесты масштабирования Safari гасятся');
ok(fire('contextmenu', {}), 'Контекстное меню предотвращается на всей странице');

dispose();
ok((listeners.get('touchmove') ?? []).length === 0, 'Отключение снимает обработчик touchmove');
ok((listeners.get('contextmenu') ?? []).length === 0, 'Отключение снимает обработчик contextmenu');

/* ---- 3. the layout rules in the sources ---- */

const css = readFileSync(path.join(root, 'src/index.css'), 'utf8');
ok(/html,\s*body,\s*#root\s*\{[^}]*overflow:\s*hidden/s.test(css), 'Страница не прокручивается: overflow: hidden на html/body/#root');
ok(/overscroll-behavior:\s*none/.test(css), 'Swipe-to-refresh выключен в CSS (overscroll-behavior: none)');
ok(/height:\s*100dvh/.test(css), 'Высота считается в dvh — мобильная адресная строка не обрезает интерфейс');
ok(/canvas\s*\{[^}]*touch-action:\s*none/s.test(css), 'На игровом поле жесты прокрутки и масштаба запрещены (touch-action: none)');
ok(/-webkit-touch-callout:\s*none/.test(css), 'Долгое нажатие не открывает системный iOS callout');

const main = readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
ok(/lockViewport\(\)/.test(main), 'Защита от свайпа включается при запуске игры');

const engine = readFileSync(path.join(root, 'src/game/engine.ts'), 'utf8');
ok(/clientWidth \|\| window\.innerWidth/.test(engine) && /renderer\.setSize/.test(engine), 'Canvas подстраивается под текущий размер окна (и при изменении размера тоже)');

const screens = readFileSync(path.join(root, 'src/ui/Screens.tsx'), 'utf8');
ok((screens.match(/<FitBox/g) ?? []).length >= 2, 'Стартовое меню и экран итогов ужимаются под окно (FitBox)');
const fitBox = readFileSync(path.join(root, 'src/ui/FitBox.tsx'), 'utf8');
ok(/outer\.classList\.contains\('menu-fitbox'\)[\s\S]*min-width: 640px[\s\S]*max-height: 520px/.test(fitBox), 'Короткое альбомное меню шириной от 640px сохраняет сенсорные кнопки без масштабирующего FitBox');
ok(/menu-daily[^`]*min-h-\[54px\]/s.test(screens), 'Кнопка дневной награды имеет высоту touch target не меньше 44px');
ok((screens.match(/h-9 min-h-\[54px\] min-w-\[84px\]/g) ?? []).length >= 2, 'Кнопки покупки в меню и магазине имеют touch target не меньше 44px');
ok(/inline-flex min-h-\[54px\] max-w-full/.test(screens), 'Кнопка отключения рекламы имеет touch target не меньше 44px');
ok(/notch min-h-\[54px\] flex-1 px-2 py-1/.test(screens), 'Вкладки лидерборда имеют touch target не меньше 44px');
ok(/menu-grid/.test(screens) && /menu-aside/.test(screens), 'Меню помечено классами адаптивной раскладки');
ok(/menu-guide/.test(screens), 'Подсказки в меню помечены и уступают место на узких экранах (menu-guide)');
ok(/menu-fitbox/.test(screens) && /\.menu-fitbox\s*\{[^}]*padding-block:\s*0\.375rem/s.test(readFileSync(path.join(root, 'src/index.css'), 'utf8')), 'На коротком альбомном экране внешний отступ FitBox уменьшается вместо сжатия кнопок');

const layoutCss = readFileSync(path.join(root, 'src/index.css'), 'utf8');
ok(/\.hotbar-row\s*\{[^}]*width:\s*min\(/s.test(layoutCss), 'Хотбар занимает доступную ширину (десять слотов не вылезают за экран)');
ok(/\.hotbar-cell\s*\{[^}]*flex:/s.test(layoutCss) && /aspect-ratio:\s*1/.test(layoutCss), 'Слоты хотбара делят ширину и остаются квадратными');
ok(/orientation:\s*landscape/.test(layoutCss) && /max-height:\s*520px/.test(layoutCss), 'Для телефона в альбомной ориентации есть компактная раскладка');
ok(/orientation:\s*landscape\) and \(max-height:\s*560px/.test(layoutCss) && /hud-vitals-coordinates[\s\S]*hud-information--fps \{ display: none/s.test(layoutCss), 'В коротком альбомном окне вторичные показатели скрываются ради здоровья и миссии');
ok(/hud-objective-row--locked/.test(layoutCss) && /hud-objective-reward/.test(layoutCss) && /hud-objective-progress/.test(layoutCss), 'Короткая панель миссий сохраняет текущую цель без наград и прогресс-бара');
ok(/max-width:\s*700px/.test(layoutCss), 'Для узких экранов есть своя раскладка');
ok(/@media \(orientation: portrait\)[\s\S]*\.hud-touch \.hud-hotbar[\s\S]*flex-direction: column-reverse/.test(layoutCss), 'На сенсорном телефоне в портрете хотбар выстраивается слева, слот 1 остаётся снизу');
ok(/@media \(orientation: landscape\)[\s\S]*\.hud-touch \.hud-hotbar[\s\S]*width: min\(calc\(100vw - 23rem\)/.test(layoutCss), 'В альбомной ориентации хотбар занимает центральный ряд между сенсорными блоками');
ok(/\.shop-dialog[\s\S]*height: min\(92dvh/.test(layoutCss) && /\.shop-catalog[\s\S]*flex: 1 1 0[\s\S]*overflow: hidden/.test(layoutCss) && /\.shop-carousel[\s\S]*scroll-snap-type: x mandatory[\s\S]*touch-action: pan-x/.test(layoutCss) && /\.shop-category-button/.test(layoutCss), 'Магазин держит категории снизу и листает карточки по горизонтали');
ok(/\.shop-dialog \.shop-quick-banner \{ display: none; \}/.test(layoutCss), 'В коротком альбомном магазине убран дублирующий быстрый товар, чтобы карточки не схлопывались');
ok(/carousel\.scrollTo\(\{ left, behavior: 'auto' \}\)/.test(screens), 'Стрелка каталога листает карточки без зависящей от WebView анимации');

const inventory = readFileSync(path.join(root, 'src/ui/Inventory.tsx'), 'utf8');
ok(/recipe-card[^`]*flex-wrap/.test(inventory) && /recipe-costs[^`]*flex-wrap/.test(inventory) && /recipe-craft/.test(inventory), 'Карточки крафта переносят ресурсы и кнопку на узкой ширине');

const fit = readFileSync(path.join(root, 'src/ui/FitBox.tsx'), 'utf8');
ok(/MIN_SCALE/.test(fit) && /ResizeObserver/.test(fit), 'FitBox пересчитывает масштаб при изменении размера окна');
ok(/scrollTop = 0/.test(fit), 'После пересчёта прокрутка возвращается к началу меню');

const hud = readFileSync(path.join(root, 'src/ui/Hud.tsx'), 'utf8');
ok(!/h-10 w-10/.test(hud), 'Фиксированные размеры слотов хотбара убраны');
ok(/hud-information--top-left/.test(hud) && /hud-objective-panel/.test(hud), 'Панель миссий привязана к блоку здоровья и координат');
ok(/hud-information--top-right/.test(hud) && /hud-information--top-center/.test(hud), 'Информация HUD размечена отдельными зонами для адаптивного масштаба');
ok(/gameover-primary-actions/.test(readFileSync(path.join(root, 'src/ui/Screens.tsx'), 'utf8')), 'Кнопки экрана смерти собраны в симметричную сетку');
ok(/scale:\s*var\(--hud-information-scale\)/.test(css) && /\.hud-touch \.hud-information--top-left/.test(css), 'На телефоне масштабируется информация HUD, а не сенсорное управление');
ok(/\.gameover-primary-actions/.test(css) && /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/.test(css), 'Основные кнопки экрана смерти имеют одинаковые колонки');

const html = readFileSync(path.join(root, 'index.html'), 'utf8');
ok(/viewport-fit=cover/.test(html), 'Метатег учитывает вырезы экрана (viewport-fit=cover)');
ok(/user-scalable=no/.test(html) && /maximum-scale=1\.0/.test(html), 'Масштабирование жестами запрещено метатегом');

export { passed, failures };
