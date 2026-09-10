import { Card, GameState, Rank, Suit } from '../../types/game';
import { getCardByCanonicalId } from '../../engine/deck';
import { YoyoCardLocation } from './yoyoTypes';

export interface CardObservationRecord {
  canonicalId: number;
  rank: Rank;
  suit: Suit;
  isJack: boolean;
  numericValue: number;
  location: YoyoCardLocation;
  dealObserved?: number;
  observedTurn?: number;
}

export class YoyoDeckKnowledge {
  private cards: Map<number, CardObservationRecord> = new Map();
  private revealedAnchorCard: Card | null = null;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.cards.clear();
    this.revealedAnchorCard = null;

    for (let id = 1; id <= 52; id++) {
      const canonical = getCardByCanonicalId(id);
      if (canonical) {
        this.cards.set(id, {
          canonicalId: id,
          rank: canonical.rank,
          suit: canonical.suit,
          isJack: canonical.isJack,
          numericValue: canonical.numericValue,
          location: 'IN_DECK_UNSEEN',
        });
      }
    }
  }

  /**
   * Updates Yoyo's deck awareness strictly based on legally observable game state.
   * Yoyo knows:
   * - CPU's own hand (CPU_HAND_KNOWN)
   * - Public cards on Player Table and Opponent Table (PLAYER_TABLE_VISIBLE, CPU_TABLE_VISIBLE)
   * - Public cards captured into Player Winning Pile and CPU Winning Pile (PLAYER_PILE_CAPTURED, CPU_PILE_CAPTURED)
   * - The revealed bottom memory anchor card (REVEALED_BOTTOM_ANCHOR)
   *
   * ZERO CHEAT GUARANTEE:
   * Yoyo NEVER peeks at the player's private hand or unseen deck cards.
   */
  public observeGameState(game: GameState): void {
    if (game.revealedLastCard && !this.revealedAnchorCard) {
      this.revealedAnchorCard = game.revealedLastCard;
      const anchorId = Number(game.revealedLastCard.id);
      const record = this.cards.get(anchorId);
      if (record) {
        record.location = 'REVEALED_BOTTOM_ANCHOR';
      }
    }

    // CPU hand (known legitimately to CPU only)
    for (const card of game.cpuHand) {
      const id = Number(card.id);
      const record = this.cards.get(id);
      if (record) {
        record.location = 'CPU_HAND_KNOWN';
        record.dealObserved = game.dealNumber;
      }
    }

    // Player Table (publicly visible)
    for (const card of game.table.playerTable) {
      const id = Number(card.id);
      const record = this.cards.get(id);
      if (record && record.location !== 'PLAYER_TABLE_VISIBLE') {
        record.location = 'PLAYER_TABLE_VISIBLE';
        record.dealObserved = game.dealNumber;
      }
    }

    // Opponent Table / CPU Table (publicly visible)
    for (const card of game.table.opponentTable) {
      const id = Number(card.id);
      const record = this.cards.get(id);
      if (record && record.location !== 'CPU_TABLE_VISIBLE') {
        record.location = 'CPU_TABLE_VISIBLE';
        record.dealObserved = game.dealNumber;
      }
    }

    // Player Winning Pile (publicly known captures)
    for (const card of game.playerWinningPile) {
      const id = Number(card.id);
      const record = this.cards.get(id);
      if (record) {
        record.location = 'PLAYER_PILE_CAPTURED';
        record.rank = card.rank;
      }
    }

    // CPU Winning Pile (publicly known captures)
    for (const card of game.cpuWinningPile) {
      const id = Number(card.id);
      const record = this.cards.get(id);
      if (record) {
        record.location = 'CPU_PILE_CAPTURED';
        record.rank = card.rank;
      }
    }
  }

  /**
   * NO-CHEAT INTEGRITY VERIFICATION:
   * Proves mathematically and strictly that no hidden cards in player hand or unseen deck
   * are stored as known by Yoyo.
   */
  public verifyNoCheatIntegrity(game: GameState): { clean: boolean; leaks: string[] } {
    const leaks: string[] = [];

    // Verify player's hidden hand cards are marked as IN_DECK_UNSEEN (or anchor if dealt from anchor)
    // and NEVER marked with any privileged CPU location, table, or captured pile
    for (const card of game.playerHand) {
      const id = Number(card.id);
      const record = this.cards.get(id);
      if (record) {
        if (record.location !== 'IN_DECK_UNSEEN' && record.location !== 'REVEALED_BOTTOM_ANCHOR') {
          leaks.push(`Player hand card ${card.id} (${card.rank}) illegally marked as ${record.location}`);
        }
      }
    }

    // Verify unrevealed cards in deck are strictly unseen
    for (let i = 0; i < game.deck.length; i++) {
      const card = game.deck[i];
      const id = Number(card.id);
      const record = this.cards.get(id);
      if (record) {
        const isAnchor = game.revealedLastCard && Number(game.revealedLastCard.id) === id;
        if (isAnchor) {
          if (record.location !== 'REVEALED_BOTTOM_ANCHOR') {
            leaks.push(`Revealed bottom anchor ${card.id} has incorrect location ${record.location}`);
          }
        } else if (record.location !== 'IN_DECK_UNSEEN') {
          leaks.push(`Unseen deck card ${card.id} falsely marked as ${record.location}`);
        }
      }
    }

    return {
      clean: leaks.length === 0,
      leaks,
    };
  }

  /**
   * Counts how many cards of a given rank have NOT been observed at all (strictly IN_DECK_UNSEEN).
   * Note: A revealed bottom anchor card is known and observed, so it is NOT counted as unseen.
   */
  public getRemainingUnseenRankCount(rank: Rank): number {
    let count = 0;
    for (const record of this.cards.values()) {
      if (record.rank === rank && record.location === 'IN_DECK_UNSEEN') {
        count++;
      }
    }
    return count;
  }

  /**
   * Counts total cards of a given rank remaining in the unplayed deck pool
   * (both truly unseen cards and the known revealed bottom anchor).
   */
  public getRemainingInDeckRankCount(rank: Rank): number {
    let count = 0;
    for (const record of this.cards.values()) {
      if (record.rank === rank) {
        if (record.location === 'IN_DECK_UNSEEN' || record.location === 'REVEALED_BOTTOM_ANCHOR') {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Counts total cards of a given rank captured in Player Winning Pile.
   */
  public getPlayerCapturedRankCount(rank: Rank): number {
    let count = 0;
    for (const record of this.cards.values()) {
      if (record.rank === rank && record.location === 'PLAYER_PILE_CAPTURED') {
        count++;
      }
    }
    return count;
  }

  /**
   * Counts total cards of a given rank captured in CPU Winning Pile.
   */
  public getCpuCapturedRankCount(rank: Rank): number {
    let count = 0;
    for (const record of this.cards.values()) {
      if (record.rank === rank && record.location === 'CPU_PILE_CAPTURED') {
        count++;
      }
    }
    return count;
  }

  /**
   * Calculates a heuristic availability estimate (0.0 to 1.0) of a given rank in the unplayed pool.
   * Considers all remaining unplayed cards (both unseen and the known bottom anchor).
   * Named accurately as heuristic estimate, not "probability".
   */
  public estimateRankAvailabilityHeuristic(rank: Rank): number {
    const remaining = this.getRemainingInDeckRankCount(rank);
    return Math.min(1.0, remaining / 4.0);
  }

  /**
   * Backward-compatible alias for existing tests.
   */
  public calculateRankAvailabilityScore(rank: Rank): number {
    return this.estimateRankAvailabilityHeuristic(rank);
  }

  /**
   * Returns how many Jacks remain unseen in the game.
   */
  public getUnseenJacksCount(): number {
    return this.getRemainingUnseenRankCount('J');
  }

  /**
   * Returns whether the revealed bottom memory anchor card matches a given rank.
   */
  public isAnchorRank(rank: Rank): boolean {
    return this.revealedAnchorCard?.rank === rank;
  }

  public getRevealedAnchor(): Card | null {
    return this.revealedAnchorCard;
  }

  public getRecord(canonicalId: number): CardObservationRecord | undefined {
    return this.cards.get(canonicalId);
  }
}
