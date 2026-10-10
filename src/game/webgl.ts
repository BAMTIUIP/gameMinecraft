/**
 * Probe the same WebGL 2 API that three.js r163+ requires before constructing the renderer.
 * The temporary context is explicitly released so it does not compete with the game's renderer.
 */
type ContextLossExtension = { loseContext: () => void };
type WebGL2ProbeContext = {
  getExtension: (name: string) => ContextLossExtension | null;
};
type ProbeCanvas = {
  getContext: (name: string) => WebGL2ProbeContext | null;
};

export function canCreateWebGL2Context(
  createCanvas: () => ProbeCanvas = () => document.createElement('canvas') as unknown as ProbeCanvas,
  webGL2ConstructorAvailable = typeof WebGL2RenderingContext !== 'undefined',
): boolean {
  if (!webGL2ConstructorAvailable) return false;

  try {
    const context = createCanvas().getContext('webgl2');
    if (!context) return false;

    // The detached probe canvas is only a feature test. Free its GPU context before three.js mounts.
    try {
      context.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      // A working context is enough to pass the feature test if a browser blocks this extension.
    }
    return true;
  } catch {
    return false;
  }
}
