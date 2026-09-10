import { Card, PlayerId, Rank } from '../../types/game';
import {
  CanonicalMatchTimeline,
  CoachingEvidenceItem,
  DerivedTacticalMeaning,
  TacticalThread,
  TimelineActionRecord,
} from './yoyoCoachingTypes';

export interface TacticalAnalysisResult {
  primaryMeaning: DerivedTacticalMeaning;
  confidence: number;
  activeThread?: TacticalThread;
  allThreads: TacticalThread[];
  evidence: CoachingEvidenceItem[];
  historicalTurnReferences: number[];
  targetRank?: Rank;
  narrativeSummary: string;
}

export class YoyoNarrativeAnalyzer {
  private threads: Map<string, TacticalThread> = new Map();

  public reset(): void {
    this.threads.clear();
  }

  /**
   * Evaluates the latest action against the full match timeline sequentially.
   */
  public analyzeLatestAction(
    timeline: CanonicalMatchTimeline,
    latestAction: TimelineActionRecord
  ): TacticalAnalysisResult {
    const actor = latestAction.actor;
    const opponent: PlayerId = actor === 'player' ? 'cpu' : 'player';
    const card = latestAction.cardPlayed;
    const rank = card.rank;
    const isSteal = latestAction.isSteal;
    const capturedCards = latestAction.capturedCards;

    // 0. Ensure any untracked prior actions in timeline have their threads synchronized
    for (const priorAction of timeline.actions) {
      if (priorAction.sequence < latestAction.sequence) {
        const alreadyTracked = Array.from(this.threads.values()).some((t) =>
          t.evidenceActions.includes(priorAction.sequence)
        );
        if (!alreadyTracked) {
          this.updateThreadsWithAction(priorAction, timeline);
        }
      }
    }

    // 1. Update existing narrative threads or create new ones for the current action
    this.updateThreadsWithAction(latestAction, timeline);

    // 2. Check for the canonical 4-beat Set Recovery pattern (Section 22 Killer Scenario)
    const threadKey = `thread_set_${rank}_player`;
    const playerSetThread = this.threads.get(threadKey);

    if (
      actor === 'player' &&
      isSteal &&
      playerSetThread &&
      playerSetThread.status === 'BUILD_RECOVERED'
    ) {
      const evidence = this.collectThreadEvidence(playerSetThread, timeline);
      // Link causal relationship in canonical timeline
      if (playerSetThread.evidenceActions.length >= 2) {
        const lastActionSeq = playerSetThread.evidenceActions[playerSetThread.evidenceActions.length - 2];
        timeline.relationships.push({
          sourceActionSeq: lastActionSeq,
          targetActionSeq: latestAction.sequence,
          relation: 'RECOVERED',
          description: `Player recovered set build for ${rank} by stealing back from opponent pile.`,
        });
      }

      return {
        primaryMeaning: 'BUILD_RECOVERED',
        confidence: 0.95,
        activeThread: playerSetThread,
        allThreads: Array.from(this.threads.values()),
        evidence,
        historicalTurnReferences: playerSetThread.evidenceActions,
        targetRank: rank,
        narrativeSummary: `استعادة بناء مجموعة الـ${rank} بعد محاولة الخصم تعطيلها بسحبها من كومته!`,
      };
    }

    // 3. Check for Combo Formation (Golden, Silver, Iron, Double Combos)
    const latestCombos = timeline.combosFormed.filter((c) => c.sequence === latestAction.sequence);
    if (latestCombos.length > 0) {
      const combo = latestCombos[0];
      const evidence = this.createSingleActionEvidence(latestAction);
      return {
        primaryMeaning: 'COMBO_COMPLETION',
        confidence: 0.98,
        allThreads: Array.from(this.threads.values()),
        evidence,
        historicalTurnReferences: [latestAction.sequence],
        targetRank: rank,
        narrativeSummary: `${actor === 'player' ? 'أنت حققت' : 'الخصم حقق'} كومبو ${combo.comboType} بقيمة ${combo.points} نقطة!`,
      };
    }

    // 4. Check for Set Formation (Regular Set: 12 pts, Jack Set: 36 pts)
    if (latestAction.setsFormedThisAction.length > 0) {
      const setRank = latestAction.setsFormedThisAction[0];
      const matchingThread = this.threads.get(`thread_set_${setRank}_${actor}`);
      const evidence = matchingThread
        ? this.collectThreadEvidence(matchingThread, timeline)
        : this.createSingleActionEvidence(latestAction);

      return {
        primaryMeaning: 'SET_COMPLETION',
        confidence: 0.95,
        activeThread: matchingThread,
        allThreads: Array.from(this.threads.values()),
        evidence,
        historicalTurnReferences: matchingThread ? matchingThread.evidenceActions : [latestAction.sequence],
        targetRank: setRank,
        narrativeSummary: `${actor === 'player' ? 'أنت أكملت' : 'الخصم أكمل'} مجموعة الـ${setRank} كاملة (4 كروت)!`,
      };
    }

    // 5. Check for Opponent Disruption / Threat on an active player build
    if (actor === 'cpu' && capturedCards.some((c) => c.rank === rank)) {
      const existingPlayerThread = this.threads.get(`thread_set_${rank}_player`);
      if (
        existingPlayerThread &&
        existingPlayerThread.capturedRanksBySubject >= 2 &&
        existingPlayerThread.status === 'BUILD_INTERRUPTED'
      ) {
        const evidence = this.collectThreadEvidence(existingPlayerThread, timeline);
        if (existingPlayerThread.evidenceActions.length >= 2) {
          const priorActionSeq = existingPlayerThread.evidenceActions[existingPlayerThread.evidenceActions.length - 2];
          timeline.relationships.push({
            sourceActionSeq: priorActionSeq,
            targetActionSeq: latestAction.sequence,
            relation: 'INTERRUPTED',
            description: `Opponent interrupted player set build for ${rank}.`,
          });
        }

        return {
          primaryMeaning: 'BUILD_INTERRUPTED',
          confidence: 0.88,
          activeThread: existingPlayerThread,
          allThreads: Array.from(this.threads.values()),
          evidence,
          historicalTurnReferences: existingPlayerThread.evidenceActions,
          targetRank: rank,
          narrativeSummary: `الخصم حاول يقطع عليك بناء مجموعة الـ${rank} بأكل كرت منها!`,
        };
      }
    }

    // 6. Check for Player Building Set (2 or 3 cards of the same rank accumulated)
    if (actor === 'player' && playerSetThread && playerSetThread.capturedRanksBySubject >= 2) {
      const evidence = this.collectThreadEvidence(playerSetThread, timeline);
      return {
        primaryMeaning: 'PLAYER_BUILDING_SET',
        confidence: 0.85,
        activeThread: playerSetThread,
        allThreads: Array.from(this.threads.values()),
        evidence,
        historicalTurnReferences: playerSetThread.evidenceActions,
        targetRank: rank,
        narrativeSummary: `بناء متواصل لمجموعة الـ${rank}: تم تجميع ${playerSetThread.capturedRanksBySubject} كروت حتى الآن.`,
      };
    }

    // 6. Check for Steal Execution
    if (isSteal) {
      const evidence = this.createSingleActionEvidence(latestAction);
      return {
        primaryMeaning: 'STEAL_RECOVERY',
        confidence: 0.9,
        allThreads: Array.from(this.threads.values()),
        evidence,
        historicalTurnReferences: [latestAction.sequence],
        targetRank: rank,
        narrativeSummary: `سرقة الكومة برتبة ${rank}!`,
      };
    }

    // 7. Check for High-Value Capture
    if (capturedCards.length >= 2 || card.isJack) {
      const evidence = this.createSingleActionEvidence(latestAction);
      return {
        primaryMeaning: 'HIGH_VALUE_CAPTURE',
        confidence: 0.8,
        allThreads: Array.from(this.threads.values()),
        evidence,
        historicalTurnReferences: [latestAction.sequence],
        targetRank: rank,
        narrativeSummary: `أكلة قوية بعدد ${capturedCards.length} كروت برتبة ${rank}.`,
      };
    }

    // 8. Default: Routine play
    return {
      primaryMeaning: 'ROUTINE_PLAY',
      confidence: 0.5,
      allThreads: Array.from(this.threads.values()),
      evidence: [],
      historicalTurnReferences: [latestAction.sequence],
      narrativeSummary: 'نقلة عادية بدون تحول تكتيكي خاص.',
    };
  }

