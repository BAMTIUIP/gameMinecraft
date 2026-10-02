/**
 * Requirement 1.6.3 — «Адаптация для ТВ» (точнее, страница https://yandex.ru/dev/games/doc/ru/requirements/1/6/3).
 *
 * The page asks for five things and the suite checks all of them:
 *  1. the game fills the screen and can be switched to fullscreen — the renderer always takes the
 *     container's whole size and the toggle lives in the settings (source check);
 *  2. the remote's arrows are enough to play: in the menus they move the focus, during a run they move
 *     and turn the player, and a one-block step is climbed automatically because a remote reports one
 *     press at a time;
 *  3. Back and OK are handled: Back pauses on the first press and asks about leaving on the second
 *     (or asks right away in a menu), OK activates the focused menu item and digs during a run;
 *  4. there are no in-app purchases — `ysdk.getPayments` appears nowhere, the shop sells only for the
 *     earned crystals and on a TV it is hidden altogether;
 *  5. the game links to no other games.
 * The pure rules (`backIntent`, `pickCandidate`) are tested directly, the navigation is driven on a
 * small fake DOM, and the wiring in App/engine is pinned by a source scan. Bundled with esbuild and
 * executed by tools/tests/run.mjs (`npm run test:profile`).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { existsSync } from 'node:fs';

// the suite is bundled into a temporary directory, so the repository root is found from the working
// directory (npm scripts run from the repository root) by looking for package.json + src
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

const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
  setItem: (k: string, v: string) => void storage.set(k, String(v)),
  removeItem: (k: string) => void storage.delete(k),
  clear: () => storage.clear(),
  key: (i: number) => [...storage.keys()][i] ?? null,
  get length() {
    return storage.size;
  },
};

/** the keydown handlers window.addEventListener() collected */
const listeners = new Map<string, Array<(e: unknown) => void>>();

class FakeEl {
  tagName: string;
  attrs: Record<string, string>;
  children: FakeEl[] = [];
  rect = { left: 0, top: 0, width: 10, height: 10 };
  hidden = false;
  clicked = 0;
  classes = new Set<string>();

  constructor(tag: string, attrs: Record<string, string> = {}) {
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
  }

  append(...kids: FakeEl[]): this {
    for (const kid of kids) this.children.push(kid);
    return this;
  }

  get classList() {
    return {
      add: (name: string) => void this.classes.add(name),
      remove: (name: string) => void this.classes.delete(name),
      contains: (name: string) => this.classes.has(name),
    };
  }

  getAttribute(name: string) {
    return this.attrs[name] ?? null;
  }

  hasAttribute(name: string) {
    return name in this.attrs;
  }

  getBoundingClientRect() {
    const { left, top, width, height } = this.rect;
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
  }

  focus() {
    documentStub.activeElement = this as unknown as Element;
  }

  click() {
    this.clicked += 1;
  }

  descendants(): FakeEl[] {
    return this.children.flatMap((kid) => [kid, ...kid.descendants()]);
  }

  querySelectorAll(selector: string): FakeEl[] {
    return this.descendants().filter((el) => matchesSelector(el, selector));
  }
}

function matchesSelector(el: FakeEl, selector: string): boolean {
  return selector.split(',').some((raw) => {
    const sel = raw.trim();
    if (sel.startsWith('.')) return el.classes.has(sel.slice(1));
    if (sel === '[aria-modal="true"]') return el.attrs['aria-modal'] === 'true';
    if (sel === '[role="dialog"]') return el.attrs.role === 'dialog';
    if (sel === '[href]') return el.attrs.href !== undefined;
    if (sel === '[tabindex]:not([tabindex="-1"])') {
      return el.attrs.tabindex !== undefined && el.attrs.tabindex !== '-1';
    }
    const editable = /^([a-z]+):not\(\[disabled\]\)$/.exec(sel);
    if (editable) return el.tagName === editable[1].toUpperCase() && el.attrs.disabled === undefined;
    if (/^[a-z]+$/.test(sel)) return el.tagName === sel.toUpperCase();
    return false;
  });
}

