/**
 * Unit test for promo deep links (`ysdk.environment.referrer` + src/game/promo.ts).
 *
 * A banner in the catalogue opens the game with `?referrer=promo&promo_id=…&promo_intent=…&inapp_id=…`.
 * The docs' routing rule is translated into: `inapp_id` → the shop on that purchase (highlighted),
 * a known `promo_intent` → the screen it names, anything else → the normal flow. The campaign id also
 * has to reach `ysdk.getFlags` as a client feature, otherwise the Console cannot target it.
 * Bundled with esbuild and executed by tools/tests/run.mjs (`npm run test:profile`).
 */

type Call = { name: string; arg: unknown };

const calls: Call[] = [];
const record = (name: string, arg?: unknown) => calls.push({ name, arg: arg ?? null });

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

const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true });
g.document = { title: '', documentElement: { lang: '' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ru' }, configurable: true });

/* ------------------------------ SDK mock ------------------------------ */

/** the live `ysdk.environment` object: the test mutates it to simulate another deep link */
const environment: { app: { id: string }; i18n: { lang: string }; payload?: string; referrer?: unknown } = {
  app: { id: '4242' },
  i18n: { lang: 'ru' },
  payload: 'campaign-42',
  referrer: { type: 'promo', promoId: 'SPRING_DISCOUNT', intent: 'open_starter_pack', inappId: 'chest-common' },
};

const player = {
  isAuthorized: () => true,
  getUniqueID: () => 'uid-1',
  getName: () => 'MINER',
  getPhoto: () => '',
  getPayingStatus: () => 'not_paying',
  getData: async () => ({}),
  setData: async () => undefined,
  getStats: async () => ({}),
  setStats: async () => undefined,
  incrementStats: async () => ({}),
};

g.YaGames = {
  init: async () => {
    record('YaGames.init');
    return {
      environment,
      serverTime: () => Date.now(),
      getPlayer: async () => player,
      getStorage: async () => localStorageStub,
      getFlags: async (params: { defaultFlags?: Record<string, string>; clientFeatures?: Array<{ name: string }> }) => {
        record('ysdk.getFlags', params);
        return { 'ui.showFps': 'false' };
      },
      features: { LoadingAPI: { ready() {} }, GameplayAPI: { start() {}, stop() {} } },
      on() {},
    };
  },
};

/* --------------------------------- test ---------------------------------- */

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

const { initYandex, yaAppId, yaPayload, yaReferrer } = await import('../../src/game/yandex');
const { initLang } = await import('../../src/game/i18n');
const { promoAction, promoClientFeature, promoEntry, resetPromoState } = await import('../../src/game/promo');
const { loadFlags } = await import('../../src/game/flags');

initLang();
await initYandex();

// --- the environment object itself -------------------------------------------------------------
ok(yaAppId() === '4242', 'ysdk.environment.app.id читается', String(yaAppId()));
ok(yaPayload() === 'campaign-42', 'ysdk.environment.payload читается', String(yaPayload()));
const referrer = yaReferrer();
ok(
  referrer?.type === 'promo' && referrer.promoId === 'SPRING_DISCOUNT',
  'ysdk.environment.referrer отдаёт акцию',
  JSON.stringify(referrer),
);
ok(referrer?.intent === 'open_starter_pack' && referrer?.inappId === 'chest-common', 'Поля intent и inapp_id сохранены');

// --- routing of the deep link ------------------------------------------------------------------
const entry = promoEntry();
ok(entry?.promoId === 'SPRING_DISCOUNT' && entry.inappId === 'chest-common', 'promoEntry() разбирает ссылку', JSON.stringify(entry));
const discount = promoAction();
ok(
  discount?.kind === 'shop' && discount.productId === 'chest-common',
  'Акция со скидкой ведёт в магазин на конкретную покупку',
  JSON.stringify(discount),
);
ok(promoClientFeature()?.value === 'SPRING_DISCOUNT', 'ID акции готов как clientFeature', JSON.stringify(promoClientFeature()));

// --- the campaign id reaches the remote config --------------------------------------------------
// loadFlags caches its result for the process, so the call happens here exactly once
await loadFlags('not_paying');
const features = calls.find((c) => c.name === 'ysdk.getFlags')?.arg as { clientFeatures?: Array<{ name: string; value: string }> } | undefined;
const promoFeature = (features?.clientFeatures ?? []).find((f) => f.name === 'promoId');
ok(promoFeature?.value === 'SPRING_DISCOUNT', 'Акция уходит в getFlags как clientFeature promoId', JSON.stringify(features?.clientFeatures));

// --- intent without a purchase: the shop, but nothing highlighted -------------------------------
environment.referrer = { type: 'promo', promoId: 'VIP_PROMO', intent: 'open_shop' };
resetPromoState();
const vip = promoAction();
ok(vip?.kind === 'shop' && vip.productId === null, 'promo_intent=open_shop открывает магазин без подсветки', JSON.stringify(vip));

// --- a discount with an id the game does not sell: still the shop, no highlight ------------------
environment.referrer = { type: 'promo', promoId: 'X', inappId: 'unknown-sku' };
resetPromoState();
const unknownSku = promoAction();
ok(unknownSku?.kind === 'shop' && unknownSku.productId === null, 'Неизвестный inapp_id не ломает переход', JSON.stringify(unknownSku));

// --- a plain seasonal banner: the game must not hijack the start ---------------------------------
environment.referrer = { type: 'promo', promoId: 'SALE_SPRING_2026' };
resetPromoState();
const plain = promoAction();
ok(plain?.kind === 'none' && plain.promoId === 'SALE_SPRING_2026', 'Без inapp_id и intent игра идёт обычным путём', JSON.stringify(plain));
ok(promoEntry()?.intent === null && promoEntry()?.inappId === null, 'Пустые поля ссылки приводятся к null', JSON.stringify(promoEntry()));

// --- empty strings are the same as missing ------------------------------------------------------
environment.referrer = { type: 'promo', promoId: 'EMPTY', intent: '', inappId: '' };
resetPromoState();
const empty = promoAction();
ok(empty?.kind === 'none', 'Пустые intent/inapp_id не считаются сценарием', JSON.stringify(empty));

// --- no referrer at all -------------------------------------------------------------------------
environment.referrer = undefined;
resetPromoState();
ok(promoEntry() === null, 'Без referrer игра не считает себя открытой по акции');
ok(promoAction() === null, 'Без referrer сценарий не строится');
ok(promoClientFeature() === null, 'Без referrer clientFeature не добавляется');

// --- a referrer with another type is ignored ----------------------------------------------------
environment.referrer = { type: 'other', promoId: 'NOPE' };
resetPromoState();
ok(yaReferrer() === null && promoAction() === null, 'Чужой type в referrer игнорируется');

export { passed, failures };
