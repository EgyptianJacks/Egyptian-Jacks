import {
  Card,
  CpuDifficulty,
  GameAction,
  GameEvent,
  GamePhase,
  GameState,
  PlayerId,
} from '../types/game';
import { prepareRoundDeck } from './deck';
import { decideCpuMove } from './cpu';
import { calculateScores, evaluateCapture } from './rules';

export function createInitialGame(
  seed: number = Date.now(),
  firstPlayer: PlayerId = 'player',
  manualCutIndex?: number,
  customDeck?: Card[]
): GameState {
  const prepared = customDeck
    ? {
        deck: customDeck.map((c) => ({ ...c })),
        cutIndex: 0,
        revealedBottomCard: { ...customDeck[customDeck.length - 1] },
      }
    : prepareRoundDeck(seed, manualCutIndex);
  const shuffled = prepared.deck;

  // Initial deal:
  // Player: 4 cards
  // CPU: 4 cards
  // Player Table: 2 cards
  // CPU/Opponent Table: 2 cards
  // Remaining Deck: 40 cards
  const playerHand = shuffled.slice(0, 4);
  const cpuHand = shuffled.slice(4, 8);
  const playerTable = shuffled.slice(8, 10);
  const opponentTable = shuffled.slice(10, 12);
  const remainingDeck = shuffled.slice(12);

  const initEvent: GameEvent = {
    id: `ev_init_${seed}`,
    timestamp: Date.now(),
    actor: 'SYSTEM',
    type: 'DEAL',
    message: `بدأت الجولة! البداية مع ${firstPlayer === 'player' ? 'أنت' : 'الخصم'}. كُشفت آخر ورقة في الرزمة (${prepared.revealedBottomCard.rank}${prepared.revealedBottomCard.suit}).`,
  };

  return {
    matchId: `match-${seed}`,
    seed,
    firstPlayer,
    revealedLastCard: prepared.revealedBottomCard,
    cutIndex: prepared.cutIndex,
    deck: remainingDeck,
    playerHand,
    cpuHand,
    table: {
      playerTable,
      opponentTable,
      viewMode: 'INITIAL_VIEW',
    },
    playerWinningPile: [],
    cpuWinningPile: [],
    activeTurn: firstPlayer,
    phase: firstPlayer === 'player' ? 'PLAYER_TURN' : 'CPU_TURN',
    roundNumber: 1,
    dealNumber: 1,
    latestEvent: initEvent,
    eventLog: [initEvent],
    actionHistory: [],
    playerScore: null,
    cpuScore: null,
    winner: null,
  };
}

/**
 * Executes a human player's card play action.
 */
export function playPlayerCard(state: GameState, cardId: string): GameState {
  if (state.phase !== 'PLAYER_TURN' || state.activeTurn !== 'player') {
    throw new Error(`Cannot play card: Active turn is ${state.activeTurn}, phase is ${state.phase}`);
  }

  const cardIndex = state.playerHand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error(`Card ${cardId} is not in player hand`);
  }

  const playedCard = state.playerHand[cardIndex];
  const newPlayerHand = [
    ...state.playerHand.slice(0, cardIndex),
    ...state.playerHand.slice(cardIndex + 1),
  ];

  // Evaluate capture against Opponent Table and CPU Winning Pile
  const {
    captureResult,
    updatedPlayerTable,
    updatedOpponentTable,
    updatedOpponentWinningPile,
  } = evaluateCapture(
    playedCard,
    state.table.playerTable,
    state.table.opponentTable,
    state.cpuWinningPile,
    state.table.viewMode
  );

  let newPlayerWinningPile = [...state.playerWinningPile];

  if (captureResult.capturedCards.length > 0) {
    newPlayerWinningPile.push(...captureResult.capturedCards);
  }

  const actionSequence = state.actionHistory.length + 1;
  const event: GameEvent = {
    id: `ev_p_${actionSequence}_${Date.now()}`,
    timestamp: Date.now(),
    actor: 'player',
    type: captureResult.capturedCards.length > 0 ? 'CAPTURE' : 'PLAY_CARD',
    message: captureResult.description,
    card: playedCard,
    capturedCards: captureResult.capturedCards,
    source: captureResult.capturedFrom,
  };

  const action: GameAction = {
    sequence: actionSequence,
    actor: 'player',
    cardId: playedCard.id,
    timestamp: Date.now(),
    captureResult,
    resultingPhase: 'CPU_TURN',
  };

  const intermediateState: GameState = {
    ...state,
    playerHand: newPlayerHand,
    table: {
      playerTable: updatedPlayerTable,
      opponentTable: updatedOpponentTable,
      viewMode: 'NORMAL_VIEW', // Transitions to Normal View after first player action
    },
    playerWinningPile: newPlayerWinningPile,
    cpuWinningPile: updatedOpponentWinningPile,
    activeTurn: 'cpu',
    phase: 'CPU_TURN',
    latestEvent: event,
    eventLog: [event, ...state.eventLog],
    actionHistory: [...state.actionHistory, action],
  };

  return checkReplenishOrEnd(intermediateState);
}

/**
 * Executes the CPU player's turn deterministically based on chosen difficulty.
 */
