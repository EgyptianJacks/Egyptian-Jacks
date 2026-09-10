import { Card, GameState, PlayerId, Rank } from '../types/game';
import { calculateScores } from './rules';
import {
  BoardSnapshotSummary,
  CanonicalEventType,
  CanonicalMatchTimeline,
  CanonicalTimelineEvent,
  ComboFormationRecord,
  ComboType,
  SetFormationRecord,
  TacticalRelationship,
  TacticalRelationshipType,
  TimelineActionRecord,
  TimelineDealRecord,
} from '../character/brain/yoyoCoachingTypes';

/**
 * Creates a lean board snapshot from GameState.
 */
export function createBoardSnapshot(state: GameState): BoardSnapshotSummary {
  const playerTopWinningCard =
    state.playerWinningPile.length > 0
      ? state.playerWinningPile[state.playerWinningPile.length - 1]
      : undefined;
  const cpuTopWinningCard =
    state.cpuWinningPile.length > 0
      ? state.cpuWinningPile[state.cpuWinningPile.length - 1]
      : undefined;

  return {
    playerHandCardIds: state.playerHand.map((c) => c.id),
    cpuHandCount: state.cpuHand.length,
    playerTableCards: state.table.playerTable.map((c) => ({ ...c })),
    opponentTableCards: state.table.opponentTable.map((c) => ({ ...c })),
    playerWinningPileCount: state.playerWinningPile.length,
    cpuWinningPileCount: state.cpuWinningPile.length,
    playerTopWinningCard: playerTopWinningCard ? { ...playerTopWinningCard } : undefined,
    cpuTopWinningCard: cpuTopWinningCard ? { ...cpuTopWinningCard } : undefined,
  };
}

/**
 * MatchTimelineRecorder
 * Pure, canonical chronological recorder of 100% of match history.
 * Does NOT filter or pre-judge events.
 */
export class MatchTimelineRecorder {
  private timeline: CanonicalMatchTimeline;

  constructor(matchId: string = `match_${Date.now()}`, seed: number = 1, initialGameState?: GameState) {
    const initialDeal: TimelineDealRecord = {
      dealNumber: 1,
      playerHandCards: initialGameState ? initialGameState.playerHand.map((c) => ({ ...c })) : [],
      cpuHandCardsKnown: initialGameState ? initialGameState.cpuHand.map((c) => ({ ...c })) : [],
      playerTableCards: initialGameState ? initialGameState.table.playerTable.map((c) => ({ ...c })) : [],
      opponentTableCards: initialGameState ? initialGameState.table.opponentTable.map((c) => ({ ...c })) : [],
      timestamp: Date.now(),
    };

    this.timeline = {
      matchId,
      seed,
      initialDeal,
      subsequentDeals: [],
      actions: [],
      events: [],
      setsFormed: [],
      combosFormed: [],
      relationships: [],
      milestones: {},
      startTime: Date.now(),
    };

    // Emit initial lifecycle events
    this.emitEvent('MATCH_STARTED', 'SYSTEM', { matchId, seed });
    if (initialGameState) {
      this.emitEvent('DEAL_INITIAL', 'SYSTEM', {
        dealNumber: 1,
        playerHandCount: initialGameState.playerHand.length,
        playerTableCount: initialGameState.table.playerTable.length,
        opponentTableCount: initialGameState.table.opponentTable.length,
      });
    }
  }

  public emitEvent(
    type: CanonicalEventType,
    actor?: PlayerId | 'SYSTEM',
    details: Record<string, unknown> = {}
  ): CanonicalTimelineEvent {
    const sequence = this.timeline.events.length + 1;
    const event: CanonicalTimelineEvent = {
      id: `ev_${sequence}_${type}_${Date.now()}`,
      type,
      sequence,
      timestamp: Date.now(),
      actor,
      details,
    };
    this.timeline.events.push(event);
    return event;
  }

