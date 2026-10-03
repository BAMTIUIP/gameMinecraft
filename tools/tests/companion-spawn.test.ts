import { companionSpawnIsClear } from '../../src/game/companionSpawn';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string) {
  if (condition) passed += 1;
  else failures.push(label);
}

const miners = [{ x: 4, z: -2 }, { x: -3, z: 5 }];
ok(!companionSpawnIsClear(4, -2, miners), 'Локального шахтёра нельзя поставить поверх уже появившегося');
ok(!companionSpawnIsClear(5.49, -2, miners), 'Локальные шахтёры сохраняют минимальную дистанцию при появлении');
ok(companionSpawnIsClear(5.5, -2, miners), 'Шахтёр появляется, если достаточно отодвинут от остальных');
ok(companionSpawnIsClear(0, 0, []), 'Первая точка локального шахтёра не ограничена пустым отрядом');
ok(!companionSpawnIsClear(Number.NaN, 0, []), 'Некорректная координата не принимается как точка спавна');

export { passed, failures };
