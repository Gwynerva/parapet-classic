/** Palette and small formatting helpers shared by the built-in UI screens. */

/** Palette shared by the menus (pixel-art friendly flat colours). */
export const Theme = {
  background: '#101418',
  panel: '#1b2129',
  panelBorder: '#3a4654',
  text: '#e8eef4',
  muted: '#8b98a8',
  accent: '#ffb000',
  accentDark: '#b87400',
  danger: '#ff5a4a',
  success: '#5ad27a',
  overlay: 'rgba(0, 0, 0, 0.6)',
} as const;

/** Format a game-clock time in ms as `m:ss.hh`. */
export function formatTime(ms: number): string {
  const total = Math.max(0, ms | 0);
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const hundredths = Math.floor((total % 1000) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}