  public recordReplenishDeal(
    dealNumber: number,
    playerHand: Card[],
    cpuHand: Card[],
    playerTable: Card[],
    opponentTable: Card[]
  ): void {
    const record: TimelineDealRecord = {
      dealNumber,
      playerHandCards: playerHand.map((c) => ({ ...c })),
      cpuHandCardsKnown: cpuHand.map((c) => ({ ...c })),
      playerTableCards: playerTable.map((c) => ({ ...c })),
      opponentTableCards: opponentTable.map((c) => ({ ...c })),
      timestamp: Date.now(),
    };
    this.timeline.subsequentDeals.push(record);

    this.emitEvent('REPLENISH_DEALT', 'SYSTEM', {
      dealNumber,
      playerHandCount: playerHand.length,
      cpuHandCount: cpuHand.length,
    });
  }

  public recordSetFormation(
    rank: Rank,
    actor: PlayerId,
    isJackSet: boolean,
    sequence: number
  ): SetFormationRecord {
    const record: SetFormationRecord = {
      rank,
      actor,
      isJackSet,
      points: isJackSet ? 36 : 12,
      sequence,
      timestamp: Date.now(),
    };
    this.timeline.setsFormed.push(record);

    this.emitEvent(isJackSet ? 'JACK_SET_FORMED' : 'SET_FORMED', actor, {
      rank,
      isJackSet,
      points: record.points,
      sequence,
    });

    return record;
  }

  public recordComboFormation(
    comboType: ComboType,
    actor: PlayerId,
    points: number,
    sequence: number
  ): ComboFormationRecord {
    const record: ComboFormationRecord = {
      comboType,
      actor,
      points,
      sequence,
      timestamp: Date.now(),
    };
    this.timeline.combosFormed.push(record);

    this.emitEvent('COMBO_FORMED', actor, {
      comboType,
      points,
      sequence,
    });

    if (!this.timeline.milestones.firstComboTurn) {
      this.timeline.milestones.firstComboTurn = sequence;
    }

    return record;
  }

