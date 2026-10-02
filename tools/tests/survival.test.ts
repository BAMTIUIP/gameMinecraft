import {
  canSpawnSurvivalHostiles,
  FIRST_SURVIVAL_DAY_SECONDS,
  shouldDieInDaylight,
  SURVIVAL_DAY_SECONDS,
  survivalHostileCap,
  survivalHostileDamageScale,
  survivalHostileHpScale,
  survivalThreatLevel,
} from '../../src/game/survival';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string) {
  if (condition) passed += 1;
  else failures.push(label);
}

ok(SURVIVAL_DAY_SECONDS === 238 && SURVIVAL_DAY_SECONDS / 340 === 0.7, 'Обычный survival-день сокращён ровно на 30%');
ok(FIRST_SURVIVAL_DAY_SECONDS === 336 && FIRST_SURVIVAL_DAY_SECONDS / 480 === 0.7, 'Первый удлинённый survival-день тоже сокращён ровно на 30%');
ok(!canSpawnSurvivalHostiles(0, false, false), 'В первый день на открытой поверхности нет враждебных мобов');
ok(!canSpawnSurvivalHostiles(0, false, true), 'В первый день даже под землёй враждебные мобы не появляются');
ok(canSpawnSurvivalHostiles(1, true, false), 'Первый враждебный спавн разрешён в первую ночь');
ok(!canSpawnSurvivalHostiles(1, false, false), 'После первой ночи дневной спавн на поверхности запрещён');
ok(canSpawnSurvivalHostiles(1, false, true), 'После первой ночи днём мобы могут появляться только под землёй');
ok(survivalHostileCap(2, true, false) === survivalHostileCap(1, true, false) + 3, 'Лимит мобов растёт на следующих ночах');
ok(survivalThreatLevel(1) === 0 && survivalThreatLevel(2) === 1, 'Рост угрозы начинается со второй ночи');
ok(survivalHostileHpScale(2) > survivalHostileHpScale(1), 'Мобы становятся выносливее со второй ночи');
ok(survivalHostileDamageScale(2) > survivalHostileDamageScale(1), 'Урон мобов растёт со второй ночи');
ok(shouldDieInDaylight(true, 0.8, true), 'Открытый враждебный моб погибает под дневным солнцем');
ok(!shouldDieInDaylight(true, 0.8, false), 'Враждебный моб под крышей не считается открытым');
ok(!shouldDieInDaylight(false, 0.8, true), 'Пассивные животные не сгорают на солнце');
ok(!shouldDieInDaylight(true, 0.55, true), 'Сумеречный порог не считается полным дневным светом');

export { passed, failures };
