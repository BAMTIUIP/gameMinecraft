import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initYandex } from "./game/yandex";
import { lockViewport } from "./game/viewport";

// Yandex Games SDK: start `await YaGames.init()` right away, so it overlaps with the game's own
// loading (https://yandex.ru/dev/games/doc/ru/sdk/sdk-about#use). No-op outside Yandex Games.
void initYandex();

// Requirement 1.10: the page must not scroll or pull-to-refresh — the game scrolls its own panels.
lockViewport();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