  public recordAction(
    actor: PlayerId,
    cardPlayed: Card,
    prevState: GameState,
    nextState: GameState
  ): TimelineActionRecord {
    const sequence = this.timeline.actions.length + 1;
    const latestAction = nextState.actionHistory[nextState.actionHistory.length - 1];
    const captureResult = latestAction?.captureResult;
    const capturedCards = captureResult ? [...captureResult.capturedCards] : [];
    const isSteal = Boolean(captureResult?.isTopUniformCapture);
    const isDirectCapture = capturedCards.length > 0 && !isSteal;

    const stateBefore = createBoardSnapshot(prevState);
    const stateAfter = createBoardSnapshot(nextState);

    // Track winning pile additions
    const addedRanks: Rank[] = [];
    if (actor === 'player') {
      const addedCount = nextState.playerWinningPile.length - prevState.playerWinningPile.length;
      if (addedCount > 0) {
        const newlyAdded = nextState.playerWinningPile.slice(-addedCount);
        addedRanks.push(...newlyAdded.map((c) => c.rank));
      }
    } else {
      const addedCount = nextState.cpuWinningPile.length - prevState.cpuWinningPile.length;
      if (addedCount > 0) {
        const newlyAdded = nextState.cpuWinningPile.slice(-addedCount);
        addedRanks.push(...newlyAdded.map((c) => c.rank));
      }
    }

    // Determine target location
    let targetLocation: 'PLAYER_TABLE' | 'OPPONENT_TABLE' | 'WINNING_PILE' | undefined = undefined;
    if (isSteal) {
      targetLocation = 'WINNING_PILE';
    } else if (capturedCards.length > 0) {
      targetLocation = 'OPPONENT_TABLE';
    } else {
      targetLocation = actor === 'player' ? 'PLAYER_TABLE' : 'OPPONENT_TABLE';
    }

    // Check sets formed
    const prevPile = actor === 'player' ? prevState.playerWinningPile : prevState.cpuWinningPile;
    const nextPile = actor === 'player' ? nextState.playerWinningPile : nextState.cpuWinningPile;
    const prevRankCounts: Record<string, number> = {};
    const nextRankCounts: Record<string, number> = {};
    for (const c of prevPile) prevRankCounts[c.rank] = (prevRankCounts[c.rank] || 0) + 1;
    for (const c of nextPile) nextRankCounts[c.rank] = (nextRankCounts[c.rank] || 0) + 1;

    const setsFormedThisAction: Rank[] = [];
    for (const r of Object.keys(nextRankCounts) as Rank[]) {
      if ((nextRankCounts[r] || 0) === 4 && (prevRankCounts[r] || 0) < 4) {
        setsFormedThisAction.push(r);
      }
    }

    const actionRecord: TimelineActionRecord = {
      sequence,
      turnNumber: sequence,
      actor,
      cardPlayed: { ...cardPlayed },
      targetLocation,
      capturedCards,
      isSteal,
      isDirectCapture,
      stateBefore,
      stateAfter,
      winningPileAddedRanks: addedRanks,
      setsFormedThisAction,
      timestamp: Date.now(),
    };

    this.timeline.actions.push(actionRecord);

    // Emit granular timeline events
    this.emitEvent('CARD_PLAYED', actor, {
      cardId: cardPlayed.id,
      rank: cardPlayed.rank,
      suit: cardPlayed.suit,
      sequence,
    });

    if (isSteal) {
      this.emitEvent('STEAL_EXECUTED', actor, {
        stolenRank: cardPlayed.rank,
        stolenCount: capturedCards.length,
        sequence,
      });
      this.emitEvent('WINNING_PILE_UPDATED', actor, {
        addedRanks,
        newCount: actor === 'player' ? nextState.playerWinningPile.length : nextState.cpuWinningPile.length,
        sequence,
      });
    } else if (isDirectCapture) {
      this.emitEvent('CAPTURE_EXECUTED', actor, {
        capturedCardsCount: capturedCards.length,
        capturedRanks: capturedCards.map((c) => c.rank),
        sequence,
      });
      this.emitEvent('WINNING_PILE_UPDATED', actor, {
        addedRanks,
        newCount: actor === 'player' ? nextState.playerWinningPile.length : nextState.cpuWinningPile.length,
        sequence,
      });
    } else {
      this.emitEvent('PILE_UPDATED', actor, {
        targetLocation,
        cardId: cardPlayed.id,
        sequence,
      });
    }

    // Record individual sets formed via dedicated canonical method
    for (const setRank of setsFormedThisAction) {
      this.recordSetFormation(setRank, actor, setRank === 'J', sequence);
    }

    // Detect and record newly formed combos
    const prevWinning = actor === 'player' ? prevState.playerWinningPile : prevState.cpuWinningPile;
    const nextWinning = actor === 'player' ? nextState.playerWinningPile : nextState.cpuWinningPile;
    const prevScores = calculateScores(prevWinning, actor);
    const nextScores = calculateScores(nextWinning, actor);

    if (nextScores.goldenCombos > prevScores.goldenCombos) {
      for (let i = 0; i < nextScores.goldenCombos - prevScores.goldenCombos; i++) {
        this.recordComboFormation('GOLDEN_COMBO', actor, 75, sequence);
      }
    }
    if (nextScores.silverCombos > prevScores.silverCombos) {
      for (let i = 0; i < nextScores.silverCombos - prevScores.silverCombos; i++) {
        this.recordComboFormation('SILVER_COMBO', actor, 60, sequence);
      }
    }
    if (nextScores.ironCombos > prevScores.ironCombos) {
      for (let i = 0; i < nextScores.ironCombos - prevScores.ironCombos; i++) {
        this.recordComboFormation('IRON_COMBO', actor, 50, sequence);
      }
    }
    if (nextScores.doubleCombos > prevScores.doubleCombos) {
      for (let i = 0; i < nextScores.doubleCombos - prevScores.doubleCombos; i++) {
        this.recordComboFormation('DOUBLE_COMBO', actor, 30, sequence);
      }
    }

    // Update milestones
    if (isDirectCapture && !this.timeline.milestones.firstCaptureTurn) {
      this.timeline.milestones.firstCaptureTurn = sequence;
    }
    if (isSteal && !this.timeline.milestones.firstStealTurn) {
      this.timeline.milestones.firstStealTurn = sequence;
    }
    if (setsFormedThisAction.length > 0 && !this.timeline.milestones.firstSetTurn) {
      this.timeline.milestones.firstSetTurn = sequence;
    }

    return actionRecord;
  }

