import { Card, GameState, PlayerId, CaptureResult } from '../types/game';
import { CardMotionItem, MovementSequence, MovementZone } from '../types/movement';

/**
 * Generates the movement sequence for an Initial Deal or Replenish Deal.
 */
export function generateDealSequence(
  dealNumber: number,
  playerHand: Card[],
  cpuHand: Card[],
  playerTable: Card[] = [],
  cpuTable: Card[] = []
): MovementSequence {
  const items: CardMotionItem[] = [];
  let delay = 0;
  const STAGGER = 28;
  const DURATION = 200;

  // If Initial Deal (Deal #1), deal to table stacks first
  if (dealNumber === 1 && (playerTable.length > 0 || cpuTable.length > 0)) {
    playerTable.forEach((card, idx) => {
      items.push({
        id: `move_deal_ptable_${card.id}_${idx}`,
        card,
        faceDown: false,
        originZone: 'DECK',
        destinationZone: 'PLAYER_TABLE',
        destinationCardId: card.id,
        stage: 0,
        durationMs: DURATION,
        delayMs: delay,
        rotationDeg: (idx - 0.5) * 1.5,
      });
      delay += STAGGER;
    });

    cpuTable.forEach((card, idx) => {
      items.push({
        id: `move_deal_ctable_${card.id}_${idx}`,
        card,
        faceDown: false,
        originZone: 'DECK',
        destinationZone: 'CPU_TABLE',
        destinationCardId: card.id,
        stage: 0,
        durationMs: DURATION,
        delayMs: delay,
        rotationDeg: (idx - 0.5) * -1.5,
      });
      delay += STAGGER;
    });
  }

  // Deal to Player Hand
  playerHand.forEach((card, idx) => {
    items.push({
      id: `move_deal_phand_${card.id}_${idx}`,
      card,
      faceDown: false,
      originZone: 'DECK',
      destinationZone: 'PLAYER_HAND',
      destinationCardId: card.id,
      stage: 0,
      durationMs: DURATION,
      delayMs: delay,
      rotationDeg: (idx - 1.5) * 1.5,
    });
    delay += STAGGER;
  });

  // Deal to CPU Hand (Facedown)
  cpuHand.forEach((card, idx) => {
    items.push({
      id: `move_deal_chand_${card.id}_${idx}`,
      card,
      faceDown: true,
      originZone: 'DECK',
      destinationZone: 'CPU_HAND',
      stage: 0,
      durationMs: DURATION,
      delayMs: delay,
      rotationDeg: (idx - 1.5) * -1.5,
    });
    delay += STAGGER;
  });

  return {
    id: `seq_deal_${dealNumber}_${Date.now()}`,
    type: 'DEAL',
    actor: 'SYSTEM',
    description: `Deal #${dealNumber} in progress`,
    items,
    totalStages: 1,
    currentStage: 0,
  };
}

/**
 * Generates the movement sequence for a played card (Player or CPU).
 */
