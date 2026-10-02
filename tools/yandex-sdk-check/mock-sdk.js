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
        },
        serverTime: () => Date.now(),
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
        getFlags: async (params) => {
          record('ysdk.getFlags', {
            local: Object.keys(params?.defaultFlags ?? {}).length,
            features: (params?.clientFeatures ?? []).map((f) => f.name),
          });
          return { ...(params?.defaultFlags ?? {}), ...(seed.flags ?? {}) };
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
            getPhoto: (size) => `data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=${size}`,
            getPayingStatus: () => seed.paying ?? 'not_paying',
            getData: async (keys) => {
              record('player.getData', keys ?? null);
              return keys ? Object.fromEntries(keys.filter((k) => k in cloud).map((k) => [k, cloud[k]])) : { ...cloud };
            },
            setData: async (data, flush) => {
              record('player.setData', { keys: Object.keys(data), flush: flush ?? false });
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
              return [
                {
                  id: 'diamonds-100',
                  title: 'Pocket of diamonds',
                  description: '100 diamonds',
                  imageURI: '',
                  price: '99 ₽',
                  priceValue: '99',
                  priceCurrencyCode: 'RUB',
                  getPriceCurrencyImage: () => 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=',
                },
                {
                  id: 'diamonds-599',
                  title: 'Miner pouch',
                  description: '599 diamonds',
                  imageURI: '',
                  price: '499 ₽',
                  priceValue: '499',
                  priceCurrencyCode: 'RUB',
                  getPriceCurrencyImage: () => 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=',
                },
              ];
            },
            getPurchases: async () => {
              record('payments.getPurchases');
              return (seed.purchases ?? []).map((p) => ({ ...p }));
            },
            purchase: async (data) => {
              record('payments.purchase', data);
              if (seed.purchaseCancelled) throw new Error('PURCHASE_CANCELLED');
              return { productID: data.id, purchaseToken: `token-${data.id}-${Date.now()}`, developerPayload: data.developerPayload ?? '' };
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
            record('adv.showFullscreenAdv');
            window.__yaAdv = { kind: 'fullscreen', callbacks };
            window.__yaAdvTimer = setTimeout(() => {
              callbacks?.onOpen?.();
              callbacks?.onClose?.(seed.adsFill !== false);
            }, 250);
          },
          showRewardedVideo: ({ callbacks } = {}) => {
            record('adv.showRewardedVideo');
            window.__yaAdv = { kind: 'rewarded', callbacks };
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
            return { stickyAdvIsShowing: true };
          },
          hideBannerAdv: async () => {
            record('adv.hideBannerAdv');
            window.__yaBanner = false;
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
