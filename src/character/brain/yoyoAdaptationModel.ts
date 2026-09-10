import { Card, GameState, Rank } from '../../types/game';
import { HypothesisStatus, StrategicHypothesis, YoyoSelfAction } from './yoyoTypes';
import { YoyoPlayerModel } from './yoyoPlayerModel';

export class YoyoAdaptationModel {
  private hypotheses: Map<string, StrategicHypothesis> = new Map();
  private playerAdaptationCount: number = 0;
  private yoyoCounterAdaptationCount: number = 0;
  private currentTurn: number = 0;
  private lastPlayerActionSummary: string = '';

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.hypotheses.clear();
    this.playerAdaptationCount = 0;
    this.yoyoCounterAdaptationCount = 0;
    this.currentTurn = 0;
    this.lastPlayerActionSummary = '';
  }

  public getHypotheses(): ReadonlyArray<StrategicHypothesis> {
    return Array.from(this.hypotheses.values());
  }

  public getActiveHypotheses(): StrategicHypothesis[] {
    return Array.from(this.hypotheses.values()).filter(
      (h) => h.status !== 'INACTIVE' && h.status !== 'DISPROVED' && h.confidence >= 0.35
    );
  }

  public getHypothesis(id: string): StrategicHypothesis | undefined {
    return this.hypotheses.get(id);
  }

  public hasPlayerAdapted(): boolean {
    return this.playerAdaptationCount > 0;
  }

  public getPlayerAdaptationCount(): number {
    return this.playerAdaptationCount;
  }

  public getYoyoCounterAdaptationCount(): number {
    return this.yoyoCounterAdaptationCount;
  }

  /**
   * Observes player's response in this turn to validate, disprove, or update active hypotheses.
   */
  public observePlayerResponse(
    prevGame: GameState,
    nextGame: GameState,
    playedCard: Card,
    playerModel: YoyoPlayerModel,
    yoyoSelfHistory: YoyoSelfAction[] = []
  ): void {
    this.currentTurn++;
    const action = nextGame.actionHistory[nextGame.actionHistory.length - 1];
    const isCapture = (action?.captureResult?.capturedCards.length ?? 0) > 0;
    const isSteal = action?.captureResult?.isTopUniformCapture ?? false;

    // 1. Evaluate Rank-Hunting Hypotheses
    for (const [id, hypo] of this.hypotheses.entries()) {
      if (hypo.targetRank) {
        hypo.turnsActive++;
        hypo.lastEvaluatedTurn = this.currentTurn;

        if (isCapture && playedCard.rank === hypo.targetRank) {
          // Player continues hunting this rank!
          hypo.evidenceCount++;
          hypo.status = hypo.evidenceCount >= 2 ? 'VALIDATED' : 'TESTING';
          hypo.confidence = Math.min(0.95, (hypo.evidenceCount + 1) / (hypo.evidenceCount + hypo.contradictionCount + 2));
        } else if (!isCapture && playedCard.rank !== hypo.targetRank && hypo.turnsActive >= 2) {
          // Player took another path without hunting targetRank
          hypo.contradictionCount += 0.5;
          hypo.confidence = Math.max(0.1, (hypo.evidenceCount + 1) / (hypo.evidenceCount + hypo.contradictionCount + 2));
          if (hypo.confidence < 0.35) {
            hypo.status = 'DISPROVED';
          }
        }
      }
    }

    // 2. Evaluate Aggressive vs Defensive Hypotheses
    const aggHypo = this.hypotheses.get('HYPO_AGGRESSIVE_CAPTURE');
    if (aggHypo && aggHypo.status !== 'INACTIVE') {
      aggHypo.turnsActive++;
      aggHypo.lastEvaluatedTurn = this.currentTurn;
      if (isCapture) {
        aggHypo.evidenceCount++;
        aggHypo.confidence = Math.min(0.92, (aggHypo.evidenceCount + 1) / (aggHypo.evidenceCount + aggHypo.contradictionCount + 2));
        if (aggHypo.evidenceCount >= 3) aggHypo.status = 'VALIDATED';
      } else {
        aggHypo.contradictionCount++;
        aggHypo.confidence = Math.max(0.1, (aggHypo.evidenceCount + 1) / (aggHypo.evidenceCount + aggHypo.contradictionCount + 2));
        if (aggHypo.contradictionCount >= 2 && aggHypo.confidence < 0.4) {
          aggHypo.status = 'DISPROVED';
          this.playerAdaptationCount++;
          this.yoyoCounterAdaptationCount++;
        }
      }
    }

    // 3. Evaluate Yoyo's latest counter move (did player respond as predicted?)
    if (yoyoSelfHistory.length > 0) {
      const lastYoyoAction = yoyoSelfHistory[yoyoSelfHistory.length - 1];
      const linkedHypo = lastYoyoAction.hypothesisId ? this.hypotheses.get(lastYoyoAction.hypothesisId) : undefined;

      if (linkedHypo) {
        linkedHypo.turnsActive++;
        linkedHypo.lastEvaluatedTurn = this.currentTurn;

        if (linkedHypo.counterStrategy === 'DENY_RANK' && linkedHypo.targetRank) {
          if (playedCard.rank === linkedHypo.targetRank) {
            linkedHypo.evidenceCount++;
            linkedHypo.confidence = Math.min(
              0.95,
              (linkedHypo.evidenceCount + 1) / (linkedHypo.evidenceCount + linkedHypo.contradictionCount + 2)
            );
            if (linkedHypo.evidenceCount >= 2) {
              linkedHypo.status = 'VALIDATED';
            }
            lastYoyoAction.wasCounterSuccessful = true;
          } else {
            // Contradictory response: player shifted away from the hypothesized target rank
            linkedHypo.contradictionCount += 2.0;
            linkedHypo.confidence = Math.max(
              0.1,
              (linkedHypo.evidenceCount + 1) / (linkedHypo.evidenceCount + linkedHypo.contradictionCount * 3 + 2)
            );
            if (linkedHypo.confidence < 0.35) {
              linkedHypo.status = 'DISPROVED';
              this.playerAdaptationCount++;
              this.yoyoCounterAdaptationCount++;
            }
            lastYoyoAction.wasCounterSuccessful = false;
          }
        } else if (linkedHypo.counterStrategy === 'EXPLOIT_PREDICTABLE') {
          if (isCapture) {
            linkedHypo.evidenceCount++;
            linkedHypo.confidence = Math.min(
              0.95,
              (linkedHypo.evidenceCount + 1) / (linkedHypo.evidenceCount + linkedHypo.contradictionCount + 2)
            );
            if (linkedHypo.evidenceCount >= 3) linkedHypo.status = 'VALIDATED';
            lastYoyoAction.wasCounterSuccessful = true;
          } else {
            linkedHypo.contradictionCount += 2.0;
            linkedHypo.confidence = Math.max(
              0.1,
              (linkedHypo.evidenceCount + 1) / (linkedHypo.evidenceCount + linkedHypo.contradictionCount * 3 + 2)
            );
            if (linkedHypo.confidence < 0.35) {
              linkedHypo.status = 'DISPROVED';
              this.playerAdaptationCount++;
              this.yoyoCounterAdaptationCount++;
            }
            lastYoyoAction.wasCounterSuccessful = false;
          }
        }
      } else if (lastYoyoAction.targetRank && playedCard.rank === lastYoyoAction.targetRank && !isCapture) {
        lastYoyoAction.wasCounterSuccessful = true;
      }
    }

    // 4. Update and generate fresh hypotheses from evolving player model
    this.updateHypotheses(playerModel, nextGame);
  }

  /**
   * Generates or refreshes persistent hypotheses without destroying existing lifecycle states.
   */
  public updateHypotheses(playerModel: YoyoPlayerModel, gameState: GameState): StrategicHypothesis[] {
    const metrics = playerModel.getMetrics();
    const huntedRanks = playerModel.getHuntedRanks();

    // 1. Rank-hunting hypotheses
    for (const [rank, count] of huntedRanks.entries()) {
      const id = `DENY_RANK_${rank}`;
      const existing = this.hypotheses.get(id);

      if (count >= 2) {
        if (!existing) {
          this.hypotheses.set(id, {
            id,
            hypothesis: `اللاعب يركز بشدة على تجميع رتبة ${rank}`,
            targetRank: rank,
            counterStrategy: 'DENY_RANK',
            status: 'CREATED',
            confidence: Math.min(0.85, 0.45 + count * 0.15),
            evidenceCount: count,
            contradictionCount: 0,
            turnsActive: 1,
            lastEvaluatedTurn: this.currentTurn,
            description: `رصد محاولة اللاعب احتكار كروت ${rank}`,
          });
        } else if (existing.status === 'DISPROVED' && count > existing.evidenceCount) {
          // Re-emerging interest in rank only if fresh evidence was accumulated
          existing.status = 'TESTING';
          existing.evidenceCount = count;
          existing.contradictionCount = 0;
          existing.confidence = 0.6;
        }
      }
    }

    // 2. Aggressive Play Hypothesis
    const aggId = 'HYPO_AGGRESSIVE_CAPTURE';
    const existingAgg = this.hypotheses.get(aggId);
    if (metrics.archetype === 'AGGRESSIVE' || metrics.archetype === 'PREDICTABLE') {
      if (!existingAgg) {
        this.hypotheses.set(aggId, {
          id: aggId,
          hypothesis: 'اللاعب يلتهم أي كرت متاح فورياً دون حساب لعواقب الطاولة',
          counterStrategy: 'EXPLOIT_PREDICTABLE',
          status: 'TESTING',
          confidence: metrics.primaryConfidence,
          evidenceCount: metrics.directCapturesCount,
          contradictionCount: metrics.strategicSacrificesCount,
          turnsActive: 1,
          lastEvaluatedTurn: this.currentTurn,
          description: 'استغلال اندفاع اللاعب للأكل الفوري عبر الطعم وحرمانه من الكروت الحساسة',
        });
      }
    }

    // 3. Tactical Sacrifice Hypothesis
    const sacId = 'HYPO_TACTICAL_SACRIFICE';
    const existingSac = this.hypotheses.get(sacId);
    if (metrics.strategicSacrificesCount >= 1 || metrics.archetype === 'TACTICAL') {
      if (!existingSac) {
        this.hypotheses.set(sacId, {
          id: sacId,
          hypothesis: 'اللاعب يقوم بتضحيات تكتيكية محسوبة لبناء مجموعات أعلى قيمة',
          counterStrategy: 'DEFENSIVE_HOLD',
          status: 'VALIDATED',
          confidence: Math.min(0.9, 0.6 + metrics.strategicSacrificesCount * 0.15),
          evidenceCount: metrics.strategicSacrificesCount,
          contradictionCount: metrics.recklessDiscardsCount,
          turnsActive: 1,
          lastEvaluatedTurn: this.currentTurn,
          description: 'احترام تضحيات اللاعب وعدم ابتلاع الطعم المكشوف',
        });
      }
    }

    // 4. Check for player adaptation event
    if (metrics.adaptationsCount > this.playerAdaptationCount) {
      this.playerAdaptationCount = metrics.adaptationsCount;
      this.yoyoCounterAdaptationCount++;
    }

    return Array.from(this.hypotheses.values());
  }

  public recordYoyoAction(card: Card, decision?: YoyoSelfAction): void {
    // Recorded for counter testing
    this.yoyoCounterAdaptationCount++;
  }
}