  private updateThreadsWithAction(
    action: TimelineActionRecord,
    timeline: CanonicalMatchTimeline
  ): void {
    const actor = action.actor;
    const opponent: PlayerId = actor === 'player' ? 'cpu' : 'player';
    const card = action.cardPlayed;
    const rank = card.rank;
    const capturedCards = action.capturedCards;
    const isSteal = action.isSteal;

    const ranksInvolved: Rank[] = [];
    if (action.winningPileAddedRanks.length > 0) {
      ranksInvolved.push(...action.winningPileAddedRanks);
    } else {
      ranksInvolved.push(rank);
    }

    const uniqueRanks = Array.from(new Set(ranksInvolved));

    for (const r of uniqueRanks) {
      const playerThreadKey = `thread_set_${r}_player`;
      let playerThread = this.threads.get(playerThreadKey);

      if (actor === 'player' && action.winningPileAddedRanks.includes(r)) {
        if (!playerThread) {
          playerThread = {
            id: playerThreadKey,
            type: r === 'J' ? 'JACK_SET_BUILD' : 'SET_BUILD',
            subject: 'player',
            targetRank: r,
            startedTurn: action.sequence,
            lastUpdatedTurn: action.sequence,
            evidenceActions: [action.sequence],
            capturedRanksBySubject: action.winningPileAddedRanks.filter((x) => x === r).length || 1,
            capturedRanksByOpponent: 0,
            status: 'ACTIVE',
            description: `تجميع مجموعة ${r}`,
          };
          this.threads.set(playerThreadKey, playerThread);
        } else {
          // If the player previously had their build interrupted by opponent, and now steals/recovers:
          if (isSteal && playerThread.status === 'BUILD_INTERRUPTED') {
            playerThread.status = 'BUILD_RECOVERED';
          }
          playerThread.capturedRanksBySubject += action.winningPileAddedRanks.filter((x) => x === r).length;
          playerThread.lastUpdatedTurn = action.sequence;
          if (!playerThread.evidenceActions.includes(action.sequence)) {
            playerThread.evidenceActions.push(action.sequence);
          }
        }
      } else if (actor === 'cpu' && action.winningPileAddedRanks.includes(r)) {
        // Opponent captured this rank!
        if (playerThread && playerThread.status === 'ACTIVE' && playerThread.capturedRanksBySubject >= 1) {
          playerThread.status = 'BUILD_INTERRUPTED';
          playerThread.capturedRanksByOpponent += action.winningPileAddedRanks.filter((x) => x === r).length;
          playerThread.lastUpdatedTurn = action.sequence;
          if (!playerThread.evidenceActions.includes(action.sequence)) {
            playerThread.evidenceActions.push(action.sequence);
          }
        }
      }
    }
  }

