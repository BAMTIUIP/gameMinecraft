import { canSprint, createStaminaState, MAX_STAMINA, STAMINA_SPRINT_RESUME, stepStamina } from '../../src/game/stamina';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

let stamina = createStaminaState();
ok(stamina.stamina === MAX_STAMINA && canSprint(stamina), 'Забег начинается с полной выносливостью');

stamina = stepStamina(stamina, true, 6);
ok(stamina.stamina < MAX_STAMINA && stamina.stamina > 0, 'Бег со спринтом постепенно расходует выносливость', String(stamina.stamina));
ok(canSprint(stamina), 'Пока запас не исчерпан, спринт доступен');

stamina = stepStamina(stamina, true, 6);
ok(stamina.stamina === 0 && stamina.exhausted, 'При нуле выносливости спринт блокируется');
ok(!canSprint(stamina), 'Истощённый персонаж не может продолжать спринт');

stamina = stepStamina(stamina, true, 1);
ok(stamina.stamina > 0 && stamina.exhausted, 'Удержание спринта не отменяет обязательное восстановление');

stamina = stepStamina(stamina, false, 1);
ok(stamina.stamina < STAMINA_SPRINT_RESUME && stamina.exhausted, 'Короткая передышка ещё не включает спринт');
stamina = stepStamina(stamina, false, 1);
ok(stamina.stamina >= STAMINA_SPRINT_RESUME && !stamina.exhausted, 'После восстановления спринт снова доступен');

stamina = stepStamina(stamina, false, 10);
ok(stamina.stamina === MAX_STAMINA, 'Во время обычного движения запас полностью восстанавливается');

export { passed, failures };
