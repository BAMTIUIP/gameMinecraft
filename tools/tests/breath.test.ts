import { createBreathState, MAX_AIR_BUBBLES, stepBreath } from '../../src/game/breath';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string, detail = '') {
  if (condition) passed += 1;
  else failures.push(detail ? `${label} → ${detail}` : label);
}

let result = stepBreath(createBreathState(), true, 1);
ok(result.state.bubbles === 5, 'Под водой за секунду уходит один пузырёк', String(result.state.bubbles));
ok(result.damage === 0, 'Урон не начинается, пока остаются пузырьки', String(result.damage));

result = stepBreath(createBreathState(), true, 6);
ok(result.state.bubbles === 0, 'После шести секунд под водой запас воздуха пуст', String(result.state.bubbles));
ok(result.damage === 0, 'Урон начинается после потери последнего пузырька', String(result.damage));

const firstDrowningSecond = stepBreath(result.state, true, 1);
const fourthDrowningSecond = stepBreath(firstDrowningSecond.state, true, 3);
ok(firstDrowningSecond.damage > 0, 'После обнуления воздуха игрок получает урон', String(firstDrowningSecond.damage));
ok(fourthDrowningSecond.damage > firstDrowningSecond.damage, 'Урон от утопления нарастает со временем');

const surfaced = stepBreath(fourthDrowningSecond.state, false, 0.5);
ok(surfaced.damage === 0 && surfaced.state.drowningSeconds === 0, 'На поверхности утопление сразу прекращается');
ok(surfaced.state.bubbles === 0, 'Пузырьки восстанавливаются постепенно, не мгновенно');
const recoveredOne = stepBreath(surfaced.state, false, 0.25);
ok(recoveredOne.state.bubbles === 1, 'На поверхности возвращается по одному пузырьку');
const recoveredAll = stepBreath(recoveredOne.state, false, 5);
ok(recoveredAll.state.bubbles === MAX_AIR_BUBBLES, 'За несколько секунд запас полностью восстанавливается');

export { passed, failures };
