/** Drop the minimized flag for the window the user just asked to open. */
export function minimizedAfterFocus(
  minimized: Record<string, boolean>,
  requestedKey: string,
): Record<string, boolean> {
  if (!requestedKey || !minimized[requestedKey]) return minimized;
  return { ...minimized, [requestedKey]: false };
}