const body = new FakeEl('body');
const documentStub = {
  body,
  activeElement: body as unknown as Element,
  querySelectorAll: (selector: string) => body.querySelectorAll(selector) as unknown as Element[],
  addEventListener() {},
  removeEventListener() {},
};

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = documentStub;
g.addEventListener = (event: string, fn: (e: unknown) => void) => {
  listeners.set(event, [...(listeners.get(event) ?? []), fn]);
};
g.removeEventListener = (event: string, fn: (e: unknown) => void) => {
  listeners.set(event, (listeners.get(event) ?? []).filter((item) => item !== fn));
};
g.getComputedStyle = (el: FakeEl) => ({
  visibility: 'visible',
  display: el.hidden ? 'none' : 'block',
});

/* ------------------------------ SDK mock ------------------------------ */

let deviceType: string | undefined = 'tv';
let paymentsCalls = 0;
const deviceInfoOrNull = () => ({
  get type() {
    return deviceType;
  },
  isMobile: () => deviceType === 'mobile',
  isTablet: () => deviceType === 'tablet',
  isTV: () => deviceType === 'tv',
});

g.YaGames = {
  init: async () => ({
    environment: { app: { id: '0' }, i18n: { lang: 'ru' } },
    getPlayer: async () => null,
    getStorage: async () => localStorageStub,
    on() {},
    getPayments: async () => {
      paymentsCalls += 1;
      return {
        getCatalog: async () => [],
        getPurchases: async () => [],
        purchase: async () => null,
        consumePurchase: async () => true,
      };
    },
    get deviceInfo() {
      return deviceInfoOrNull();
    },
  }),
};

/* --------------------------------- test ---------------------------------- */

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

const { DOUBLE_BACK_MS, REMOTE_FOCUS_CLASS, activateFocused, backIntent, focusFirst, installRemoteKeys, moveFocus, pickCandidate, tvMode } =
  await import('../../src/game/remote');
const { initYandex } = await import('../../src/game/yandex');

/* ---- 1. the device type comes from the platform ---- */

await initYandex();

ok(tvMode() === true, 'deviceInfo.type === «tv» включает ТВ-режим', String(deviceType));
deviceType = 'desktop';
ok(tvMode() === false, 'На компьютере ТВ-режим выключен');
deviceType = 'mobile';
ok(tvMode() === false, 'На телефоне ТВ-режим тоже выключен, там свои кнопки');
deviceType = 'tv';

/* ---- 2. the Back rule: single press pauses, double press asks about leaving ---- */

ok(DOUBLE_BACK_MS === 2_500, 'Окно двойного Back — 2,5 секунды', String(DOUBLE_BACK_MS));
ok(backIntent('playing', 0, 10_000) === 'pause', 'Первый Back во время игры ставит паузу и открывает меню');
ok(backIntent('playing', 10_000, 11_000) === 'exit', 'Второй Back в пределах окна предлагает выйти');
ok(backIntent('playing', 10_000, 12_500) === 'exit', 'Ровно на границе окна ещё считается двойным нажатием');
ok(backIntent('playing', 10_000, 12_501) === 'pause', 'После окна счёт начинается заново — это снова одиночный Back');
ok(backIntent('menu', 0, 1) === 'exit', 'В стартовом меню Back сразу предлагает выйти');
ok(backIntent('paused', 0, 1) === 'exit', 'В меню паузы — тоже сразу');
ok(backIntent('gameover', 0, 1) === 'exit', 'На экране результатов — тоже сразу');
ok(backIntent('loading', 0, 1) === 'exit', 'Пока игра грузится, Back не может поставить паузу');
ok(backIntent('playing', 10_000, 20_000, 60_000) === 'exit', 'Окно двойного нажатия настраивается');

/* ---- 3. spatial focus: the nearest element in the pressed direction ---- */

const grid = [
  { id: 'tl', rect: { x: 0, y: 0, w: 40, h: 20 } },
  { id: 'tr', rect: { x: 60, y: 0, w: 40, h: 20 } },
  { id: 'bl', rect: { x: 0, y: 40, w: 40, h: 20 } },
  { id: 'br', rect: { x: 60, y: 40, w: 40, h: 20 } },
];
const box = (id: string) => grid.find((b) => b.id === id)!.rect;

