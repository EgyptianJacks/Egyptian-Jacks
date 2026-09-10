import { MovementZone, ZoneRect } from '../types/movement';

/**
 * Resolves the physical viewport bounding rect for a given MovementZone and optional Card ID.
 */
export function resolveAnchorRect(
  zone: MovementZone,
  cardId?: string
): ZoneRect {
  if (typeof document !== 'undefined') {
    // 1. Try to find the exact specific card element first
    if (cardId) {
      const cardEl = document.querySelector(`[data-card-anchor="${cardId}"]`);
      if (cardEl) {
        const rect = cardEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          };
        }
      }
    }

    // 2. Try to find the zone container element
    const zoneEl = document.querySelector(`[data-zone-anchor="${zone}"]`);
    if (zoneEl) {
      const rect = zoneEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: rect.left + rect.width / 2 - 32,
          y: rect.top + rect.height / 2 - 48,
          width: 64,
          height: 96,
        };
      }
    }
  }

  // 3. Fallback positions based on screen dimensions
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
  const cardW = 64;
  const cardH = 96;

  switch (zone) {
    case 'DECK':
      return { x: vw / 2 - cardW / 2, y: vh * 0.35 - cardH / 2, width: cardW, height: cardH };
    case 'CPU_HAND':
      return { x: vw / 2 - cardW / 2, y: vh * 0.1 - cardH / 2, width: cardW, height: cardH };
    case 'PLAYER_HAND':
      return { x: vw / 2 - cardW / 2, y: vh * 0.85 - cardH / 2, width: cardW, height: cardH };
    case 'CPU_TABLE':
      return { x: vw * 0.4 - cardW / 2, y: vh * 0.45 - cardH / 2, width: cardW, height: cardH };
    case 'PLAYER_TABLE':
      return { x: vw * 0.6 - cardW / 2, y: vh * 0.45 - cardH / 2, width: cardW, height: cardH };
    case 'CPU_WINNING_PILE':
      return { x: vw * 0.15 - cardW / 2, y: vh * 0.35 - cardH / 2, width: cardW, height: cardH };
    case 'PLAYER_WINNING_PILE':
      return { x: vw * 0.85 - cardW / 2, y: vh * 0.55 - cardH / 2, width: cardW, height: cardH };
    default:
      return { x: vw / 2 - cardW / 2, y: vh / 2 - cardH / 2, width: cardW, height: cardH };
  }
}