export function executeCpuTurn(state: GameState, difficulty: CpuDifficulty = 'HARD'): GameState {
  if (state.phase !== 'CPU_TURN' || state.activeTurn !== 'cpu') {
    throw new Error(`Cannot execute CPU turn: Active turn is ${state.activeTurn}, phase is ${state.phase}`);
  }

  if (state.cpuHand.length === 0) {
    return checkReplenishOrEnd(state);
  }

  const decision = decideCpuMove(
    state.cpuHand,
    state.table.playerTable,
    state.table.opponentTable,
    state.playerWinningPile,
    state.table.viewMode,
    difficulty
  );

  const playedCard = decision.card;
  const newCpuHand = state.cpuHand.filter((c) => c.id !== playedCard.id);

  const {
    captureResult,
    updatedPlayerTable: newCpuTable,
    updatedOpponentTable: newPlayerTable,
    updatedOpponentWinningPile: newPlayerWinningPile,
  } = decision.captureResolution;

  let newCpuWinningPile = [...state.cpuWinningPile];

  if (captureResult.capturedCards.length > 0) {
    newCpuWinningPile.push(...captureResult.capturedCards);
  }

  const actionSequence = state.actionHistory.length + 1;
  const event: GameEvent = {
    id: `ev_cpu_${actionSequence}_${Date.now()}`,
    timestamp: Date.now(),
    actor: 'cpu',
    type: captureResult.capturedCards.length > 0 ? 'CAPTURE' : 'PLAY_CARD',
    message: `الخصم: ${captureResult.description}`,
    card: playedCard,
    capturedCards: captureResult.capturedCards,
    source: captureResult.capturedFrom,
  };

  const action: GameAction = {
    sequence: actionSequence,
    actor: 'cpu',
    cardId: playedCard.id,
    timestamp: Date.now(),
    captureResult,
    resultingPhase: 'PLAYER_TURN',
  };

  const intermediateState: GameState = {
    ...state,
    cpuHand: newCpuHand,
    table: {
      playerTable: newPlayerTable,
      opponentTable: newCpuTable,
      viewMode: 'NORMAL_VIEW',
    },
    playerWinningPile: newPlayerWinningPile,
    cpuWinningPile: newCpuWinningPile,
    activeTurn: 'player',
    phase: 'PLAYER_TURN',
    latestEvent: event,
    eventLog: [event, ...state.eventLog],
    actionHistory: [...state.actionHistory, action],
  };

  return checkReplenishOrEnd(intermediateState);
}

/**
 * Checks whether to deal subsequent 4-card hands or finalize the match upon deck exhaustion.
 */
export function checkReplenishOrEnd(state: GameState): GameState {
  const bothHandsEmpty = state.playerHand.length === 0 && state.cpuHand.length === 0;

  if (!bothHandsEmpty) {
    return state;
  }

  // If cards remain in deck (at least 8 for 4 each)
  if (state.deck.length >= 8) {
    const nextPlayerHand = state.deck.slice(0, 4);
    const nextCpuHand = state.deck.slice(4, 8);
    const remainingDeck = state.deck.slice(8);
    const nextDealNumber = state.dealNumber + 1;

    // If this is the final deal (remainingDeck is now empty), the last card dealt is nextCpuHand[3]
    const actualLastDealtCard = remainingDeck.length === 0 ? nextCpuHand[3] : state.actualLastDealtCard;

    const replenishEvent: GameEvent = {
      id: `ev_rep_${nextDealNumber}_${Date.now()}`,
      timestamp: Date.now(),
      actor: 'SYSTEM',
      type: 'REPLENISH',
      message: `التوزيع رقم #${nextDealNumber}: تم توزيع 4 أوراق لكل لاعب (${remainingDeck.length} ورقة متبقية في الرزمة).`,
    };

    return {
      ...state,
      deck: remainingDeck,
      playerHand: nextPlayerHand,
      cpuHand: nextCpuHand,
      actualLastDealtCard,
      dealNumber: nextDealNumber,
      activeTurn: state.firstPlayer,
      phase: state.firstPlayer === 'player' ? 'PLAYER_TURN' : 'CPU_TURN',
      latestEvent: replenishEvent,
      eventLog: [replenishEvent, ...state.eventLog],
    };
  }

  // Deck is exhausted and all hands are empty -> Match Conclusion (Canonical: No Final Sweep)
  const playerScore = calculateScores(state.playerWinningPile, 'player');
  const cpuScore = calculateScores(state.cpuWinningPile, 'cpu');

  let winner: PlayerId | 'DRAW' = 'DRAW';
  if (playerScore.totalScore > cpuScore.totalScore) {
    winner = 'player';
  } else if (cpuScore.totalScore > playerScore.totalScore) {
    winner = 'cpu';
  }

  const endEvent: GameEvent = {
    id: `ev_end_${Date.now()}`,
    timestamp: Date.now(),
    actor: 'SYSTEM',
    type: 'ROUND_END',
    message: `انتهت المباراة! النتيجة النهائية: أنت ${playerScore.totalScore} - الخصم ${cpuScore.totalScore}.`,
  };

  return {
    ...state,
    deck: [],
    playerHand: [],
    cpuHand: [],
    phase: 'MATCH_END',
    playerScore,
    cpuScore,
    winner,
    latestEvent: endEvent,
    eventLog: [endEvent, ...state.eventLog],
  };
}