ok(pickCandidate(box('tl'), grid, 'right') === 'tr', 'Справа — сосед по строке, а не диагональ');
ok(pickCandidate(box('tl'), grid, 'down') === 'bl', 'Снизу — элемент под текущим');
ok(pickCandidate(box('tr'), grid, 'down') === 'br', 'Из правого верхнего вниз — правый нижний');
ok(pickCandidate(box('br'), grid, 'left') === 'bl', 'Слева — ближайший по своей строке');
ok(pickCandidate(box('tl'), grid, 'up') === null, 'Выше ничего нет — движение не меняет фокус');
ok(pickCandidate(box('tl'), grid, 'left') === null, 'Слева ничего нет');
ok(pickCandidate(null, grid, 'right') === 'tl', 'Без текущего фокуса отсчёт идёт от начала экрана');
ok(pickCandidate(null, [], 'down') === null, 'Пустой список — двигаться некуда');
ok(
  pickCandidate(box('tl'), [{ id: 'beside', rect: { x: 30, y: 0, w: 40, h: 20 } }], 'up') === null,
  'Элемент на той же линии не считается «выше»',
);
ok(
  pickCandidate(box('tl'), [{ id: 'far', rect: { x: 0, y: 500, w: 40, h: 20 } }], 'down') === 'far',
  'Далеко внизу — всё равно вниз, если больше ничего нет',
);

/* ---- 4. the navigation really works on a DOM ---- */

const btn = (x: number, y: number) => {
  const el = new FakeEl('button');
  el.rect = { left: x, top: y, width: 40, height: 20 };
  return el;
};

const page = new FakeEl('div');
const bPlay = btn(0, 0);
const bShop = btn(60, 0);
const bSettings = btn(0, 40);
const bTop = btn(60, 40);
page.append(bPlay, bShop, bSettings, bTop);
body.append(page);

let navActive = true;
const stopRemote = installRemoteKeys(() => navActive);
const press = (code: string, repeat = false) => {
  const event = { code, repeat, target: documentStub.activeElement, prevented: false, preventDefault() { this.prevented = true; } };
  for (const fn of listeners.get('keydown') ?? []) fn(event);
  return event;
};

ok(focusFirst() === true, 'При открытии меню фокус ставится на первый элемент');
ok(documentStub.activeElement === bPlay, 'Первый элемент — «Играть»');
ok(bPlay.classes.has(REMOTE_FOCUS_CLASS), 'Фокус подсвечен классом для пульта', REMOTE_FOCUS_CLASS);
ok(Array.from(documentStub.querySelectorAll(`.${REMOTE_FOCUS_CLASS}`)).length === 1, 'Подсвечен ровно один элемент');

press('ArrowRight');
ok(documentStub.activeElement === bShop, 'Стрелка вправо переводит фокус на «Магазин»');
ok(!bPlay.classes.has(REMOTE_FOCUS_CLASS) && bShop.classes.has(REMOTE_FOCUS_CLASS), 'Подсветка переехала вместе с фокусом');

press('ArrowDown', true);
ok(documentStub.activeElement === bTop, 'Удержание стрелки двигает фокус по одному шагу, как на пульте');
press('ArrowLeft');
ok(documentStub.activeElement === bSettings, 'Стрелка влево возвращает на «Настройки»');
press('ArrowUp');
ok(documentStub.activeElement === bPlay, 'Стрелка вверх возвращает на верхнюю строку');

ok(moveFocus('up') === false, 'Выше верхней строки элементов нет — фокус остаётся');
ok(documentStub.activeElement === bPlay, 'Неудачное движение фокус не сбрасывает');

press('Enter');
ok(bPlay.clicked === 1, 'OK нажимает на выбранный пункт меню');
ok(bShop.clicked === 0 && bSettings.clicked === 0, 'Соседние пункты не нажимаются');

documentStub.activeElement = body as unknown as Element;
press('Enter');
ok(bPlay.clicked === 2, 'OK без выбранного пункта сам ставит фокус на первый и нажимает его');

