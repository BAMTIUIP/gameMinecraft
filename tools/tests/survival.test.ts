import {
  canSleepInMode,
  canSpawnSurvivalHostiles,
  FIRST_SURVIVAL_DAY_SECONDS,
  isPermanentSurvivalNight,
  shouldDieInDaylight,
  SURVIVAL_BASE_CYCLE_SECONDS,
  SURVIVAL_DAWN_SECONDS,
  SURVIVAL_DAY_SECONDS,
  SURVIVAL_DUSK_SECONDS,
  SURVIVAL_NIGHT_SECONDS,
  SURVIVAL_PERMANENT_NIGHT,
  survivalHostileCap,
  survivalHostileDamageScale,
  survivalHostileHpScale,
  survivalPhaseSeconds,
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
ok(SURVIVAL_BASE_CYCLE_SECONDS === 523, 'Сумма фаз обычного survival-цикла равна 523 секундам');
ok(SURVIVAL_PERMANENT_NIGHT === 10 && !isPermanentSurvivalNight(9) && isPermanentSurvivalNight(10), 'Постоянная ночь начинается на десятой ночи');
ok(survivalPhaseSeconds('dawn', 1) === SURVIVAL_DAWN_SECONDS, 'Рассвет первой ночи сохраняет базовую длительность');
ok(survivalPhaseSeconds('day', 1) === SURVIVAL_DAY_SECONDS, 'День после первой ночи сохраняет базовую длительность');
ok(survivalPhaseSeconds('dusk', 1) === SURVIVAL_DUSK_SECONDS, 'Закат первой ночи сохраняет базовую длительность');
ok(survivalPhaseSeconds('night', 1) === SURVIVAL_NIGHT_SECONDS, 'Первая ночь сохраняет базовую длительность');
for (let night = 1; night < SURVIVAL_PERMANENT_NIGHT; night += 1) {
  const phases = (['dawn', 'day', 'dusk', 'night'] as const).map((phase) => survivalPhaseSeconds(phase, night));
  ok(Math.abs(phases.reduce((sum, phaseSeconds) => sum + phaseSeconds, 0) - SURVIVAL_BASE_CYCLE_SECONDS) < 1e-6, `Цикл ${night} сохраняет общую длительность`);
  ok(survivalPhaseSeconds('night', night + 1) > survivalPhaseSeconds('night', night), `Ночь ${night + 1} длиннее предыдущей`);
  for (const phase of ['dawn', 'day', 'dusk'] as const) {
    ok(survivalPhaseSeconds(phase, night + 1) < survivalPhaseSeconds(phase, night), `${phase} сокращается к ночи ${night + 1}`);
  }
}
ok(survivalPhaseSeconds('dawn', SURVIVAL_PERMANENT_NIGHT) === 0, 'В постоянной ночи рассвет отсутствует');
ok(survivalPhaseSeconds('day', SURVIVAL_PERMANENT_NIGHT) === 0, 'В постоянной ночи день отсутствует');
ok(survivalPhaseSeconds('dusk', SURVIVAL_PERMANENT_NIGHT) === 0, 'В постоянной ночи закат отсутствует');
ok(survivalPhaseSeconds('night', SURVIVAL_PERMANENT_NIGHT) === SURVIVAL_BASE_CYCLE_SECONDS, 'Постоянная ночь длится полный цикл');
ok(!canSleepInMode(true, 0.1) && !canSleepInMode(true, 1), 'Кровать не позволяет спать в survival ни ночью, ни днём');
ok(canSleepInMode(false, 0.5) && !canSleepInMode(false, 0.51), 'В explorer сон остаётся доступен только при наступлении темноты');
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
