/**
 * Requirement 1.14 — «игра не содержит технических ошибок и зависаний»
 * (https://yandex.ru/dev/games/doc/ru/requirements/1/14).
 *
 * Two of the rejected examples are «перестаёт отвечать после сворачивания браузера» and «при
 * изменении размера». Both used to be reachable through the same hole: a minimised window, a hidden
 * tab or a container collapsed by an overlay reports `clientWidth === 0`, `0 || window.innerWidth`
 * falls through to `0` as well, and `aspect = 0 / 0` is `NaN` — which `updateProjectionMatrix()`
 * writes straight into the projection matrix. The frame then renders nothing, and the player who came
 * back to a black canvas reloaded the game instead of waiting for the next resize.
 *
 * `Engine.viewportSize()` is the single place the renderer's pixel size comes from (mount and every
 * resize), so guarding it guards both paths.
 *
 * three.js already handles a lost WebGL context on its own — it prevents the default action of
 * `webglcontextlost`, re-initialises on `webglcontextrestored` and early-returns from `render()` while
 * the context is gone — so nothing is needed there; what was missing was the size guard.
 */

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
g.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'en' }, configurable: true });

let passed = 0;
const failures: string[] = [];
const ok = (condition: boolean, label: string, detail = '') => {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
};

const { Engine } = await import('../../src/game/engine');

/** An engine carrying only the container the test controls; `viewportSize()` reads just that. */
function makeEngine(container: () => [number, number]) {
  const engine = Object.create(Engine.prototype) as Record<string, unknown>;
  Object.defineProperty(engine, 'container', {
    get: () => ({ get clientWidth() { return container()[0]; }, get clientHeight() { return container()[1]; } }),
  });
  return engine as unknown as { viewportSize: () => { w: number; h: number } };
}

function withWindow(w: number, h: number, run: () => void) {
  const original = { w: window.innerWidth, h: window.innerHeight };
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
  try {
    run();
  } finally {
    Object.defineProperty(window, 'innerWidth', { value: original.w, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: original.h, configurable: true });
  }
}

/* ------------------------- a normal, healthy window ------------------------- */

withWindow(800, 600, () => {
  const size = makeEngine(() => [800, 600]).viewportSize();
  ok(size.w === 800 && size.h === 600, 'Обычное окно даёт свой настоящий размер', JSON.stringify(size));
});

/* ------------- a minimised window: both the container and the window are 0 ------------- */

withWindow(0, 0, () => {
  const size = makeEngine(() => [0, 0]).viewportSize();
  ok(size.w >= 1 && size.h >= 1, 'Свёрнутое окно не даёт нулевой размер', JSON.stringify(size));
  ok(Number.isFinite(size.w / size.h) && size.w / size.h > 0, 'Отношение сторон остаётся конечным и положительным', String(size.w / size.h));
});

/* ----------- only one axis collapses (an overlay or a rotated phone) ----------- */

withWindow(0, 360, () => {
  const size = makeEngine(() => [0, 360]).viewportSize();
  ok(size.w >= 1 && size.h === 360, 'Нулевая ширина подменяется, живая высота сохраняется', JSON.stringify(size));
});

withWindow(740, 0, () => {
  const size = makeEngine(() => [740, 0]).viewportSize();
  ok(size.w === 740 && size.h >= 1, 'Нулевая высота подменяется, живая ширина сохраняется', JSON.stringify(size));
});

/* ------------------- the real size comes straight back afterwards ------------------- */

withWindow(740, 360, () => {
  const size = makeEngine(() => [740, 360]).viewportSize();
  ok(size.w === 740 && size.h === 360, 'После возврата окна размер снова настоящий', JSON.stringify(size));
});

/* ------------------- a live container matters more than a dead window ------------------- */

withWindow(0, 0, () => {
  const size = makeEngine(() => [463, 348]).viewportSize();
  ok(size.w === 463 && size.h === 348, 'Живой контейнер важнее нулевого окна', JSON.stringify(size));
});

/* ------------------- the mount path goes through the same guard ------------------- */

withWindow(0, 0, () => {
  const size = makeEngine(() => [0, 0]).viewportSize();
  const aspect = size.w / size.h;
  ok(Number.isFinite(aspect) && aspect > 0, 'На старте при свёрнутом окне aspect конечен (mount идёт тем же путём)', String(aspect));
});

export { passed, failures };