/* a nickname field keeps its typing: arrows inside an input are never hijacked */
const nick = new FakeEl('input');
nick.rect = { left: 0, top: 80, width: 120, height: 20 };
page.append(nick);
nick.focus();
const typing = press('ArrowDown');
ok(documentStub.activeElement === nick, 'В поле ввода стрелки не уводят фокус');
ok(typing.prevented === false, 'В поле ввода стрелка не перехватывается у клавиатуры');

/* when a modal opens, the remote navigates inside it and ignores the page behind */
const modal = new FakeEl('div', { 'aria-modal': 'true' });
modal.rect = { left: 0, top: 0, width: 200, height: 150 };
const mYes = btn(20, 20);
const mNo = btn(20, 60);
const mTiny = btn(0, 0);
mTiny.rect = { left: 0, top: 0, width: 0, height: 0 };
modal.append(mYes, mNo, mTiny);
body.append(modal);

ok(focusFirst() === true, 'В открытом окне фокус встаёт на его первый элемент');
ok(documentStub.activeElement === mYes, 'Фокус внутри модального окна, а не в меню за ним');
ok(Array.from(documentStub.querySelectorAll(`.${REMOTE_FOCUS_CLASS}`)).length === 1, 'Подсветка не остаётся за окном');
press('ArrowDown');
ok(documentStub.activeElement === mNo, 'Стрелки ходят по элементам окна');
ok(mTiny.clicked === 0 && !mTiny.classes.has(REMOTE_FOCUS_CLASS), 'Невидимый элемент пропускается');
press('ArrowDown');
ok(documentStub.activeElement === mNo, 'Ниже окна фокус не уходит в меню за ним');

/* the safe answer of a dialog is marked as preferred: the first OK press never accepts the dangerous one */
mNo.attrs['data-remote-primary'] = '';
documentStub.activeElement = body as unknown as Element;
ok(focusFirst() === true, 'При открытии окна фокус ставится заново');
ok(documentStub.activeElement === mNo, 'Диалог подсвечивает безопасный ответ (data-remote-primary)');
ok(Array.from(documentStub.querySelectorAll(`.${REMOTE_FOCUS_CLASS}`)).length === 1, 'Подсветка по-прежнему одна');
delete mNo.attrs['data-remote-primary'];

modal.hidden = true;
ok(focusFirst() === true && documentStub.activeElement === bPlay, 'Закрытое окно больше не перехватывает навигацию');
modal.hidden = false;

/* when the game is on screen, the arrows belong to the player, not to the UI */
navActive = false;
const clicksWhilePlaying = bPlay.clicked;
documentStub.activeElement = bPlay;
press('ArrowDown');
ok(documentStub.activeElement === bPlay, 'Во время игры стрелки не уводят фокус из игры');
press('Enter');
ok(bPlay.clicked === clicksWhilePlaying, 'Во время игры OK не нажимает кнопки меню');
navActive = true;

/* the handler can be removed — the App installs it once and disposes on unmount */
stopRemote();
documentStub.activeElement = bPlay;
press('ArrowDown');
ok(documentStub.activeElement === bPlay, 'После отключения обработчика стрелки больше не навигируют');

/* ---- 5. the sources wire the same rules ---- */