  private collectThreadEvidence(
    thread: TacticalThread,
    timeline: CanonicalMatchTimeline
  ): CoachingEvidenceItem[] {
    const evidenceItems: CoachingEvidenceItem[] = [];

    for (const seq of thread.evidenceActions) {
      const act = timeline.actions.find((a) => a.sequence === seq);
      if (!act) continue;

      let summary = '';
      if (act.isSteal) {
        summary = `${act.actor === 'player' ? 'أنت' : 'الخصم'} سرق كرت ${act.cardPlayed.rank} من كومة الفوز`;
      } else if (act.capturedCards.length > 0) {
        summary = `${act.actor === 'player' ? 'أنت' : 'الخصم'} أكل كرت ${act.cardPlayed.rank} من الطاولة`;
      } else {
        summary = `${act.actor === 'player' ? 'أنت' : 'الخصم'} لعب كرت ${act.cardPlayed.rank}`;
      }

      evidenceItems.push({
        turnNumber: act.sequence,
        actor: act.actor,
        actionSummary: summary,
        rank: act.cardPlayed.rank,
        cardId: act.cardPlayed.id,
        targetZone: act.isSteal
          ? (act.actor === 'player' ? 'OPPONENT_WINNING_PILE' : 'PLAYER_WINNING_PILE')
          : (act.actor === 'player' ? 'PLAYER_TABLE' : 'OPPONENT_TABLE'),
      });
    }

    return evidenceItems;
  }

  private createSingleActionEvidence(action: TimelineActionRecord): CoachingEvidenceItem[] {
    return [
      {
        turnNumber: action.sequence,
        actor: action.actor,
        actionSummary: action.isSteal
          ? 'سرقة الكومة برتبة ' + action.cardPlayed.rank
          : 'أكلة كروت برتبة ' + action.cardPlayed.rank,
        rank: action.cardPlayed.rank,
        cardId: action.cardPlayed.id,
        targetZone: action.isSteal
          ? (action.actor === 'player' ? 'OPPONENT_WINNING_PILE' : 'PLAYER_WINNING_PILE')
          : (action.actor === 'player' ? 'PLAYER_TABLE' : 'OPPONENT_TABLE'),
      },
    ];
  }

  public getThreads(): TacticalThread[] {
    return Array.from(this.threads.values());
  }
}
