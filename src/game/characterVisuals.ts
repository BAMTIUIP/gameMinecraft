import type { CharacterExpression, CharacterGlasses } from './character';

export type FacePixel = { x: number; y: number; width: number; height: number; color: string };

/**
 * A 32×32 Minecraft-style face atlas: every feature is a crisp block, with visible eye whites,
 * colored irises, brows and a small mouth. The same pixels are used in the editor and on 3D heads.
 */
export function characterFacePixels(expression: CharacterExpression, glasses: CharacterGlasses = 'none'): FacePixel[] {
  const pixels: FacePixel[] = [];
  const add = (x: number, y: number, width: number, height: number, color: string) => {
    pixels.push({ x, y, width, height, color });
  };
  const ink = '#251b18';
  const white = '#fff1d8';
  const iris = '#427c83';
  const pupil = '#171b22';
  const blush = '#d97b70';
  const tear = '#65c8ea';

  const openEyes = (wide = false, look: 'center' | 'up' | 'left' = 'center') => {
    const y = wide ? 9 : 11;
    const h = wide ? 9 : 7;
    add(4, y, 9, h, white);
    add(19, y, 9, h, white);
    const irisY = look === 'up' ? y : y + 1;
    const irisX = look === 'left' ? 5 : 7;
    add(irisX, irisY + 1, 4, 5, iris);
    add(23, irisY + 1, 4, 5, iris);
    add(irisX + 1, irisY + 2, 2, 4, pupil);
    add(24, irisY + 2, 2, 4, pupil);
    add(irisX + 1, irisY + 1, 1, 1, white);
    add(24, irisY + 1, 1, 1, white);
  };
  const calmBrows = () => {
    add(4, 8, 9, 2, ink);
    add(19, 8, 9, 2, ink);
  };
  const smile = () => {
    add(8, 22, 3, 2, ink);
    add(11, 24, 10, 2, ink);
    add(21, 22, 3, 2, ink);
  };

  if (expression === 'happy') {
    // Upturned closed eyes, with a broad open grin and a tiny line of teeth.
    add(4, 13, 3, 2, ink); add(7, 11, 5, 2, ink); add(12, 13, 2, 2, ink);
    add(18, 13, 2, 2, ink); add(20, 11, 5, 2, ink); add(25, 13, 3, 2, ink);
    add(9, 21, 14, 6, ink);
    add(12, 21, 8, 2, white);
    add(14, 25, 4, 1, blush);
  } else if (expression === 'sad') {
    openEyes();
    // The inner ends of the brows rise, while the pixel mouth turns down.
    add(4, 8, 4, 2, ink); add(8, 10, 5, 2, ink);
    add(19, 10, 5, 2, ink); add(24, 8, 4, 2, ink);
    add(9, 24, 4, 2, ink); add(13, 22, 6, 2, ink); add(19, 24, 4, 2, ink);
    add(25, 18, 2, 4, tear);
    add(25, 22, 1, 2, '#a5e7f7');
  } else if (expression === 'thoughtful') {
    openEyes(false, 'up');
    add(4, 7, 9, 2, ink);
    add(20, 6, 8, 2, ink);
    add(16, 23, 7, 2, ink);
    add(22, 22, 2, 2, ink);
    add(9, 20, 2, 2, '#c47b59');
  } else if (expression === 'scared') {
    openEyes(true);
    add(4, 6, 9, 2, ink); add(19, 6, 9, 2, ink);
    add(13, 21, 6, 8, ink);
    add(15, 23, 2, 4, blush);
    add(2, 18, 2, 3, tear);
  } else if (expression === 'angry') {
    openEyes();
    add(4, 7, 5, 2, ink); add(9, 9, 4, 2, ink);
    add(19, 9, 4, 2, ink); add(23, 7, 5, 2, ink);
    add(9, 22, 15, 5, ink);
    add(11, 22, 11, 2, white);
    add(13, 26, 7, 1, blush);
  } else if (expression === 'surprised') {
    openEyes(true);
    add(13, 21, 6, 8, ink);
    add(15, 23, 2, 4, blush);
    add(4, 6, 9, 2, ink); add(19, 6, 9, 2, ink);
  } else if (expression === 'wink') {
    add(4, 13, 3, 2, ink); add(7, 11, 5, 2, ink); add(12, 13, 2, 2, ink);
    add(19, 11, 9, 7, white);
    add(23, 12, 4, 5, iris); add(24, 13, 2, 4, pupil); add(24, 12, 1, 1, white);
    calmBrows();
    smile();
  } else {
    openEyes();
    calmBrows();
    if (expression === 'neutral') add(11, 23, 10, 2, ink);
    else if (expression === 'cool') add(12, 23, 8, 2, ink);
    else smile();
  }

  if (expression === 'happy' || expression === 'sad' || expression === 'scared' || expression === 'angry' || expression === 'surprised') {
    add(2, 20, 2, 2, blush);
    add(28, 20, 2, 2, blush);
  }

  const eyewear = glasses;
  if (eyewear !== 'none') {
    if (eyewear === 'sunglasses') {
      add(3, 10, 11, 9, '#263847');
      add(18, 10, 11, 9, '#263847');
      add(5, 11, 4, 2, '#8cb8c1');
      add(20, 11, 4, 2, '#8cb8c1');
      add(14, 13, 4, 2, ink);
      add(3, 9, 12, 2, ink); add(18, 9, 12, 2, ink);
      add(3, 10, 2, 9, ink); add(27, 10, 2, 9, ink);
      add(7, 18, 6, 2, ink); add(19, 18, 6, 2, ink);
    } else {
      // Square and round pixel frames use open centers so the textured eyes stay visible.
      add(5, 9, 8, 1, ink); add(4, 10, 1, 7, ink); add(5, 17, 8, 1, ink); add(13, 10, 1, 7, ink);
      add(19, 9, 8, 1, ink); add(18, 10, 1, 7, ink); add(19, 17, 8, 1, ink); add(27, 10, 1, 7, ink);
      add(13, 12, 6, 2, ink);
      if (eyewear === 'round') {
        add(5, 8, 2, 1, ink); add(11, 8, 2, 1, ink); add(5, 18, 2, 1, ink); add(11, 18, 2, 1, ink);
        add(19, 8, 2, 1, ink); add(25, 8, 2, 1, ink); add(19, 18, 2, 1, ink); add(25, 18, 2, 1, ink);
      }
    }
  }

  return pixels;
}

/** Paints the shared crisp face pixels into a square CanvasTexture. */
export function drawCharacterFace(
  context: CanvasRenderingContext2D,
  expression: CharacterExpression,
  glasses: CharacterGlasses = 'none',
) {
  const width = context.canvas.width;
  const height = context.canvas.height;
  const cellW = width / 32;
  const cellH = height / 32;
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = false;
  for (const pixel of characterFacePixels(expression, glasses)) {
    context.fillStyle = pixel.color;
    context.fillRect(pixel.x * cellW, pixel.y * cellH, pixel.width * cellW, pixel.height * cellH);
  }
}