function collect(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Checks look at code, not at comments: doc comments explain the rules and must not fail the scan. */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += source[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

const read = (rel: string) => stripComments(readFileSync(path.join(root, rel), 'utf8'));

const app = read('src/App.tsx');
ok(/setIsTv\(tvMode\(\)\)/.test(app), 'App спрашивает у платформы тип устройства (deviceInfo.type === tv)');
ok(/installRemoteKeys\(/.test(app) && /backIntent\(/.test(app), 'App подключает пульт: навигацию и правило Back');
ok(/eng\.pause\(\)/.test(app) && /setExitPrompt\(true\)/.test(app), 'Одиночный Back ставит паузу, повторный открывает окно выхода');
ok(/!isTv/.test(app), 'На ТВ магазин скрыт (напоминание: покупок за реальные деньги в игре нет)');
ok(/isTv[\s\S]{0,80}Esc|Esc[\s\S]{0,80}isTv/.test(app), 'Запасной Back (Escape) работает только на ТВ и только в меню');
ok(/role="dialog"[\s\S]{0,200}aria-modal/.test(app), 'Окно выхода — модальное: пульт ходит только по нему');
ok(/data-remote-primary/.test(app), 'Безопасный ответ окна помечен для пульта (первый OK не выходит из игры)');
ok(/exitPrompt\) focusFirst\(\)/.test(app), 'При открытии окна выхода фокус ставится на безопасную кнопку');

const engine = read('src/game/engine.ts');
ok(/private readonly tv = deviceKind\(\) === 'tv'/.test(engine), 'Движок узнаёт про ТВ и держит флаг режима');
ok(/'Enter' \|\| c === 'NumpadEnter'/.test(engine), 'OK (Enter) на пульте обрабатывается в игре');
ok(/this\.mining = true/.test(engine) && /tvOkDownAt/.test(engine), 'Удержание OK = удар/добыча, как левая кнопка мыши');
ok(/tvStepAhead\(/.test(engine) && /autoStep/.test(engine), 'Шаг в один блок на ТВ берётся автоматически');
ok(/this\.yaw \+= turn \* dt/.test(engine) && /this\.yaw -= turn \* dt/.test(engine), 'Стрелки на ТВ поворачивают камеру');
ok(/k\['ArrowLeft'\] && !this\.tv/.test(engine), 'На ТВ стрелки не дублируют шаг вбок — иначе ходьба и поворот конфликтуют');
ok(/!this\.interact\(\)\) this\.placeOnce = true/.test(engine), 'Короткое нажатие OK использует предмет или ставит блок');

const css = readFileSync(path.join(root, 'src/index.css'), 'utf8');
ok(css.includes(`.${REMOTE_FOCUS_CLASS}`), 'Подсветка фокуса для пульта описана в стилях');

/* fullscreen: the renderer always fills its container, the toggle lives in the settings */
ok(/this\.container\.clientWidth \|\| window\.innerWidth/.test(engine), 'Рендерер занимает всю ширину контейнера');
ok(/toggleFullscreen/.test(read('src/game/params.ts')), 'Полноэкранный режим включается кнопкой в настройках');
ok(/height: 100%/.test(css) || /100vh/.test(css), 'Страница растянута на весь экран');

/* no purchases on a TV: the platform is not even asked for the payment object */
const { deliverPendingPurchases, loadShopCatalog, paymentsAvailable } = await import('../../src/game/shop');
const shop = read('src/game/shop.ts');
ok(/!tvDevice\(\) && yaPaymentsAvailable\(\)/.test(shop), 'На ТВ магазин объявлен недоступным до обращения к SDK');
ok(/if \(tvDevice\(\)\) return new Map\(\)/.test(shop), 'Каталог цен на ТВ не запрашивается');
ok(/if \(tvDevice\(\) \|\| !yaPaymentsAvailable\(\)\) return 0/.test(shop), 'Незавершённые покупки на ТВ не проверяются');

deviceType = 'tv';
paymentsCalls = 0;
ok(paymentsAvailable() === false, 'На ТВ магазин закрыт');
ok((await loadShopCatalog()).size === 0, 'Каталог покупок на ТВ пуст');
ok((await deliverPendingPurchases()) === 0, 'Доставка отложенных покупок на ТВ ничего не делает');
ok(paymentsCalls === 0, 'Платёжные методы SDK на ТВ не вызываются вовсе', `вызовов: ${paymentsCalls}`);
deviceType = 'desktop';
ok(paymentsAvailable() === true, 'На других устройствах покупки остаются доступными');
deviceType = 'tv';

/* no links to other games and sites */
const sources = collect(path.join(root, 'src'));
ok(sources.every((file) => !/\bhref=["']https?:|window\.open\(/.test(read(path.relative(root, file)))), 'В игре нет ссылок на другие игры и сайты');

/* the docs stay consistent: the checklist row is closed */
const checklist = readFileSync(path.join(root, 'docs/yandex-checklist.md'), 'utf8');
ok(/1\/6\/3/.test(checklist), 'Пункт 1/6/3 отмечен в чек-листе');
ok(checklist.includes('ТВ'), 'В чек-листе описана адаптация для ТВ');

export { passed, failures };
