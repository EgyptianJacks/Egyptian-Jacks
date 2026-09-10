import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFirstMatchDeck,
  validateFirstMatchDeck,
  createInitialFirstMatch,
  decideFirstMatchCpuMove,
  executeFirstMatchCpuTurn,
  evaluateFirstMatchStep,
  FIRST_MATCH_DECK,
  FIRST_MATCH_DECK_CONSTITUTION,
} from '../../firstMatch';
import { playPlayerCard } from '../../engine/gameEngine';
import { calculateScores } from '../../engine/rules';
import { createInitialMatch } from '../../engine/matchEngine';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Egyptian Jacks — First Match Guided Experience (A6.0 / A6.1 Product Architecture)', () => {
  it('1. Validates First Match Deck Constitution: strictly 52 unique canonical cards', () => {
    const { valid, errors, details } = validateFirstMatchDeck();
    assert.equal(valid, true, `Validation errors: ${errors.join(', ')}`);
    assert.equal(FIRST_MATCH_DECK.length, 52);
    assert.equal(details.uniqueIdCount, 52);
    assert.equal(FIRST_MATCH_DECK_CONSTITUTION.length, 52);

    // Verify all 52 IDs are '1'..'52'
    const ids = new Set(FIRST_MATCH_DECK.map((c) => c.id));
    assert.equal(ids.size, 52);
    for (let i = 1; i <= 52; i++) {
      assert.ok(ids.has(String(i)), `Missing canonical ID ${i}`);
    }

    // Verify bottom card anchor ID is 42 (4♠)
    assert.equal(details.bottomCardAnchorId, 42);
  });

  it('2. Deal 1: Direct Capture -> Own Table -> CPU Setup -> First Steal (Canonical Engine)', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();

    // Deal 1 initial:
    // Player Hand has 9♥, 4♦, 7♥, 8♣
    // Opponent Table has 9♣, 3♠
    assert.ok(g0.playerHand.some((c) => c.rank === '9' && c.suit === '♥'));
    assert.ok(g0.table.opponentTable.some((c) => c.rank === '9' && c.suit === '♣'));

    // Turn 1: Player plays 9♥
    const card9h = g0.playerHand.find((c) => c.rank === '9' && c.suit === '♥')!;
    const g1 = playPlayerCard(g0, card9h.id);
    const s1 = evaluateFirstMatchStep(s0, g0, g1, card9h);

    assert.equal(s1.milestones.find((m) => m.id === 'milestone-first-capture')?.achieved, true);
    assert.equal(g1.playerWinningPile.length, 2); // 9♣ and 9♥

    // Turn 1 CPU: CPU plays 7♣
    const g2 = executeFirstMatchCpuTurn(g1, s1);
    assert.equal(g2.phase, 'PLAYER_TURN');
    assert.ok(g2.table.opponentTable.some((c) => c.rank === '7'));

    // Turn 2 Player: Player plays non-matching 4♦
    const card4d = g2.playerHand.find((c) => c.rank === '4')!;
    const g3 = playPlayerCard(g2, card4d.id);
    const s3 = evaluateFirstMatchStep(s1, g2, g3, card4d);

    assert.equal(s3.milestones.find((m) => m.id === 'milestone-own-table')?.achieved, true);
    // 4♦ is on player table
    assert.ok(g3.table.playerTable.some((c) => c.rank === '4'));

    // Turn 2 CPU: CPU plays 7♦ and captures 7♣ from CPU's table into cpuWinningPile!
    const g4 = executeFirstMatchCpuTurn(g3, s3);
    assert.equal(g4.cpuWinningPile.length, 2);
    assert.equal(g4.cpuWinningPile[g4.cpuWinningPile.length - 1].rank, '7');

    // Turn 3 Player: STEAL! Player plays 7♥ to steal 7s from CPU winning pile!
    const card7h = g4.playerHand.find((c) => c.rank === '7' && c.suit === '♥')!;
    const g5 = playPlayerCard(g4, card7h.id);
    const s5 = evaluateFirstMatchStep(s3, g4, g5, card7h);

    // Verify canonical engine performed the Steal
    assert.equal(s5.stealAchieved, true);
    assert.equal(g5.cpuWinningPile.length, 0); // Stolen away!
    assert.equal(g5.playerWinningPile.length, 5); // 9♣, 9♥, 7♣, 7♦, 7♥
  });

  it('3. FULL END-TO-END MATCH SIMULATION: Golden achieved -> Coach becomes Rival -> Free Play through Deal 6 -> Game Over', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();
    let currentGameState = g0;
    let currentMatchState = s0;

    // Verify bottom memory anchor at the start
    assert.ok(g0.revealedLastCard, 'revealedLastCard anchor must exist');
    assert.equal(g0.revealedLastCard.id, '42'); // 4♠

    // Helper: Execute CPU turn deterministically using executeFirstMatchCpuTurn
    const stepCpu = () => {
      currentGameState = executeFirstMatchCpuTurn(currentGameState, currentMatchState);
    };

    // Helper: Execute Player card
    const stepPlayer = (cardPredicate: (c: typeof g0.playerHand[0]) => boolean) => {
      const card = currentGameState.playerHand.find(cardPredicate);
      assert.ok(card, 'Expected player card in hand');
      const prev = currentGameState;
      currentGameState = playPlayerCard(currentGameState, card.id);
      currentMatchState = evaluateFirstMatchStep(currentMatchState, prev, currentGameState, card);
    };

    // --- DEAL 1 ---
    // P1: Play 9♥ (Capture 9♣)
    stepPlayer((c) => c.rank === '9' && c.suit === '♥');
    // C1: Play 7♣ (to table)
    stepCpu();
    // P2: Play 4♦ (to table)
    stepPlayer((c) => c.rank === '4');
    // C2: Play 7♦ (captures 7♣ to CPU winning pile)
    stepCpu();
    // P3: Play 7♥ (STEAL 7s from CPU winning pile!)
    stepPlayer((c) => c.rank === '7');
    // C3: Play 6♠ (to table)
    stepCpu();
    // P4: Play 8♣ (to table)
    stepPlayer((c) => c.rank === '8');
    // C4: Play 10♦ (to table) -> checkReplenishOrEnd deals Deal 2 automatically!
    stepCpu();

    assert.equal(currentGameState.dealNumber, 2);
    assert.equal(currentGameState.playerHand.length, 4);
    assert.equal(currentGameState.cpuHand.length, 4);

    // --- DEAL 2 ---
    // P1: Play 2♥ (to table)
    stepPlayer((c) => c.rank === '2');
    // C1: Play 9♦ (to table)
    stepCpu();
    // P2: Play 9♠ (captures 9♦ -> 4 NINES = REGULAR SET!)
    stepPlayer((c) => c.rank === '9');
    // C2: Play J♣ (to table)
    stepCpu();
    // P3: Play J♦ (captures J♣ -> 2 Jacks in winning pile!)
    stepPlayer((c) => c.rank === 'J');
    // C3: Play 5♥ (to table)
    stepCpu();
    // P4: Play 3♦ (to table)
    stepPlayer((c) => c.rank === '3');
    // C4: Play 6♦ (to table) -> checkReplenishOrEnd deals Deal 3!
    stepCpu();

    assert.equal(currentGameState.dealNumber, 3);
    const scoresDeal2 = calculateScores(currentGameState.playerWinningPile, 'player');
    assert.ok(scoresDeal2.regularSets >= 1, 'Expected at least 1 Regular Set (Nines)');

    // --- DEAL 3 ---
    // P1: Play 4♥ (to table)
    stepPlayer((c) => c.rank === '4');
    // C1: Play J♥ (to table)
    stepCpu();
    // P2: Play J♠ (captures J♥ -> ALL 4 JACKS = JACK SET + SILVER COMBO!)
    stepPlayer((c) => c.rank === 'J');
    // C2: Play 10♥ (to table)
    stepCpu();
    // P3: Play 10♣ (captures 10♥)
    stepPlayer((c) => c.rank === '10');
    // C3: Play 5♦ (to table)
    stepCpu();
    // P4: Play 8♦ (to table)
    stepPlayer((c) => c.rank === '8');
    // C4: Play 6♣ (to table) -> checkReplenishOrEnd deals Deal 4!
    stepCpu();

    assert.equal(currentGameState.dealNumber, 4);
    const scoresDeal3 = calculateScores(currentGameState.playerWinningPile, 'player');
    assert.ok(scoresDeal3.sets.some((s) => s.isJackSet), 'Expected Jack Set formed in Deal 3');
    assert.equal(scoresDeal3.silverCombos, 1, 'Expected 1 Silver Combo (60 pts)');

    // --- DEAL 4 ---
    // P1: Play 2♣ (to table)
    stepPlayer((c) => c.rank === '2');
    // C1: Play K♣ (to table)
    stepCpu();
    // P2: Play K♦ (captures K♣ -> 2 Kings)
    stepPlayer((c) => c.rank === 'K' && c.suit === '♦');
    // C2: Play K♥ (to table)
    stepCpu();
    // P3: Play K♠ (captures K♥ -> ALL 4 KINGS = SECOND REGULAR SET -> GOLDEN COMBO!)
    stepPlayer((c) => c.rank === 'K' && c.suit === '♠');

    // *** GOLDEN CLIMAX VERIFICATION ***
    const goldenScores = calculateScores(currentGameState.playerWinningPile, 'player');
    assert.ok(goldenScores.goldenCombos > 0, 'Expected Golden Combo');
    assert.equal(goldenScores.goldenPoints, 75, 'Expected 75 golden combo points');
    assert.equal(currentMatchState.goldenAchieved, true);
    // Golden produces Challenge first (STAGE_5_CHALLENGE) and surprise_golden reaction
    assert.equal(currentMatchState.yoyoStage, 'STAGE_5_CHALLENGE');
    assert.equal(currentMatchState.yoyoExpression, 'surprise_golden');
    assert.equal(currentMatchState.isFreePlayActive, false);
    assert.equal(currentMatchState.title, 'الكومبو الذهبي (75 نقطة)! ⚡');
    assert.ok(currentMatchState.coachMessage.includes('Golden'));

    // P4 & C4 to finish Deal 4
    // C3: Play Q♣
    stepCpu();
    // P4: Play Q♦ (captures Q♣) -> subsequent step transitions to Rival & Free Play
    stepPlayer((c) => c.rank === 'Q');
    // C4: Play 3♣ (to table) -> deals Deal 5!
    stepCpu();

    // Yoyo Coach to Rival transition
    assert.equal(currentMatchState.yoyoStage, 'STAGE_6_RIVAL');
    assert.equal(currentMatchState.yoyoExpression, 'challenge');
    assert.equal(currentMatchState.title, 'يويو — منافسك');
    assert.ok(currentMatchState.coachMessage.includes('دوري أنا'));
    assert.equal(currentMatchState.isFreePlayActive, true);

    // MATCH DOES NOT END AT GOLDEN COMBO!
    assert.notEqual(currentGameState.phase, 'MATCH_END');
    assert.equal(currentGameState.dealNumber, 5);
    assert.equal(currentGameState.deck.length, 8); // 8 cards left in deck for Deal 6

    // --- DEAL 5 (Free Play / Rival Phase) ---
    for (let turn = 0; turn < 4; turn++) {
      // Player plays any legal card in hand
      const card = currentGameState.playerHand[0];
      stepPlayer((c) => c.id === card.id);
      stepCpu();
    }

    assert.equal(currentGameState.dealNumber, 6);
    assert.equal(currentGameState.deck.length, 0); // All 52 cards are now dealt!

    // Verify Memory Anchor: CPU's last dealt card in Deal 6 matches revealed bottom card anchor
    assert.ok(
      currentGameState.cpuHand.some((c) => c.id === '42'),
      'CPU hand in Deal 6 must contain the revealed bottom anchor card 4♠ (ID 42)'
    );

    // --- DEAL 6 (Match Endgame & Conservation Exhaustion) ---
    for (let turn = 0; turn < 4; turn++) {
      const card = currentGameState.playerHand[0];
      stepPlayer((c) => c.id === card.id);
      if (currentGameState.phase === 'CPU_TURN') {
        stepCpu();
      }
    }

    // *** MATCH CONCLUSION ASSERTIONS ***
    // Both hands empty, deck empty -> MATCH_END
    assert.equal(currentGameState.playerHand.length, 0);
    assert.equal(currentGameState.cpuHand.length, 0);
    assert.equal(currentGameState.deck.length, 0);
    assert.equal(currentGameState.phase, 'MATCH_END');
    assert.ok(currentGameState.playerScore !== null);
    assert.ok(currentGameState.cpuScore !== null);
    assert.ok(currentGameState.winner !== null);
  });

  it('4. Agency & Deviation: alternative legal moves resolve safely without resets or exceptions', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();

    // Player decides to play 4♦ on Turn 1 instead of intended 9♥
    const card4d = g0.playerHand.find((c) => c.rank === '4')!;
    const g1 = playPlayerCard(g0, card4d.id);
    const s1 = evaluateFirstMatchStep(s0, g0, g1, card4d);

    // No error, move resolved by canonical engine to player table
    assert.equal(g1.table.playerTable.some((c) => c.rank === '4'), true);
    assert.equal(s1.milestones.find((m) => m.id === 'milestone-own-table')?.achieved, true);

    // CPU executes turn legally
    const g2 = executeFirstMatchCpuTurn(g1, s1);
    assert.equal(g2.phase, 'PLAYER_TURN');

    // On Turn 2, player plays 7♥: captures top card 7♣ from opponent table cleanly!
    const card7h = g2.playerHand.find((c) => c.rank === '7')!;
    const g3 = playPlayerCard(g2, card7h.id);
    const s3 = evaluateFirstMatchStep(s1, g2, g3, card7h);

    assert.equal(s3.milestones.find((m) => m.id === 'milestone-first-capture')?.achieved, true);
    assert.equal(g3.playerWinningPile.length, 2);
  });

  it('5. Agency & Deviation Matrix: Scenario C (Missed Steal) & Scenario D (Delayed Set) resolve cleanly', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();

    // Turn 1: Normal capture
    const card9h = g0.playerHand.find((c) => c.rank === '9')!;
    const g1 = playPlayerCard(g0, card9h.id);
    const s1 = evaluateFirstMatchStep(s0, g0, g1, card9h);

    // CPU plays 7♣
    const g2 = executeFirstMatchCpuTurn(g1, s1);

    // Turn 2: Player plays 4♦
    const card4d = g2.playerHand.find((c) => c.rank === '4')!;
    const g3 = playPlayerCard(g2, card4d.id);
    const s3 = evaluateFirstMatchStep(s1, g2, g3, card4d);

    // CPU captures 7♣ with 7♦ into CPU winning pile
    const g4 = executeFirstMatchCpuTurn(g3, s3);
    assert.equal(g4.cpuWinningPile.length, 2);

    // Scenario C: Player MISSED STEAL (plays 8♣ instead of 7♥)
    const card8c = g4.playerHand.find((c) => c.rank === '8')!;
    const g5 = playPlayerCard(g4, card8c.id);
    const s5 = evaluateFirstMatchStep(s3, g4, g5, card8c);

    // Steal was NOT achieved, but game didn't break or crash
    assert.equal(s5.stealAchieved, false);
    assert.equal(g5.table.playerTable.some((c) => c.rank === '8'), true);

    // CPU continues turn legally without exception
    const g6 = executeFirstMatchCpuTurn(g5, s5);
    assert.ok(g6.phase === 'PLAYER_TURN' || g6.phase === 'DEALING');
  });

  it('6. CPU Fallback & Safety: CPU never crashes, corrupts state, or plays illegal moves even if expected card is gone', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();

    // Simulate CPU turn when hand has different cards
    const customCpuGame = {
      ...g0,
      phase: 'CPU_TURN' as const,
      activeTurn: 'cpu' as const,
      cpuHand: [{
        id: '1',
        rank: '2' as const,
        suit: '♣' as const,
        numericValue: 2,
        isFace: false,
        points: 0,
        canBeCollected: false,
        isEgyptianJack: false,
        isJack: false,
      }],
    };

    const nextState = executeFirstMatchCpuTurn(customCpuGame, s0);
    // The card was legally played from cpuHand
    assert.equal(nextState.cpuHand.length, 0);
    assert.equal(nextState.phase, 'PLAYER_TURN');
    assert.ok(
      nextState.table.opponentTable.some((c) => c.rank === '2') ||
      nextState.cpuWinningPile.some((c) => c.rank === '2')
    );
  });

  it('7. Hidden Information Audit: Player state never exposes CPU hand or hidden deck order in runtime', () => {
    const { state: s0, game: g0 } = createInitialFirstMatch();

    // Player state contains only public guidance and milestone info
    assert.equal('cpuHand' in s0, false, 'FirstMatchState must not contain cpuHand');
    assert.equal('deck' in s0, false, 'FirstMatchState must not contain deck');
    assert.equal('futureCards' in s0, false, 'FirstMatchState must not contain futureCards');

    // Player hand in game state has exactly 4 cards
    assert.equal(g0.playerHand.length, 4);

    // Opponent table is visible, but opponent hand is separate and private
    assert.equal(g0.table.opponentTable.length, 2);
    assert.equal(g0.cpuHand.length, 4);
  });

  it('8. Normal Match Isolation: Normal match initializes cleanly without First Match state', () => {
    // Canonical match engine initializes cleanly
    const { match, round } = createInitialMatch('SINGLE', 12345, 'player');

    assert.equal(match.format, 'SINGLE');
    assert.equal(round.dealNumber, 1);
    assert.equal(round.playerHand.length, 4);
    assert.equal(round.cpuHand.length, 4);
    assert.equal(round.deck.length, 40); // 52 - 12 = 40
  });

  it('9. Architectural Boundary: src/firstMatch has ZERO imports from src/tutorial', () => {
    const firstMatchDir = path.resolve(__dirname, '../../firstMatch');
    const files = fs.readdirSync(firstMatchDir);

    for (const file of files) {
      if (!file.endsWith('.ts')) continue;
      const content = fs.readFileSync(path.join(firstMatchDir, file), 'utf-8');
      assert.ok(
        !content.includes("from '../tutorial") && !content.includes('from "../tutorial'),
        `Architectural leak detected in src/firstMatch/${file}: references tutorial directly!`
      );
    }
  });
});
