/** Tests the WebGL 2 preflight used before the Three.js renderer is mounted. */

import { canCreateWebGL2Context } from '../../src/game/webgl';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string) {
  if (condition) passed += 1;
  else failures.push(label);
}

let requestedContext = '';
let released = 0;
const supportedCanvas = {
  getContext: (name: string) => {
    requestedContext = name;
    return {
      getExtension: (extension: string) => extension === 'WEBGL_lose_context'
        ? { loseContext: () => { released += 1; } }
        : null,
    };
  },
};

ok(canCreateWebGL2Context(() => supportedCanvas, true), 'Доступный WebGL 2 проходит предварительную проверку');
ok(requestedContext === 'webgl2', 'Проверяется именно WebGL 2, необходимый Three.js r163+');
ok(released === 1, 'Временный тестовый GPU-контекст освобождается до создания игрового рендерера');
ok(!canCreateWebGL2Context(() => supportedCanvas, false), 'Отсутствующий WebGL2RenderingContext распознаётся');
ok(!canCreateWebGL2Context(() => ({ getContext: () => null }), true), 'Отключённый или недоступный WebGL 2 распознаётся');
ok(!canCreateWebGL2Context(() => { throw new Error('blocked'); }, true), 'Исключение браузера не ломает загрузку, а переводит в fallback');

export { passed, failures };
