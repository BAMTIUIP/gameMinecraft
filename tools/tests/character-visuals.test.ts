import { CHARACTER_EXPRESSIONS, CHARACTER_GLASSES } from '../../src/game/character';
import { characterFacePixels } from '../../src/game/characterVisuals';

let passed = 0;
const failures: string[] = [];
function ok(condition: boolean, label: string) {
  if (condition) passed += 1;
  else failures.push(label);
}

const faces = CHARACTER_EXPRESSIONS.map(({ id }) => ({ id, pixels: characterFacePixels(id) }));
ok(faces.every(({ pixels }) => pixels.length >= 10), 'У каждого выражения есть детали пиксельных глаз и рта');
ok(
  faces.every(({ pixels }) => pixels.every(({ x, y, width, height }) => x >= 0 && y >= 0 && x + width <= 32 && y + height <= 32)),
  'Все пиксели лица помещаются в текстуру 32×32',
);
ok(new Set(faces.map(({ pixels }) => JSON.stringify(pixels))).size === faces.length, 'Грусть, радость, задумчивость, испуг и другие лица выглядят по-разному');
ok(faces.some(({ pixels }) => pixels.some(({ color }) => color === '#427c83')), 'Текстура содержит цветные радужки, а не символьные смайлики');

const eyewear = CHARACTER_GLASSES.map((style) => ({ style, pixels: characterFacePixels('neutral', style) }));
ok(new Set(eyewear.map(({ pixels }) => JSON.stringify(pixels))).size === eyewear.length, 'Все четыре режима очков рисуются по-разному');
ok(eyewear.find(({ style }) => style === 'sunglasses')?.pixels.some(({ color }) => color === '#263847') === true, 'Солнцезащитные очки закрывают глаза пиксельными линзами');
ok(eyewear.find(({ style }) => style === 'round')?.pixels.length! > eyewear.find(({ style }) => style === 'square')?.pixels.length!, 'Круглая оправа отличается от квадратной ступенчатым контуром');

export { passed, failures };