export function generatePlayCardSequence(
  actor: PlayerId,
  playedCard: Card,
  captureResult: CaptureResult
): MovementSequence {
  const originHand: MovementZone = actor === 'player' ? 'PLAYER_HAND' : 'CPU_HAND';
  const myTable: MovementZone = actor === 'player' ? 'PLAYER_TABLE' : 'CPU_TABLE';
  const oppTable: MovementZone = actor === 'player' ? 'CPU_TABLE' : 'PLAYER_TABLE';
  const myWonPile: MovementZone = actor === 'player' ? 'PLAYER_WINNING_PILE' : 'CPU_WINNING_PILE';
  const oppWonPile: MovementZone = actor === 'player' ? 'CPU_WINNING_PILE' : 'PLAYER_WINNING_PILE';

  const items: CardMotionItem[] = [];

  // 1. NO CAPTURE -> Discard to player's table stack
  if (captureResult.capturedCards.length === 0) {
    items.push({
      id: `move_play_discard_${playedCard.id}`,
      card: playedCard,
      faceDown: false,
      originZone: originHand,
      originCardId: playedCard.id,
      destinationZone: myTable,
      stage: 0,
      durationMs: 190,
      delayMs: 0,
      rotationDeg: actor === 'player' ? 1.5 : -1.5,
    });

    return {
      id: `seq_play_discard_${playedCard.id}_${Date.now()}`,
      type: 'PLAY_DISCARD',
      actor,
      description: `${actor === 'player' ? 'You' : 'CPU'} placed ${playedCard.rank}${playedCard.suit} on table`,
      items,
      totalStages: 1,
      currentStage: 0,
    };
  }

  // 2. CAPTURE (Table Match, Winning Pile Steal, or Multi-Source Capture)
  // STAGE 0: Played card flies from Hand to strike the target area
  let strikeTargetZone: MovementZone = oppTable;
  if (captureResult.capturedFrom === 'WINNING_PILE') {
    strikeTargetZone = oppWonPile;
  } else if (captureResult.capturedFrom === 'PLAYER_TABLE') {
    strikeTargetZone = myTable;
  }

  items.push({
    id: `move_cap_strike_${playedCard.id}`,
    card: playedCard,
    faceDown: false,
    originZone: originHand,
    originCardId: playedCard.id,
    destinationZone: strikeTargetZone,
    stage: 0,
    durationMs: 165,
    delayMs: 0,
    rotationDeg: actor === 'player' ? 2 : -2,
  });

  // STAGE 1: Played card + all captured cards fly from their true origins to active player's winning pile!
  const matchedCards = captureResult.capturedCards.filter((c) => c.id !== playedCard.id);
  let stage1Delay = 0;
  const CAPTURE_STAGGER = 20;

  // Played card flies from strike location to won pile
  items.push({
    id: `move_cap_collect_played_${playedCard.id}`,
    card: playedCard,
    faceDown: false,
    originZone: strikeTargetZone,
    destinationZone: myWonPile,
    stage: 1,
    durationMs: 210,
    delayMs: stage1Delay,
    rotationDeg: 1.5,
  });
  stage1Delay += CAPTURE_STAGGER;

  // Each captured card flies from its exact physical origin zone to player won pile
  matchedCards.forEach((card, idx) => {
    let cardOriginZone: MovementZone = oppTable;

    const originInfo = captureResult.capturedWithOrigins?.find((o) => o.card.id === card.id);
    if (originInfo) {
      if (originInfo.source === 'PLAYER_TABLE') {
        cardOriginZone = myTable;
      } else if (originInfo.source === 'OPPONENT_TABLE') {
        cardOriginZone = oppTable;
      } else if (originInfo.source === 'WINNING_PILE') {
        cardOriginZone = oppWonPile;
      }
    } else {
      if (captureResult.capturedFrom === 'PLAYER_TABLE') {
        cardOriginZone = myTable;
      } else if (captureResult.capturedFrom === 'WINNING_PILE') {
        cardOriginZone = oppWonPile;
      }
    }

    items.push({
      id: `move_cap_collect_matched_${card.id}_${idx}`,
      card,
      faceDown: false,
      originZone: cardOriginZone,
      originCardId: card.id,
      destinationZone: myWonPile,
      stage: 1,
      durationMs: 210,
      delayMs: stage1Delay,
      rotationDeg: ((idx % 3) - 1) * 2,
    });
    stage1Delay += CAPTURE_STAGGER;
  });

  const isPureSteal =
    captureResult.capturedFrom === 'WINNING_PILE' ||
    (captureResult.isTopUniformCapture && captureResult.sources?.length === 1);

  return {
    id: `seq_cap_${playedCard.id}_${Date.now()}`,
    type: isPureSteal ? 'CAPTURE_STEAL' : 'CAPTURE_MATCH',
    actor,
    description: `${actor === 'player' ? 'You' : 'CPU'} captured ${captureResult.capturedCards.length} card(s)`,
    items,
    totalStages: 2,
    currentStage: 0,
  };
}