  public recordRawAction(
    data: Omit<TimelineActionRecord, 'sequence' | 'timestamp'> & { sequence?: number; timestamp?: number }
  ): TimelineActionRecord {
    const sequence = data.sequence ?? this.timeline.actions.length + 1;
    const timestamp = data.timestamp ?? Date.now();

    const actionRecord: TimelineActionRecord = {
      ...data,
      sequence,
      timestamp,
    };

    this.timeline.actions.push(actionRecord);

    if (actionRecord.isSteal) {
      this.emitEvent('STEAL_EXECUTED', actionRecord.actor, {
        cardPlayed: actionRecord.cardPlayed.rank,
        sequence,
      });
    } else if (actionRecord.capturedCards.length > 0) {
      this.emitEvent('CAPTURE_EXECUTED', actionRecord.actor, {
        capturedCardsCount: actionRecord.capturedCards.length,
        capturedRanks: actionRecord.capturedCards.map((c) => c.rank),
        sequence,
      });
    }

    for (const setRank of actionRecord.setsFormedThisAction) {
      this.recordSetFormation(setRank, actionRecord.actor, setRank === 'J', sequence);
    }

    return actionRecord;
  }

  public recordRoundEnd(playerScore: number, cpuScore: number, sequence: number): void {
    this.emitEvent('ROUND_ENDED', 'SYSTEM', {
      playerScore,
      cpuScore,
      sequence,
    });
  }

  public recordMatchEnd(playerScore: number, cpuScore: number, winner: PlayerId | 'DRAW'): void {
    this.timeline.endTime = Date.now();
    this.emitEvent('MATCH_ENDED', 'SYSTEM', {
      playerScore,
      cpuScore,
      winner,
    });
  }

  public addRelationship(
    sourceActionSeq: number,
    targetActionSeq: number,
    relation: TacticalRelationshipType,
    description: string
  ): TacticalRelationship {
    const rel: TacticalRelationship = {
      sourceActionSeq,
      targetActionSeq,
      relation,
      description,
    };
    this.timeline.relationships.push(rel);
    return rel;
  }

  /**
   * Information Boundary Guard:
   * Returns only player-visible historical evidence without exposing hidden opponent cards in hand.
   */
  public getPlayerVisibleEvidence(): ReadonlyArray<TimelineActionRecord> {
    return this.timeline.actions.map((act) => ({
      ...act,
      // Ensure opponent hand contents are never leaked in visible evidence
      stateBefore: {
        ...act.stateBefore,
      },
      stateAfter: {
        ...act.stateAfter,
      },
    }));
  }

  public getTimeline(): Readonly<CanonicalMatchTimeline> {
    return this.timeline;
  }

  public getActions(): ReadonlyArray<TimelineActionRecord> {
    return this.timeline.actions;
  }

  public getEvents(): ReadonlyArray<CanonicalTimelineEvent> {
    return this.timeline.events;
  }

  public getSetsFormed(): ReadonlyArray<SetFormationRecord> {
    return this.timeline.setsFormed;
  }

  public getCombosFormed(): ReadonlyArray<ComboFormationRecord> {
    return this.timeline.combosFormed;
  }

  public getActionsForRank(rank: Rank): TimelineActionRecord[] {
    return this.timeline.actions.filter(
      (a) =>
        a.cardPlayed.rank === rank ||
        a.capturedCards.some((c) => c.rank === rank) ||
        a.winningPileAddedRanks.includes(rank)
    );
  }

  public getActionsByActor(actor: PlayerId): TimelineActionRecord[] {
    return this.timeline.actions.filter((a) => a.actor === actor);
  }

  public getInitialDeal(): TimelineDealRecord {
    return this.timeline.initialDeal;
  }

  public getLatestAction(): TimelineActionRecord | undefined {
    return this.timeline.actions[this.timeline.actions.length - 1];
  }
}

