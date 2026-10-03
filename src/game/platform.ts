/**
 * Platform events the game reacts to (https://yandex.ru/dev/games/doc/ru/sdk/sdk-events).
 *
 * The page covers four things and this module is the game-side half of them:
 *
 *  - **pause / resume** — handled where the engine lives (App + `yaOnPause`/`yaOnResume` on the
 *    engine's `systemPause`/`systemResume`). `yaPlatformPaused()` additionally reports the state, so
 *    nothing starts the loop into a pause — the platform shows a full-screen ad at startup, and that
 *    ad arrives exactly as a pause without any callback of its own;
 *  - **`HISTORY_BACK`** — only on TVs: the player pressed Back. The docs ask for the game's own
 *    dialog instead of a silent exit, so the UI gets an "exit?" prompt and, if the player confirms,
 *    the game answers with `ysdk.dispatchEvent(EVENTS.EXIT)`;
 *  - **`EXIT`** — that confirmation, sent through `yaDispatchExit()`;
 *  - **account selection dialog** — the player signed in or switched accounts, so the platform shows
 *    a picker with two progress variants. While it is open, pushing our progress would be rude (the
 *    player is deciding which one to keep), and as soon as it closes the game has to re-request the
 *    player and re-read the cloud progress — the menu is the honest place to land after that.
 *
 * Everything is a no-op outside Yandex Games.
 */

import { yaDispatchExit, yaOnPlatformEvent, type YaPlatformEvent } from './yandex';

export type AccountPhase = 'opened' | 'closed';

type Listener = () => void;

const exitListeners = new Set<Listener>();
const accountListeners = new Set<(phase: AccountPhase) => void>();

let started = false;
let unsubscribe: Array<() => void> = [];
let exitPromptOpen = false;

/**
 * Subscribe to the platform events once. The game's own listeners can be added before or after this
 * call: `yaOnPlatformEvent` registry is what the SDK subscription feeds, so ordering never matters.
 */
export function startPlatformEvents(): () => void {
  if (started) return () => undefined;
  started = true;
  const subscribe = (event: YaPlatformEvent) =>
    yaOnPlatformEvent(event, () => emit(event));
  unsubscribe = [
    subscribe('HISTORY_BACK'),
    subscribe('ACCOUNT_SELECTION_DIALOG_OPENED'),
    subscribe('ACCOUNT_SELECTION_DIALOG_CLOSED'),
  ];
  return stopPlatformEvents;
}

/** Remove the platform subscriptions when the app's event owner is torn down. */
export function stopPlatformEvents() {
  if (!started && !unsubscribe.length) return;
  started = false;
  for (const off of unsubscribe) off();
  unsubscribe = [];
  exitPromptOpen = false;
}

function emit(event: YaPlatformEvent) {
  if (event === 'HISTORY_BACK') {
    exitPromptOpen = true;
    for (const cb of [...exitListeners]) cb();
    return;
  }
  const phase: AccountPhase = event === 'ACCOUNT_SELECTION_DIALOG_OPENED' ? 'opened' : 'closed';
  for (const cb of [...accountListeners]) cb(phase);
}

/** The player pressed Back on a TV: show the game's own "leave?" dialog. */
export function onExitPrompt(cb: Listener): () => void {
  exitListeners.add(cb);
  return () => {
    exitListeners.delete(cb);
  };
}

/** The account picker opened / closed: pause the progress sync, then re-read the chosen progress. */
export function onAccountSwitch(cb: (phase: AccountPhase) => void): () => void {
  accountListeners.add(cb);
  return () => {
    accountListeners.delete(cb);
  };
}

/** Is the "leave?" dialog on screen right now? */
export function exitPromptShown(): boolean {
  return exitPromptOpen;
}

/** The player confirmed leaving: tell the platform (`dispatchEvent(EXIT)`) and close the dialog. */
export function confirmExit(): boolean {
  exitPromptOpen = false;
  return yaDispatchExit();
}

/** The player changed their mind: close the dialog, the game keeps running. */
export function dismissExit() {
  exitPromptOpen = false;
}

/** Test seam: forget listeners and state, as if the page had just loaded. */
export function resetPlatformState() {
  stopPlatformEvents();
  exitListeners.clear();
  accountListeners.clear();
}
