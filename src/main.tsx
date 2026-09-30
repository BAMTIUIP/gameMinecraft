import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initYandex } from "./game/yandex";

// Yandex Games SDK: start `await YaGames.init()` right away, so it overlaps with the game's own
// loading (https://yandex.ru/dev/games/doc/ru/sdk/sdk-about#use). No-op outside Yandex Games.
void initYandex();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
