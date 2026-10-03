/**
 * Mock of the Yandex Games SDK for the automated check (`npm run yandex:sdk-check`).
 *
 * It is served instead of the real /sdk.js, implements the same surface as
 * https://yandex.ru/dev/games/doc/ru/sdk/sdk-overview and records every call into
 * window.__yaCalls, so the check can assert on the init/loader/gameplay sequence without
 * a developer console open. Not part of the game archive: only tools/ use it.
 */
(() => {
  const calls = [];
  window.__yaCalls = calls;
  const record = (name, arg) => {
    calls.push({ name, arg: arg === undefined ? null : arg, t: performance.now() });
  };

  // pre-seeded cloud data / player name, set by the check through evaluateOnNewDocument
  const seed = window.__yaMockSeed ?? {};
  const cloud = { ...(seed.data ?? {}) };
  let stats = { ...(seed.stats ?? {}) };
  let authorized = seed.authorized ?? true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // The Arena ad-preview server opts into a visible local placeholder; automated SDK checks keep
  // their original fast, invisible callbacks because this flag is absent there.
  const visualAdPreview = window.__yaVisualAdMock === true;

  function mockAdOverlay(kind, callbacks) {
    if (!visualAdPreview || !document.body) return false;
    let finished = false;
    const overlay = document.createElement('div');
    overlay.dataset.yandexAdPreview = kind;
    overlay.setAttribute('role', 'presentation');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:20px;background:rgba(3,8,12,.9);backdrop-filter:blur(7px);font-family:system-ui,sans-serif;color:#fff;';

    const card = document.createElement('section');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'ya-ad-preview-title');
    card.style.cssText = 'box-sizing:border-box;width:min(540px,100%);padding:clamp(22px,5vw,38px);border:1px solid rgba(98,232,220,.6);background:linear-gradient(145deg,#14232b,#10151d 62%,#211a2c);box-shadow:0 24px 90px rgba(0,0,0,.75);text-align:center;';

    const badge = document.createElement('div');
    badge.textContent = 'YANDEX GAMES · SDK MOCK';
    badge.style.cssText = 'margin-bottom:18px;color:#62e8dc;font-size:11px;font-weight:800;letter-spacing:.2em;';
    const title = document.createElement('h2');
    title.id = 'ya-ad-preview-title';
    title.textContent = kind === 'rewarded' ? 'Rewarded ad placeholder' : 'Fullscreen ad placeholder';
    title.style.cssText = 'margin:0;color:#fff;font-size:clamp(22px,5vw,32px);line-height:1.15;';
    const description = document.createElement('p');
    description.textContent = kind === 'rewarded'
      ? 'No real video is loaded. Choose whether to simulate a completed view and reward.'
      : 'No real ad is loaded. Close this mock to continue.';
    description.style.cssText = 'margin:14px 0 24px;color:rgba(255,255,255,.68);font-size:14px;line-height:1.55;';
    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:10px;';

    const finish = (wasShown) => {
      if (finished) return;
      finished = true;
      if (kind === 'rewarded' && wasShown) callbacks?.onRewarded?.();
      callbacks?.onClose?.(wasShown);
      overlay.remove();
      window.__yaAdv = null;
    };
    const addButton = (text, primary, onClick) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.style.cssText = `min-height:44px;padding:10px 16px;border:1px solid ${primary ? '#62e8dc' : 'rgba(255,255,255,.24)'};background:${primary ? 'linear-gradient(#207c79,#145452)' : 'rgba(0,0,0,.25)'};color:#fff;font:700 12px system-ui,sans-serif;letter-spacing:.04em;cursor:pointer;`;
      button.addEventListener('click', onClick);
      buttons.appendChild(button);
    };

    if (kind === 'rewarded') {
      addButton('Complete mock view · grant reward', true, () => finish(true));
      addButton('Close without reward', false, () => finish(false));
    } else {
      addButton('Close mock ad', true, () => finish(true));
    }
    card.append(badge, title, description, buttons);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    callbacks?.onOpen?.();
    return true;
  }

  function renderBannerPlaceholder() {
    if (!visualAdPreview || !document.body || document.getElementById('__ya-ad-preview-banner')) return;
    const banner = document.createElement('div');
    banner.id = '__ya-ad-preview-banner';
    banner.setAttribute('role', 'status');
    banner.style.cssText = 'box-sizing:border-box;position:fixed;z-index:2147483645;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;justify-content:space-between;gap:16px;width:min(728px,calc(100vw - 20px));min-height:62px;padding:10px 16px;border:1px dashed rgba(98,232,220,.7);background:rgba(8,18,24,.94);box-shadow:0 8px 36px rgba(0,0,0,.45);font:12px system-ui,sans-serif;color:#fff;pointer-events:none;';
    const label = document.createElement('span');
    label.textContent = 'YANDEX GAMES · TEST BANNER';
    label.style.cssText = 'color:#62e8dc;font-weight:800;letter-spacing:.12em;';
    const note = document.createElement('span');
    note.textContent = 'Mock placeholder · no real ad';
    note.style.cssText = 'color:rgba(255,255,255,.62);text-align:right;';
    banner.append(label, note);
    document.body.appendChild(banner);
  }

  const removeBannerPlaceholder = () => document.getElementById('__ya-ad-preview-banner')?.remove();

  const leaderboardDescription = () => ({
    appID: '0',
    default: true,
    name: 'orerush-best-score',
    title: { ru: 'ЛУЧШИЕ ШАХТЁРЫ', en: 'TOP MINERS' },
    description: { invert_sort_order: false, sort_order: 'DESC', score_format: { type: 'numeric', options: { decimal_offset: 0 } } },
  });

  // the top plus the player's row and a hidden player, like the real getEntries(includeUser) answer
  const leaderboardEntries = () => {
    const entries = [
      { rank: 1, score: 15_000, player: { publicName: 'DEEP DIGGER', uniqueID: 'uid-1', getAvatarSrc: () => '' } },
      { rank: 2, score: 9_000, player: { publicName: 'CLOUD MINER', uniqueID: 'uid-2' } },
      { rank: 3, score: seed.leaderboardBest ?? 5000, player: { publicName: seed.name ?? 'MOCK PLAYER', uniqueID: seed.uid ?? 'mock-uid' } },
      { rank: 4, score: 0, player: { publicName: '', uniqueID: 'uid-hidden' } },
    ];
    return { leaderboard: leaderboardDescription(), ranges: [{ start: 0, size: entries.length }], userRank: 3, entries };
  };

  window.YaGames = {
    init: async (options) => {
      record('YaGames.init', options ?? null);
      await sleep(10); // let the game's own init overlap, like the real SDK
      return {
        environment: {
          app: { id: '0' },
          i18n: { lang: seed.lang ?? 'en' },
          payload: seed.payload ?? null,
          // promo deep link, same shape the platform passes for a catalogue banner
          referrer: seed.referrer ?? undefined,
        },
        // the trusted clock: the test can shift it without touching the device clock
        serverTime: () => Date.now() + (seed.serverTimeOffsetMs ?? 0),
        // sdk-params: the device, the browser fullscreen mode and the clipboard
        deviceInfo: (() => {
          const kind = seed.deviceType ?? 'desktop';
          return {
            get type() {
              record('deviceInfo.type');
              return kind;
            },
            isMobile: () => {
              record('deviceInfo.isMobile');
              return kind === 'mobile';
            },
            isDesktop: () => {
              record('deviceInfo.isDesktop');
              return kind === 'desktop';
            },
            isTablet: () => {
              record('deviceInfo.isTablet');
              return kind === 'tablet';
            },
            isTV: () => {
              record('deviceInfo.isTV');
              return kind === 'tv';
            },
          };
        })(),
        screen: {
          fullscreen: (() => {
            let current = 'off';
            return {
              STATUS_ON: 'on',
              STATUS_OFF: 'off',
              get status() {
                return current;
              },
              request: async () => {
                record('screen.fullscreen.request');
                current = 'on';
              },
              exit: async () => {
                record('screen.fullscreen.exit');
                current = 'off';
              },
            };
          })(),
        },
        clipboard: {
          writeText: async (text) => {
            record('clipboard.writeText', text);
            window.__yaClipboard = text;
          },
        },
        features: {
          LoadingAPI: { ready: () => record('LoadingAPI.ready') },
          GameplayAPI: {
            start: () => record('GameplayAPI.start'),
            stop: () => record('GameplayAPI.stop'),
          },
        },
        on: (event, listener) => {
          record('ysdk.on', event);
          window.__yaEmit ??= {};
          (window.__yaEmit[event] ??= []).push(listener);
        },
        off: (event, listener) => {
          record('ysdk.off', event);
          const listeners = window.__yaEmit?.[event] ?? [];
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        },
        // the platform-side names, exactly as the SDK exposes them
        EVENTS: {
          EXIT: 'EXIT',
          HISTORY_BACK: 'HISTORY_BACK',
          ACCOUNT_SELECTION_DIALOG_OPENED: 'ACCOUNT_SELECTION_DIALOG_OPENED',
          ACCOUNT_SELECTION_DIALOG_CLOSED: 'ACCOUNT_SELECTION_DIALOG_CLOSED',
        },
        dispatchEvent: (event) => {
          record('ysdk.dispatchEvent', event);
          return Promise.resolve();
        },
        getFlags: async (params) => {
          record('ysdk.getFlags', {
            local: Object.keys(params?.defaultFlags ?? {}).length,
            features: (params?.clientFeatures ?? []).map((f) => f.name),
          });
          return { ...(params?.defaultFlags ?? {}), ...(seed.flags ?? {}) };
        },
        // desktop shortcut: canShowPrompt() gates showPrompt(); the seed can hide the feature
        shortcut: {
          canShowPrompt: async () => {
            record('shortcut.canShowPrompt');
            return { canShow: seed.shortcutCanShow !== false };
          },
          showPrompt: async () => {
            record('shortcut.showPrompt');
            return { outcome: seed.shortcutOutcome ?? 'accepted' };
          },
        },
        // rating the game: canReview() gates requestReview(), both recorded for the check
        feedback: {
          canReview: async () => {
            record('feedback.canReview');
            if (seed.reviewAllowed === false) return { value: false, reason: seed.reviewReason ?? 'GAME_RATED' };
            return { value: true };
          },
          requestReview: async () => {
            record('feedback.requestReview');
            return { feedbackSent: seed.reviewSent !== false };
          },
        },
        // asynchronous multiplayer: sessions are pre-seeded by the check, commits and pushes are recorded
        multiplayer: {
          sessions: {
            init: async (params) => {
              record('multiplayer.init', params ?? null);
              if (seed.multiplayerFails) throw new Error('multiplayer unavailable');
              return (seed.multiplayerSessions ?? []).map((session) => ({ ...session }));
            },
            commit: (payload) => record('multiplayer.commit', payload),
            push: async (meta) => record('multiplayer.push', meta),
          },
        },
        isAvailableMethod: async (method) => {
          record('ysdk.isAvailableMethod', method);
          return true;
        },
        getStorage: async () => {
          record('ysdk.getStorage');
          return window.localStorage;
        },
        getPlayer: async (options) => {
          record('ysdk.getPlayer', options ?? null);
          await sleep(5);
          return {
            isAuthorized: () => authorized,
            getUniqueID: () => seed.uid ?? 'mock-uid',
            getName: () => seed.name ?? 'MOCK PLAYER',
            // a real, decodable 1×1 avatar: appending the size to a base64 payload produced a broken
            // image, which the game then drew as a browser placeholder
            getPhoto: () => 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=',
            getPayingStatus: () => seed.paying ?? 'not_paying',
            getData: async (keys) => {
              record('player.getData', keys ?? null);
              return keys ? Object.fromEntries(keys.filter((k) => k in cloud).map((k) => [k, cloud[k]])) : { ...cloud };
            },
            setData: async (data, flush) => {
              record('player.setData', {
                keys: Object.keys(data),
                flush: flush ?? false,
                daily: data['orerush.profile']?.daily ?? null,
                adDrops: data['orerush.profile']?.adDrops ?? null,
                shopRewards: data['orerush.profile']?.shopRewards ?? null,
                character: data['orerush.profile']?.character ?? null,
              });
              Object.assign(cloud, data);
            },
            getStats: async (keys) => {
              record('player.getStats', keys ?? null);
              return keys ? Object.fromEntries(keys.map((k) => [k, stats[k] ?? 0])) : { ...stats };
            },
            setStats: async (next) => {
              record('player.setStats', next);
              Object.assign(stats, next);
            },
            incrementStats: async (inc) => {
              record('player.incrementStats', inc);
              for (const [k, v] of Object.entries(inc)) stats[k] = (stats[k] ?? 0) + v;
              return { ...stats };
            },
          };
        },
        isAvailableMethod: async (method) => {
          record('ysdk.isAvailableMethod', method);
          return method === 'leaderboards.setScore' ? seed.leaderboardScoring !== false : true;
        },
        // ysdk.leaderboards is the current API: the game must not call the deprecated getLeaderboards()
        leaderboards: {
          getDescription: async (name) => {
            record('leaderboards.getDescription', name);
            return leaderboardDescription();
          },
          getEntries: async (name, options) => {
            record('leaderboards.getEntries', { name, options: options ?? null });
            return leaderboardEntries();
          },
          getPlayerEntry: async (name) => {
            record('leaderboards.getPlayerEntry', name);
            if (seed.leaderboardRanked === false) {
              const err = new Error('player not present');
              err.code = 'LEADERBOARD_PLAYER_NOT_PRESENT';
              throw err;
            }
            return { rank: 3, score: seed.leaderboardBest ?? 5000, extraData: '', player: { publicName: seed.name ?? 'MOCK PLAYER', uniqueID: seed.uid ?? 'mock-uid' } };
          },
          setScore: async (name, score, extraData) => {
            record('leaderboards.setScore', { name, score, extraData: extraData ?? '' });
            seed.leaderboardBest = Math.max(seed.leaderboardBest ?? 0, score);
          },
        },
        payments: null, // filled by getPayments() below
        getPayments: async () => {
          record('ysdk.getPayments');
          return {
            getCatalog: async () => {
              record('payments.getCatalog');
              if (Array.isArray(seed.catalog)) return seed.catalog;
              const currencyImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=';
              const offer = (id, title, description, price, currencyCode = 'TST') => {
                const priceValue = price.replace(/[^\d.]/g, '');
                return {
                  id,
                  title,
                  description,
                  imageURI: '',
                  price,
                  priceValue,
                  priceCurrencyCode: currencyCode,
                  getPriceCurrencyImage: () => currencyImage,
                };
              };
              // The test catalogue includes direct product SKUs. The mixed RUB/TST price formats
              // ensure the UI reads both label and currency icon from the SDK rather than hardcoding.
              return [
                offer('armor-uncommon', 'Uncommon armor', 'Iron armor set', '199 TST'),
                offer('armor-rare', 'Rare armor', 'Gold armor set', '299 TST'),
                offer('armor-epic', 'Epic armor', 'Netherite armor set', '399 TST'),
                offer('netherite-pickaxe', 'Netherite pickaxe', 'Direct item purchase', '499 TST'),
                offer('netherite-armor', 'Netherite armor', 'Complete armor set', '799 TST'),
                offer('chest-common', 'Common supply chest', 'Supplies for a run', '99 ₽', 'RUB'),
                offer('chest-rare', 'Rare ore chest', 'Supplies and gear', '199 TST'),
                offer('chest-epic', 'Epic treasure chest', 'Resources and gear', '399 TST'),
                offer('booster-start', 'Quick start', 'Starter supplies', '99 TST'),
                offer('booster-ore', 'Ore seeker', 'Guaranteed ore cache', '149 TST'),
                offer('booster-score', 'Score surge', 'Next-run score boost', '199 TST'),
                offer('disable_ads', 'Remove ads', 'Permanent ad-free entitlement', '299 TST'),
              ];
            },
            getPurchases: async () => {
              record('payments.getPurchases');
              return (seed.purchases ?? []).map((p) => ({ ...p }));
            },
            purchase: async (data) => {
              record('payments.purchase', data);
              if (seed.purchaseCancelled) throw new Error('PURCHASE_CANCELLED');
              const purchase = { productID: data.id, purchaseToken: `token-${data.id}-${Date.now()}`, developerPayload: data.developerPayload ?? '' };
              seed.purchases = [...(seed.purchases ?? []), purchase];
              return { ...purchase };
            },
            consumePurchase: async (token) => {
              record('payments.consumePurchase', token);
              seed.purchases = (seed.purchases ?? []).filter((p) => p.purchaseToken !== token);
            },
          };
        },
        adv: {
          // Real ads are asynchronous: onOpen, then the player closes them. Callbacks resolve the
          // game's promises, so the mock closes itself after a moment like a filled ad would.
          showFullscreenAdv: ({ callbacks } = {}) => {
            record('adv.showFullscreenAdv', { callbacks: Object.keys(callbacks ?? {}) });
            window.__yaAdv = { kind: 'fullscreen', callbacks };
            if (mockAdOverlay('fullscreen', callbacks)) return;
            window.__yaAdvTimer = setTimeout(() => {
              callbacks?.onOpen?.();
              callbacks?.onClose?.(seed.adsFill !== false);
            }, 250);
          },
          showRewardedVideo: ({ callbacks } = {}) => {
            record('adv.showRewardedVideo', { callbacks: Object.keys(callbacks ?? {}) });
            window.__yaAdv = { kind: 'rewarded', callbacks };
            if (mockAdOverlay('rewarded', callbacks)) return;
            window.__yaAdvTimer = setTimeout(() => {
              callbacks?.onOpen?.();
              if (seed.rewarded !== false) callbacks?.onRewarded?.();
              callbacks?.onClose?.(seed.adsFill !== false);
            }, 250);
          },
          getBannerAdvStatus: async () => {
            record('adv.getBannerAdvStatus');
            return { stickyAdvIsShowing: window.__yaBanner ?? false };
          },
          showBannerAdv: async () => {
            record('adv.showBannerAdv');
            window.__yaBanner = true;
            renderBannerPlaceholder();
            return { stickyAdvIsShowing: true };
          },
          hideBannerAdv: async () => {
            record('adv.hideBannerAdv');
            window.__yaBanner = false;
            removeBannerPlaceholder();
            return { stickyAdvIsShowing: false };
          },
        },
        auth: {
          openAuthDialog: async () => {
            record('auth.openAuthDialog');
            authorized = true;
          },
        },
      };
    },
  };
})();
