import React, { useState, useEffect, useCallback } from 'react';
import { Card, CpuDifficulty, GameState, MatchFormat, MatchState, PlayerId } from '../types/game';
import { MovementSequence } from '../types/movement';
import {
  createInitialMatch,
  finalizeRoundInMatch,
  startNextRoundInMatch,
} from '../engine/matchEngine';
import {
  generateDealSequence,
  generatePlayCardSequence,
} from '../engine/movementGenerator';
import { calculateScores } from '../engine/rules';
import { detectNewlyCompletedCollection } from '../engine/collectionDetector';
import { soundEngine } from '../engine/soundEngine';
import { storageGet, storageSet, STORAGE_KEYS } from '../engine/persistence';
import { CardView } from './CardView';
import { TableStackView } from './TableStackView';
import { WinningPileView } from './WinningPileView';
import { CardMovementLayer } from './CardMovementLayer';
import { CollectionFeedbackLayer, CollectionEvent } from './CollectionFeedbackLayer';
import { GameOverModal } from './GameOverModal';
import { RoundSummaryModal } from './RoundSummaryModal';
import { RulesModal } from './RulesModal';
import { HistoryLogDrawer } from './HistoryLogDrawer';
import { InMatchControls } from './InMatchControls';
import { ExitConfirmModal } from './ExitConfirmModal';
import { MemoryAnchorBadge } from './MemoryAnchorBadge';
import { Lobby } from './Lobby';
import { TutorialCoachOverlay } from './TutorialCoachOverlay';
import { PracticeModal } from './PracticeModal';
import {
  createInitialTutorialRuntime,
  evaluateTutorialActionResult,
  requestTutorialHint,
  completeTutorialLesson,
} from '../tutorial/tutorialRuntimeController';
import {
  createInitialLearnByPlay,
  advanceLearnByPlayPhase,
  evaluateLearnByPlayAction,
  requestLearnByPlayHint,
} from '../tutorial/learnByPlayEngine';
import { LearnByPlayState, TutorialLesson, TutorialRuntimeState } from '../tutorial/tutorialTypes';
import { LearnByPlayCoach } from './LearnByPlayCoach';
import {
  createInitialFirstMatch,
  evaluateFirstMatchStep,
  executeFirstMatchCpuTurn,
  requestFirstMatchHint,
  FirstMatchState,
  GameMode,
} from '../firstMatch';
import { FirstMatchCoach } from './FirstMatchCoach';
import { analyzeGuidedMatchState, GuidedMatchTip } from '../tutorial/guidedMatchEngine';
import { Crown, Zap, Swords, GraduationCap, Sparkles, Lightbulb } from 'lucide-react';
import { YoyoAvatar, YoyoExpression } from '../character/yoyo';
import { YoyoRivalPresence } from './YoyoRivalPresence';
import { MatchOrchestrator } from '../orchestration/matchOrchestrator';
import { YoyoBoardDirector } from './YoyoBoardDirector';
import { CoachingMoment } from '../character/brain/yoyoCoachingTypes';

export const GameBoard: React.FC = () => {
  // Navigation: In Lobby vs In Match vs In Tutorial vs In Practice
  const [currentScreen, setCurrentScreen] = useState<'LOBBY' | 'MATCH' | 'TUTORIAL' | 'PRACTICE'>('LOBBY');
  const [gameMode, setGameMode] = useState<GameMode>('NORMAL');
  const [isGuidedMode, setIsGuidedMode] = useState<boolean>(false);
  const [cpuDifficulty, setCpuDifficulty] = useState<CpuDifficulty>(() =>
    storageGet<CpuDifficulty>(STORAGE_KEYS.CPU_DIFFICULTY, 'HARD')
  );
  const [isPracticeModalOpen, setIsPracticeModalOpen] = useState<boolean>(false);
  const [practiceConcept, setPracticeConcept] = useState<TutorialLesson | null>(null);

  // YO-YO Coaching & Evidence Spotlight State
  const [activeCoachingMoment, setActiveCoachingMoment] = useState<CoachingMoment | null>(null);

  const handleDismissCoachingMoment = () => {
    setActiveCoachingMoment(null);
  };

  const handleNextOrientationStep = () => {
    const nextStep = MatchOrchestrator.getInstance().getNextOrientationStep();
    setActiveCoachingMoment(nextStep);
  };

  // Learn by Playing State (Match-Embedded Tutorial)
  const [learnByPlayState, setLearnByPlayState] = useState<LearnByPlayState | null>(null);

  // First Match Guided Experience State
  const [firstMatchState, setFirstMatchState] = useState<FirstMatchState | null>(null);

  // Academy Progress Tracking
  const [completedLessons, setCompletedLessons] = useState<TutorialLesson[]>(() =>
    storageGet<TutorialLesson[]>(STORAGE_KEYS.COMPLETED_LESSONS, [])
  );
  const [isSequentialJourney, setIsSequentialJourney] = useState<boolean>(true);

  const [initialData] = useState(() => createInitialMatch('SINGLE', Date.now(), 'player'));
  const [matchState, setMatchState] = useState<MatchState>(initialData.match);
  const [gameState, setGameState] = useState<GameState>(initialData.round);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isLogOpen, setIsLogOpen] = useState<boolean>(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState<boolean>(false);

  // Tutorial Runtime State
  const [tutorialRuntime, setTutorialRuntime] = useState<TutorialRuntimeState | null>(null);
  const lastPlayedPlayerCardRef = React.useRef<Card | null>(null);
  const turnStartTimeRef = React.useRef<number>(Date.now());

  // Card Movement Animation System State
  const [activeSequence, setActiveSequence] = useState<MovementSequence | null>(null);
  const [pendingNextState, setPendingNextState] = useState<GameState | null>(null);
  const [ghostCardIds, setGhostCardIds] = useState<Set<string>>(new Set());

  // Collection Celebration Overlay
  const [activeCollectionEvent, setActiveCollectionEvent] = useState<CollectionEvent | null>(null);

  // Yoyo Reaction State for Normal Match Presence
  const [yoyoReaction, setYoyoReaction] = useState<{
    expression: YoyoExpression;
    dialogue?: string | null;
  }>({
    expression: 'watching',
    dialogue: null,
  });

  const isAnimating = activeSequence !== null;

  // Start tutorial lesson (Lesson 1 by default, sequential by default)
  const handleStartTutorial = (lesson: TutorialLesson = 1, isSequential: boolean = true) => {
    setIsSequentialJourney(isSequential);
    setGameMode('NORMAL');
    setPracticeConcept(null);
    setFirstMatchState(null);
    const { runtimeState, initialGame } = createInitialTutorialRuntime(lesson);

    const emptyStartingState: GameState = {
      ...initialGame,
      playerHand: [],
      cpuHand: [],
      table: {
        playerTable: [],
        opponentTable: [],
        viewMode: 'INITIAL_VIEW',
      },
    };

    const dealSeq = generateDealSequence(
      1,
      initialGame.playerHand,
      initialGame.cpuHand,
      initialGame.table.playerTable,
      initialGame.table.opponentTable
    );

    setTutorialRuntime(runtimeState);
    setGameState(emptyStartingState);
    setPendingNextState(initialGame);
    setActiveSequence(dealSeq);
    setSelectedCardId(null);
    setActiveCollectionEvent(null);
    setCurrentScreen('TUTORIAL');
    soundEngine.playCardSlide();
  };

  // Start Learn-by-Playing / First Match Guided Experience
  const handleStartLearnByPlay = () => {
    const { state: initialFirstMatch, game: initialGame } = createInitialFirstMatch();
    MatchOrchestrator.getInstance().startMatch(initialGame, 'FIRST_MATCH', 'EASY');
    setGameMode('FIRST_MATCH');
    setFirstMatchState(initialFirstMatch);
    setLearnByPlayState(null);
    setTutorialRuntime(null);
    setPracticeConcept(null);
    setSelectedCardId(null);
    setActiveCollectionEvent(null);
    setCurrentScreen('MATCH');
    setIsGuidedMode(false);

    const emptyStartingState: GameState = {
      ...initialGame,
      playerHand: [],
      cpuHand: [],
      table: {
        playerTable: [],
        opponentTable: [],
        viewMode: 'INITIAL_VIEW',
      },
    };

    const dealSeq = generateDealSequence(
      1,
      initialGame.playerHand,
      initialGame.cpuHand,
      initialGame.table.playerTable,
      initialGame.table.opponentTable
    );

    const { match: newMatch } = createInitialMatch('SINGLE', Date.now(), 'player');
    setMatchState(newMatch);
    setGameState(emptyStartingState);
    setPendingNextState(initialGame);
    setActiveSequence(dealSeq);
    setGhostCardIds(new Set());
    soundEngine.playCardSlide();

    // Trigger Yoyo's Board Orientation flow
    const firstOrientation = MatchOrchestrator.getInstance().getNextOrientationStep();
    setActiveCoachingMoment(firstOrientation);
  };

  const handleAdvanceLearnByPlay = () => {
    if (!learnByPlayState) return;
    const { state: nextLearnState, game: nextGame } = advanceLearnByPlayPhase(
      learnByPlayState,
      gameState
    );
    setLearnByPlayState(nextLearnState);
    setGameState(nextGame);
    soundEngine.playSelect();
  };

  const handleLearnByPlayHint = () => {
    if (!learnByPlayState) return;
    const updated = requestLearnByPlayHint(learnByPlayState, gameState);
    setLearnByPlayState(updated);
  };

  // Helper to record lesson completion and persist to storage
  const recordLessonCompletion = (lesson: TutorialLesson) => {
    setCompletedLessons((prev) => {
      if (prev.includes(lesson)) return prev;
      const next = [...prev, lesson];
      storageSet(STORAGE_KEYS.COMPLETED_LESSONS, next);
      return next;
    });
  };

  // Advance to Next Lesson in Sequential Academy Journey
  const handleAdvanceNextLesson = () => {
    if (tutorialRuntime && tutorialRuntime.lesson < 4) {
      const currentLesson = tutorialRuntime.lesson;
      recordLessonCompletion(currentLesson);
      const nextLesson = (currentLesson + 1) as TutorialLesson;
      handleStartTutorial(nextLesson, isSequentialJourney);
    }
  };

  // Complete Current Lesson
  const handleCompleteLesson = () => {
    if (tutorialRuntime) {
      const currentLesson = tutorialRuntime.lesson;
      recordLessonCompletion(currentLesson);
      soundEngine.playCollectionCelebration('regular');
      setTutorialRuntime((prev) => (prev ? completeTutorialLesson(prev) : null));
    }
  };

  // Start Practice Concept
  const handleSelectPracticeConcept = (lesson: TutorialLesson) => {
    setIsPracticeModalOpen(false);
    setPracticeConcept(lesson);
    setIsSequentialJourney(false);

    const { runtimeState, initialGame } = createInitialTutorialRuntime(lesson);

    const emptyStartingState: GameState = {
      ...initialGame,
      playerHand: [],
      cpuHand: [],
      table: {
        playerTable: [],
        opponentTable: [],
        viewMode: 'INITIAL_VIEW',
      },
    };

    const dealSeq = generateDealSequence(
      1,
      initialGame.playerHand,
      initialGame.cpuHand,
      initialGame.table.playerTable,
      initialGame.table.opponentTable
    );

    setTutorialRuntime(runtimeState);
    setGameState(emptyStartingState);
    setPendingNextState(initialGame);
    setActiveSequence(dealSeq);
    setSelectedCardId(null);
    setActiveCollectionEvent(null);
    setCurrentScreen('PRACTICE');
    soundEngine.playCardSlide();
  };

  // Start Free Practice Sandbox Match
  const handleStartFreePractice = () => {
    setIsPracticeModalOpen(false);
    setPracticeConcept(null);
    setTutorialRuntime(null);
    handleStartNewMatch('SINGLE', 'player', Date.now(), true);
    setCurrentScreen('PRACTICE');
  };

  // Start Practice Table Sandbox from Lobby
  const handleStartPracticeTable = () => {
    setIsPracticeModalOpen(true);
  };

  // Start new match from lobby or restart
  const handleStartNewMatch = (
    format: MatchFormat = 'SINGLE',
    starter: PlayerId = 'player',
    customSeed?: number,
    guided: boolean = false,
    difficulty?: CpuDifficulty
  ) => {
    setGameMode('NORMAL');
    setFirstMatchState(null);
    setLearnByPlayState(null);
    setTutorialRuntime(null);
    setPracticeConcept(null);
    const seed = customSeed !== undefined ? customSeed : Date.now();
    const { match: newMatch, round: newGame } = createInitialMatch(format, seed, starter);
    const chosenDiff = difficulty || cpuDifficulty;
    MatchOrchestrator.getInstance().startMatch(newGame, 'NORMAL', chosenDiff);

    setIsGuidedMode(guided);
    if (difficulty) {
      setCpuDifficulty(difficulty);
    }

    // Initial empty state for table & hands to show initial deal flying from deck
    const emptyStartingState: GameState = {
      ...newGame,
      playerHand: [],
      cpuHand: [],
      table: {
        playerTable: [],
        opponentTable: [],
        viewMode: 'INITIAL_VIEW',
      },
    };

    const dealSeq = generateDealSequence(
      1,
      newGame.playerHand,
      newGame.cpuHand,
      newGame.table.playerTable,
      newGame.table.opponentTable
    );

    setMatchState(newMatch);
    setGameState(emptyStartingState);
    setPendingNextState(newGame);
    setActiveSequence(dealSeq);
    setSelectedCardId(null);
    setActiveCollectionEvent(null);
    setCurrentScreen('MATCH');
    soundEngine.playCardSlide();
  };

  // Start next round in a multi-round match
  const handleStartNextRound = () => {
    const { match: updatedMatch, round: nextRoundGame } = startNextRoundInMatch(matchState);

    const emptyStartingState: GameState = {
      ...nextRoundGame,
      playerHand: [],
      cpuHand: [],
      table: {
        playerTable: [],
        opponentTable: [],
        viewMode: 'INITIAL_VIEW',
      },
    };

    const dealSeq = generateDealSequence(
      1,
      nextRoundGame.playerHand,
      nextRoundGame.cpuHand,
      nextRoundGame.table.playerTable,
      nextRoundGame.table.opponentTable
    );

    setMatchState(updatedMatch);
    setGameState(emptyStartingState);
    setPendingNextState(nextRoundGame);
    setActiveSequence(dealSeq);
    setSelectedCardId(null);
    setActiveCollectionEvent(null);
    soundEngine.playCardSlide();
  };

  // Completion handler for active movement sequence with chained replenishment & collection detection
  const handleSequenceComplete = useCallback((_sequenceId: string) => {
    if (!pendingNextState) {
      setActiveSequence(null);
      setGhostCardIds(new Set());
      return;
    }

    const nextState = pendingNextState;

    // Check if a new collection was completed by comparing winning piles before & after
    const prevPlayerPile = gameState.playerWinningPile;
    const prevCpuPile = gameState.cpuWinningPile;

    const prevPlayerBreakdown = calculateScores(prevPlayerPile, 'player');
    const nextPlayerBreakdown = calculateScores(nextState.playerWinningPile, 'player');
    const playerCollection = detectNewlyCompletedCollection(
      prevPlayerBreakdown,
      nextPlayerBreakdown,
      'player'
    );

    const prevCpuBreakdown = calculateScores(prevCpuPile, 'cpu');
    const nextCpuBreakdown = calculateScores(nextState.cpuWinningPile, 'cpu');
    const cpuCollection = detectNewlyCompletedCollection(
      prevCpuBreakdown,
      nextCpuBreakdown,
      'cpu'
    );

    const newCollection = playerCollection || cpuCollection;
    if (newCollection) {
      setActiveCollectionEvent(newCollection);
      if (newCollection.type === 'GOLDEN_COMBO') {
        soundEngine.playCollectionCelebration('golden');
      } else if (newCollection.type === 'BALANCED_COMBO') {
        soundEngine.playCollectionCelebration('balanced');
      } else if (newCollection.type === 'JACK_SET') {
        soundEngine.playCollectionCelebration('jack');
      } else {
        soundEngine.playCollectionCelebration('regular');
      }
    }

    // Check if hand replenishment occurred
    if (
      nextState.dealNumber > gameState.dealNumber &&
      nextState.playerHand.length > 0 &&
      nextState.phase !== 'MATCH_END'
    ) {
      const interimState: GameState = {
        ...nextState,
        playerHand: [],
        cpuHand: [],
      };
      const dealSeq = generateDealSequence(
        nextState.dealNumber,
        nextState.playerHand,
        nextState.cpuHand
      );
      setGameState(interimState);
      setPendingNextState(nextState);
      setActiveSequence(dealSeq);
      setGhostCardIds(new Set());
      soundEngine.playCardSlide();
      return;
    }

    // Check if Round has ended (phase === 'MATCH_END')
    if (nextState.phase === 'MATCH_END' && matchState.status === 'IN_ROUND') {
      const { match: updatedMatch } = finalizeRoundInMatch(matchState, nextState);
      setMatchState(updatedMatch);
    }

    // If in Tutorial Mode or Practice Concept Mode, observe canonical outcome and evaluate learning objective
    if (
      (currentScreen === 'TUTORIAL' || (currentScreen === 'PRACTICE' && practiceConcept !== null)) &&
      tutorialRuntime &&
      lastPlayedPlayerCardRef.current
    ) {
      const evaluatedRuntime = evaluateTutorialActionResult(
        tutorialRuntime,
        gameState,
        nextState,
        lastPlayedPlayerCardRef.current
      );
      if (evaluatedRuntime.isSuccess) {
        recordLessonCompletion(evaluatedRuntime.lesson);
      }
      setTutorialRuntime(evaluatedRuntime);
      lastPlayedPlayerCardRef.current = null;
    }

    // If in Learn-by-Playing Mode, observe canonical outcome and evaluate interactive progression
    if (learnByPlayState && lastPlayedPlayerCardRef.current) {
      const { state: evaluatedLearn } = evaluateLearnByPlayAction(
        learnByPlayState,
        gameState,
        nextState,
        lastPlayedPlayerCardRef.current
      );
      if (evaluatedLearn.feedbackTitle?.includes('سرقة')) {
        soundEngine.playSteal();
      } else if (evaluatedLearn.feedbackTitle?.includes('مجموعة')) {
        soundEngine.playCollectionCelebration('regular');
      }
      setLearnByPlayState(evaluatedLearn);
      lastPlayedPlayerCardRef.current = null;
    }

    // If in First Match Guided Experience, observe canonical outcome and evaluate milestone progression
    if (gameMode === 'FIRST_MATCH' && firstMatchState && lastPlayedPlayerCardRef.current) {
      const nextFirstMatch = evaluateFirstMatchStep(
        firstMatchState,
        gameState,
        nextState,
        lastPlayedPlayerCardRef.current
      );
      if (nextFirstMatch.feedbackTitle?.includes('سرقة')) {
        soundEngine.playSteal();
      } else if (
        nextFirstMatch.feedbackTitle?.includes('مجموعة') ||
        nextFirstMatch.feedbackTitle?.includes('COMBO') ||
        nextFirstMatch.feedbackTitle?.includes('فضية')
      ) {
        soundEngine.playCollectionCelebration('regular');
      }
      setFirstMatchState(nextFirstMatch);
      lastPlayedPlayerCardRef.current = null;
    }

    setPendingNextState(null);
    setActiveSequence(null);
    setGhostCardIds(new Set());
    setGameState(nextState);
  }, [pendingNextState, gameState, matchState, currentScreen, tutorialRuntime, learnByPlayState, firstMatchState, gameMode]);

  // CPU turn execution effect with natural pacing (500ms - 900ms)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      (currentScreen === 'MATCH' || currentScreen === 'PRACTICE') &&
      !isAnimating &&
      gameState.phase === 'CPU_TURN' &&
      gameState.activeTurn === 'cpu'
    ) {
      // Natural pacing 700ms
      timer = setTimeout(() => {
        try {
          const result = MatchOrchestrator.getInstance().handleCpuMove(
            gameState,
            gameMode,
            firstMatchState,
            cpuDifficulty
          );
          const nextState = result.nextState;
          if (result.coachingMoment) {
            setActiveCoachingMoment(result.coachingMoment);
          }
          if (result.updatedFirstMatchState) {
            setFirstMatchState(result.updatedFirstMatchState);
          }
          if (!result.yoyoEvaluation.silent && result.yoyoEvaluation.dialogue) {
            setYoyoReaction({
              expression: result.yoyoEvaluation.expression,
              dialogue: result.yoyoEvaluation.dialogue,
            });
          }
          turnStartTimeRef.current = Date.now();

          const latestAction = nextState.actionHistory[nextState.actionHistory.length - 1];
          if (!latestAction) {
            setGameState(nextState);
            return;
          }

          const playedCard = gameState.cpuHand.find((c) => c.id === latestAction.cardId);
          if (!playedCard) {
            setGameState(nextState);
            return;
          }

          const captureRes = latestAction.captureResult || {
            capturedCards: [],
            capturedFrom: 'NONE',
            isTopUniformCapture: false,
            description: '',
          };

          if (captureRes.isTopUniformCapture) {
            soundEngine.playSteal();
          } else if (captureRes.capturedCards.length > 0) {
            soundEngine.playCapture();
          } else {
            soundEngine.playCardSlide();
          }

          const seq = generatePlayCardSequence('cpu', playedCard, captureRes);
          const ghosts = new Set<string>([
            playedCard.id,
            ...captureRes.capturedCards.map((c) => c.id),
          ]);

          setGhostCardIds(ghosts);
          setPendingNextState(nextState);
          setActiveSequence(seq);
        } catch (err) {
          console.error('Error during CPU turn:', err);
        }
      }, 700);
    }
    return () => clearTimeout(timer);
  }, [gameState, isAnimating, currentScreen, cpuDifficulty, firstMatchState]);

  // Dynamic Real-time Scores
  const playerBreakdown = React.useMemo(
    () => calculateScores(gameState.playerWinningPile, 'player'),
    [gameState.playerWinningPile]
  );
  const cpuBreakdown = React.useMemo(
    () => calculateScores(gameState.cpuWinningPile, 'cpu'),
    [gameState.cpuWinningPile]
  );

  const yoyoAnalysis = React.useMemo(() => {
    if (gameState.phase === 'MATCH_END' || matchState.status === 'MATCH_OVER') {
      return MatchOrchestrator.getInstance().getPostMatchAnalysis(
        gameState,
        playerBreakdown,
        cpuBreakdown
      );
    }
    return null;
  }, [gameState, matchState.status, playerBreakdown, cpuBreakdown]);

  // Handle Player Card Selection
  const handleCardSelect = (card: Card) => {
    if (isAnimating || gameState.phase !== 'PLAYER_TURN' || gameState.activeTurn !== 'player') {
      return;
    }
    soundEngine.playSelect();
    if (selectedCardId === card.id) {
      // Second tap plays immediately!
      handlePlayCard(card.id);
    } else {
      setSelectedCardId(card.id);
    }
  };

  // Play Selected Card with Movement Animation & Sound Effects
  const handlePlayCard = (cardIdToPlay?: string) => {
    const targetId = cardIdToPlay || selectedCardId;
    if (!targetId || isAnimating) return;

    if (gameState.phase !== 'PLAYER_TURN' || gameState.activeTurn !== 'player') {
      return;
    }

    try {
      const playedCard = gameState.playerHand.find((c) => c.id === targetId);
      if (!playedCard) return;

      lastPlayedPlayerCardRef.current = playedCard;

      const latency = turnStartTimeRef.current ? Date.now() - turnStartTimeRef.current : undefined;
      const turnResult = MatchOrchestrator.getInstance().handlePlayerMove(
        gameState,
        playedCard,
        gameMode,
        firstMatchState,
        latency
      );
      const nextState = turnResult.nextState;
      if (turnResult.coachingMoment) {
        setActiveCoachingMoment(turnResult.coachingMoment);
      }
      if (turnResult.updatedFirstMatchState) {
        setFirstMatchState(turnResult.updatedFirstMatchState);
      }
      if (!turnResult.yoyoEvaluation.silent && turnResult.yoyoEvaluation.dialogue) {
        setYoyoReaction({
          expression: turnResult.yoyoEvaluation.expression,
          dialogue: turnResult.yoyoEvaluation.dialogue,
        });
      }

      const latestAction = nextState.actionHistory[nextState.actionHistory.length - 1];

      const captureRes = latestAction?.captureResult || {
        capturedCards: [],
        capturedFrom: 'NONE',
        isTopUniformCapture: false,
        description: '',
      };

      if (captureRes.isTopUniformCapture) {
        soundEngine.playSteal();
      } else if (captureRes.capturedCards.length > 0) {
        soundEngine.playCapture();
      } else {
        soundEngine.playCardSlide();
      }

      const seq = generatePlayCardSequence('player', playedCard, captureRes);
      const ghosts = new Set<string>([
        playedCard.id,
        ...captureRes.capturedCards.map((c) => c.id),
      ]);

      setSelectedCardId(null);
      setGhostCardIds(ghosts);
      setPendingNextState(nextState);
      setActiveSequence(seq);
    } catch (err) {
      console.error('Error playing card:', err);
    }
  };

  // If in Lobby screen, render Lobby
  if (currentScreen === 'LOBBY') {
    return (
      <>
        <Lobby
          onStartMatch={(format, starter, guided, diff) => handleStartNewMatch(format, starter, undefined, guided, diff)}
          onStartLearnByPlay={handleStartLearnByPlay}
          onStartTutorial={(lesson, isSeq) => handleStartTutorial(lesson, isSeq ?? true)}
          onStartPracticeTable={() => handleStartPracticeTable()}
          onOpenRules={() => setIsRulesOpen(true)}
          completedLessons={completedLessons}
          initialDifficulty={cpuDifficulty}
          onDifficultyChange={setCpuDifficulty}
        />
        <RulesModal
          isOpen={isRulesOpen}
          onClose={() => setIsRulesOpen(false)}
        />
        <PracticeModal
          isOpen={isPracticeModalOpen}
          onClose={() => setIsPracticeModalOpen(false)}
          onSelectConcept={(lesson) => handleSelectPracticeConcept(lesson)}
          onStartFreePractice={() => handleStartFreePractice()}
        />
      </>
    );
  }

  // Active Guided Match Tip (if guided mode is active)
  const guidedTip: GuidedMatchTip | null =
    isGuidedMode && (currentScreen === 'MATCH' || currentScreen === 'PRACTICE')
      ? analyzeGuidedMatchState(gameState)
      : null;

  const playerSetsScore =
    playerBreakdown.goldenPoints +
    playerBreakdown.silverPoints +
    playerBreakdown.balancedPoints +
    playerBreakdown.doublePoints +
    playerBreakdown.jackSetPoints +
    playerBreakdown.regularSetPoints;
  const playerSinglesScore = playerBreakdown.jackPoints + playerBreakdown.cardPoints;

  const cpuSetsScore =
    cpuBreakdown.goldenPoints +
    cpuBreakdown.silverPoints +
    cpuBreakdown.balancedPoints +
    cpuBreakdown.doublePoints +
    cpuBreakdown.jackSetPoints +
    cpuBreakdown.regularSetPoints;
  const cpuSinglesScore = cpuBreakdown.jackPoints + cpuBreakdown.cardPoints;

  // Visible cards after subtracting in-flight ghost cards
  const visiblePlayerHand = gameState.playerHand.filter((c) => !ghostCardIds.has(c.id));
  const visibleCpuHandCount = Math.max(
    0,
    gameState.cpuHand.length - (ghostCardIds.size > 0 && gameState.activeTurn === 'cpu' ? 1 : 0)
  );
  const visiblePlayerTable = gameState.table.playerTable.filter((c) => !ghostCardIds.has(c.id));
  const visibleOpponentTable = gameState.table.opponentTable.filter((c) => !ghostCardIds.has(c.id));
  const visiblePlayerWinningPile = gameState.playerWinningPile.filter((c) => !ghostCardIds.has(c.id));
  const visibleCpuWinningPile = gameState.cpuWinningPile.filter((c) => !ghostCardIds.has(c.id));

  const selectedCard = visiblePlayerHand.find((c) => c.id === selectedCardId);
  const selectedRank = selectedCard ? selectedCard.rank : null;

  const isMultiRound = matchState.format !== 'SINGLE';

  return (
    <div className="relative min-h-screen w-full bg-[#0d1e13] text-white flex flex-col justify-between p-1.5 xs:p-2 sm:p-4 select-none font-sans overflow-x-hidden">
      {/* Visual Card Movement Layer */}
      <CardMovementLayer
        activeSequence={activeSequence}
        onSequenceComplete={handleSequenceComplete}
      />

      {/* Collection Celebration Feedback Layer */}
      <CollectionFeedbackLayer
        event={activeCollectionEvent}
        onComplete={() => setActiveCollectionEvent(null)}
      />

      {/* Top In-Match Header: Brand & Controls */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between px-1 xs:px-1.5 pb-1 z-20">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gradient-to-br from-[#f5b042] to-[#c8860a] p-0.5 shadow-sm flex items-center justify-center text-[#1f2e1c]">
            <Crown size={14} />
          </div>
          <span className="text-xs sm:text-sm font-black tracking-tight text-[#ffeb3b]">
            Egyptian Jacks
          </span>

          {/* Multi-Round Match Series Pill, Tutorial Indicator, or Practice Indicator */}
          {currentScreen === 'TUTORIAL' ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/50 text-[10px] sm:text-xs font-mono font-bold text-emerald-300 shadow-xs">
              <GraduationCap size={12} className="text-[#ffeb3b]" />
              <span className="text-[#ffeb3b]">الدرس {tutorialRuntime?.lesson || 1} من 4</span>
            </div>
          ) : currentScreen === 'PRACTICE' ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/50 text-[10px] sm:text-xs font-mono font-bold text-emerald-300 shadow-xs">
              <Sparkles size={12} className="text-[#ffeb3b]" />
              <span className="text-[#ffeb3b]">
                {practiceConcept ? `تمرين: ${tutorialRuntime?.lessonTitle || 'المفهوم'}` : 'ميدان التدريب الحر'}
              </span>
            </div>
          ) : isMultiRound ? (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 border border-[var(--gold)]/40 text-[10px] sm:text-xs font-mono font-bold text-white shadow-xs">
              <Swords size={11} className="text-[#ffeb3b]" />
              <span className="text-[#ffeb3b]">ج#{matchState.currentRound}</span>
              <span className="text-white/60">({matchState.playerRoundWins}-{matchState.cpuRoundWins})</span>
            </div>
          ) : null}

          {currentScreen !== 'TUTORIAL' && !practiceConcept && (
            <span className="hidden sm:inline text-[10px] text-white/50 font-mono">
              • التوزيع #{gameState.dealNumber}/6
            </span>
          )}
        </div>

        {/* Right Side: Memory Anchor Badge + In-Match Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {gameState.revealedLastCard && (
            <MemoryAnchorBadge
              card={gameState.revealedLastCard}
              isDealt={gameState.dealNumber >= 6}
            />
          )}

          <InMatchControls
            onExit={() => {
              if (currentScreen === 'TUTORIAL' || currentScreen === 'PRACTICE') {
                setCurrentScreen('LOBBY');
                setTutorialRuntime(null);
                setPracticeConcept(null);
              } else {
                setIsExitConfirmOpen(true);
              }
            }}
            onOpenRules={() => setIsRulesOpen(true)}
            onToggleLog={() => setIsLogOpen(true)}
          />
        </div>
      </header>

      {/* Guided Match Live Tip Banner (Non-intrusive Coaching for Free Practice / Match) */}
      {guidedTip && (
        <div className="w-full max-w-xl mx-auto px-2 py-1.5 mb-1 z-20 animate-fade-in">
          <div className="flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-950/95 via-[#0d2a17]/95 to-emerald-950/95 border border-emerald-500/50 shadow-lg text-xs">
            <div className="flex items-center gap-2.5 text-right flex-1 min-w-0">
              <YoyoAvatar expression="thinking" size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#ffeb3b] text-xs">{guidedTip.title}</span>
                  <span className="text-[10px] text-amber-300/80 font-semibold">(الكوتش يويو)</span>
                </div>
                <div className="text-emerald-100/90 text-[11px] leading-tight truncate sm:whitespace-normal">{guidedTip.message}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Coach Guidance Overlay (for Tutorial Lessons and Practice Concepts) */}
      {(currentScreen === 'TUTORIAL' || (currentScreen === 'PRACTICE' && practiceConcept !== null)) && tutorialRuntime && (
        <TutorialCoachOverlay
          runtime={tutorialRuntime}
          isSequentialJourney={isSequentialJourney}
          isPracticeMode={currentScreen === 'PRACTICE'}
          onRequestHint={() => {
            soundEngine.playSelect();
            setTutorialRuntime((prev) => (prev ? requestTutorialHint(prev, gameState) : null));
          }}
          onRetry={() => {
            if (currentScreen === 'PRACTICE' && practiceConcept) {
              handleSelectPracticeConcept(practiceConcept);
            } else {
              handleStartTutorial(tutorialRuntime.lesson, isSequentialJourney);
            }
          }}
          onAdvanceNextLesson={() => {
            handleAdvanceNextLesson();
          }}
          onCompleteLesson={() => {
            handleCompleteLesson();
          }}
          onExitTutorial={() => {
            soundEngine.playSelect();
            setTutorialRuntime(null);
            setPracticeConcept(null);
            setCurrentScreen('LOBBY');
          }}
        />
      )}

      {/* First Match Guided Companion: Coach Placement (Early / Guided Milestones) */}
      {gameMode === 'FIRST_MATCH' && firstMatchState && !(
        firstMatchState.yoyoStage === 'STAGE_5_CHALLENGE' ||
        firstMatchState.yoyoStage === 'STAGE_6_RIVAL' ||
        firstMatchState.yoyoStage === 'STAGE_7_RIVALRY' ||
        firstMatchState.isFreePlayActive ||
        firstMatchState.goldenAchieved
      ) && (
        <FirstMatchCoach
          state={firstMatchState}
          placement="coach"
          onRequestHint={() => {
            soundEngine.playSelect();
            setFirstMatchState((prev) => (prev ? requestFirstMatchHint(prev, gameState) : null));
          }}
          onExit={() => {
            soundEngine.playSelect();
            setFirstMatchState(null);
            setGameMode('NORMAL');
            setCurrentScreen('LOBBY');
          }}
        />
      )}

      {/* Learn by Playing Interactive Match Coach Banner */}
      {learnByPlayState && (
        <LearnByPlayCoach
          state={learnByPlayState}
          onAdvance={handleAdvanceLearnByPlay}
          onRequestHint={handleLearnByPlayHint}
          onExit={() => {
            soundEngine.playSelect();
            setLearnByPlayState(null);
            setCurrentScreen('LOBBY');
          }}
          onRetryCurrentPhase={() => {
            handleStartLearnByPlay();
          }}
          onPlayFullMatch={() => {
            setLearnByPlayState(null);
            handleStartNewMatch('SINGLE', 'player', undefined, false, 'EASY');
          }}
          onStartPracticeTable={() => {
            setLearnByPlayState(null);
            handleStartPracticeTable();
          }}
          onRestartTutorial={() => {
            handleStartLearnByPlay();
          }}
        />
      )}

      {/* Felt Card Table Canvas Wrapper */}
      <div
        id="app-container"
        className="relative flex-1 w-full max-w-5xl mx-auto flex flex-col justify-between items-center rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-[#144720] shadow-2xl p-2 xs:p-3 sm:p-4 overflow-hidden felt-surface"
      >
        {/* ROW 1: SCORES (LEFT: CPU SCORE, RIGHT: PLAYER SCORE) */}
        <div
          dir="ltr"
          className="relative z-10 w-full max-w-2xl flex items-center justify-between px-1 sm:px-2 pt-0.5"
        >
          {/* CPU Score (Left / CPU side) */}
          <div
            id="computer-score"
            dir="rtl"
            className="score-badge-ref px-2.5 xs:px-3 sm:px-4 py-1 sm:py-1.5 font-bold text-xs sm:text-sm flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-black/40 text-white shadow-md whitespace-nowrap"
          >
            {(firstMatchState || learnByPlayState) && (
              <YoyoAvatar
                expression={firstMatchState?.yoyoExpression ?? (learnByPlayState?.isFreePlayActive ? 'rival' : 'idle')}
                stage={firstMatchState?.yoyoStage ?? (learnByPlayState?.isFreePlayActive ? 'STAGE_6_RIVAL' : 'STAGE_2_COACH')}
                size="xs"
              />
            )}
            <span className="text-red-300">{(firstMatchState || learnByPlayState) ? 'يويو:' : 'الخصم:'}</span>
            <span className="text-[#ffeb3b] font-black text-xs xs:text-sm sm:text-base">
              {cpuBreakdown.totalScore}
            </span>
            <span className="text-[10px] sm:text-xs text-white/70 font-mono">
              ({cpuSetsScore}+{cpuSinglesScore})
            </span>
          </div>

          {/* Player Score (Right / Player side) */}
          <div
            id="player-score"
            dir="rtl"
            className="score-badge-ref px-2.5 xs:px-3 sm:px-4 py-1 sm:py-1.5 font-bold text-xs sm:text-sm flex items-center gap-1.5 rounded-xl border border-[#ffeb3b]/50 bg-black/40 text-white shadow-md whitespace-nowrap"
          >
            <span className="text-[#c8e6c9]">أنت:</span>
            <span className="text-[#ffeb3b] font-black text-xs xs:text-sm sm:text-base">
              {playerBreakdown.totalScore}
            </span>
            <span className="text-[10px] sm:text-xs text-white/70 font-mono">
              ({playerSetsScore}+{playerSinglesScore})
            </span>
          </div>
        </div>

        {/* ROW 2: CPU / RIVAL (OPPONENT SEAT & HAND AT TOP OF TABLE) */}
        <div className="relative z-10 w-full max-w-xl flex flex-col items-center gap-0.5 my-1">
          {/* Yoyo physically seated across the table in Rival Mode / Free Play */}
          {gameMode === 'FIRST_MATCH' && firstMatchState && (
            firstMatchState.yoyoStage === 'STAGE_5_CHALLENGE' ||
            firstMatchState.yoyoStage === 'STAGE_6_RIVAL' ||
            firstMatchState.yoyoStage === 'STAGE_7_RIVALRY' ||
            firstMatchState.isFreePlayActive ||
            firstMatchState.goldenAchieved
          ) && (
            <div className="w-full mb-1">
              <FirstMatchCoach
                state={firstMatchState}
                placement="rival"
                onRequestHint={() => {
                  soundEngine.playSelect();
                  setFirstMatchState((prev) => (prev ? requestFirstMatchHint(prev, gameState) : null));
                }}
                onExit={() => {
                  soundEngine.playSelect();
                  setFirstMatchState(null);
                  setGameMode('NORMAL');
                  setCurrentScreen('LOBBY');
                }}
              />
            </div>
          )}
          {learnByPlayState?.isFreePlayActive && (
            <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-950/80 border border-red-500/40 text-[10px] text-red-300 font-bold mb-0.5 shadow-sm animate-fade-in select-none">
              <Swords size={11} className="text-red-400" />
              <span>يد يويو (منافسك المباشر)</span>
            </div>
          )}

          {/* Yoyo Rival Presence across the table in Normal Match */}
          {gameMode === 'NORMAL' && currentScreen === 'MATCH' && (
            <div className="w-full mb-1">
              <YoyoRivalPresence
                expression={yoyoReaction.expression}
                dialogue={yoyoReaction.dialogue}
                isCpuThinking={!isAnimating && gameState.phase === 'CPU_TURN' && gameState.activeTurn === 'cpu'}
                archetype={MatchOrchestrator.getInstance().getBrain().getPlayerModel().getMetrics().archetype}
                difficultyLabel={
                  cpuDifficulty === 'EASY'
                    ? 'مستوى ودي'
                    : cpuDifficulty === 'MEDIUM'
                    ? 'مستوى منافس'
                    : 'مستوى محترف'
                }
              />
            </div>
          )}

          <div
            data-zone-anchor="CPU_HAND"
            className="w-full max-w-md px-2 py-1 sm:px-4 sm:py-1.5 rounded-xl border-2 border-dashed border-white/20 bg-black/15 flex items-center justify-center -space-x-2 sm:-space-x-3 min-h-[75px] sm:min-h-[90px] shadow-inner"
          >
            {Array.from({ length: visibleCpuHandCount }).map((_, idx) => (
              <div
                key={`cpu-card-${idx}`}
                className="transform transition-transform hover:-translate-y-0.5"
              >
                <CardView faceDown size="md" />
              </div>
            ))}
            {visibleCpuHandCount === 0 && (
              <span className="text-xs text-white/40 font-mono italic px-3">
                0 كروت
              </span>
            )}
          </div>
        </div>

        {/* ROW 3: MIDDLE ARENA (LTR: CPU PILE -> CPU TABLE -> PLAYER TABLE -> PLAYER PILE) */}
        <div
          id="table-section"
          data-zone-anchor="TABLE_CENTER"
          dir="ltr"
          className="relative z-10 w-full max-w-3xl flex-1 flex items-center justify-between gap-1.5 xs:gap-2 sm:gap-4 my-1 sm:my-2 px-0.5 sm:px-2"
        >
          {/* OPPONENT LAND */}
          <div data-zone-anchor="OPPONENT_LAND" className="flex items-center justify-start gap-1.5 xs:gap-2 sm:gap-4 flex-1">
            {/* FAR LEFT: CPU Winning Pile */}
            <div data-zone-anchor="OPPONENT_WINNING_PILE" className="flex-shrink-0 flex flex-col items-center">
              <WinningPileView
                title={firstMatchState ? 'كومة يويو' : 'كومة الخصم'}
                pile={visibleCpuWinningPile}
                isOpponent
                highlightMatchRank={selectedRank}
              />
            </div>

            {/* CENTER LEFT: CPU Table Stack */}
            <div data-zone-anchor="OPPONENT_TABLE" className="flex-1 min-w-0 max-w-[170px] sm:max-w-[210px] flex flex-col items-center">
              <TableStackView
                title={firstMatchState ? 'طاولة يويو' : 'طاولة الخصم'}
                cards={visibleOpponentTable}
                viewMode={gameState.table.viewMode}
                isOpponent
                highlightRank={selectedRank}
              />
            </div>
          </div>

          {/* PLAYER LAND */}
          <div data-zone-anchor="PLAYER_LAND" className="flex items-center justify-end gap-1.5 xs:gap-2 sm:gap-4 flex-1">
            {/* CENTER RIGHT: Player Table Stack */}
            <div data-zone-anchor="PLAYER_TABLE" className="flex-1 min-w-0 max-w-[170px] sm:max-w-[210px] flex flex-col items-center">
              <TableStackView
                title="طاولتك"
                cards={visiblePlayerTable}
                viewMode={gameState.table.viewMode}
                highlightRank={selectedRank}
              />
            </div>

            {/* FAR RIGHT: Player Winning Pile */}
            <div data-zone-anchor="PLAYER_WINNING_PILE" className="flex-shrink-0 flex flex-col items-center">
              <WinningPileView
                title="كومة فوزك"
                pile={visiblePlayerWinningPile}
              />
            </div>
          </div>
        </div>

        {/* ROW 4: PLAYER HAND (FULL WIDTH, CLEAR, TAPPABLE) */}
        <div className="relative z-10 w-full max-w-xl flex flex-col items-center gap-0.5 my-1">
          <div
            data-zone-anchor="PLAYER_HAND"
            className="w-full px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl border-2 border-dashed border-[#ffeb3b] bg-black/15 backdrop-blur-xs flex items-center justify-center gap-1.5 sm:gap-3 overflow-x-auto min-h-[95px] xs:min-h-[105px] sm:min-h-[120px] shadow-inner"
          >
            {visiblePlayerHand.map((card) => (
              <CardView
                key={card.id}
                card={card}
                selected={selectedCardId === card.id}
                onClick={() => handleCardSelect(card)}
                disabled={
                  isAnimating ||
                  gameState.phase !== 'PLAYER_TURN' ||
                  gameState.activeTurn !== 'player'
                }
                size="md"
              />
            ))}
            {visiblePlayerHand.length === 0 && (
              <span className="text-xs text-[#ffeb3b]/70 font-mono italic">
                {gameState.phase === 'MATCH_END'
                  ? 'انتهت الجولة!'
                  : 'توزيع الكروت...'}
              </span>
            )}
          </div>
        </div>

        {/* ROW 5: CONTROLS (COMPACT: DECK COUNT ON LEFT, TURN BADGE CENTER, PLAY BUTTON ON RIGHT) */}
        <div
          dir="ltr"
          className="relative z-10 w-full max-w-xl flex items-center justify-between gap-2 px-1 sm:px-2 pt-1"
        >
          {/* Deck count (Left) */}
          <div
            data-zone-anchor="DECK"
            dir="rtl"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/40 border border-white/20 text-[11px] sm:text-xs font-mono font-bold text-white shadow-xs"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#ffeb3b] animate-pulse" />
            الرزمة: <span className="text-[#ffeb3b]">{gameState.deck.length}</span>
          </div>

          {/* Turn Badge (Centered) */}
          <div dir="rtl">
            {gameState.phase === 'MATCH_END' ? (
              <span className="px-3 py-1 rounded-full btn-yellow-ref text-[11px] sm:text-xs font-black tracking-wide shadow-md whitespace-nowrap">
                انتهت الجولة
              </span>
            ) : gameState.phase === 'PLAYER_TURN' && gameState.activeTurn === 'player' ? (
              <span className="px-3 py-1 rounded-full bg-black/60 border border-[#ffeb3b] text-[#ffeb3b] text-[11px] sm:text-xs font-bold tracking-wide shadow-md flex items-center gap-1.5 animate-pulse whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ffeb3b] shadow-[0_0_8px_#ffeb3b]" />
                دورك
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-black/50 border border-white/20 text-white/70 text-[11px] sm:text-xs font-medium tracking-wide flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ffeb3b] animate-ping" />
                تفكير الخصم...
              </span>
            )}
          </div>

          {/* Play Button (Right) */}
          <button
            type="button"
            dir="rtl"
            disabled={
              !selectedCardId ||
              isAnimating ||
              gameState.phase !== 'PLAYER_TURN' ||
              gameState.activeTurn !== 'player'
            }
            onClick={() => handlePlayCard()}
            className={`px-3.5 sm:px-5 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold shadow-md transition flex items-center gap-1 ${
              selectedCardId && !isAnimating && gameState.phase === 'PLAYER_TURN'
                ? 'btn-yellow-ref cursor-pointer'
                : 'bg-black/30 text-white/40 opacity-50 cursor-not-allowed border border-white/10'
            }`}
          >
            <Zap size={13} />
            العب الكارت
          </button>
        </div>
      </div>

      {/* Round Summary Modal (for multi-round matches between rounds) */}
      <RoundSummaryModal
        isOpen={matchState.status === 'ROUND_SUMMARY'}
        matchState={matchState}
        gameState={gameState}
        onStartNextRound={handleStartNextRound}
        onBackToLobby={() => setCurrentScreen('LOBBY')}
      />

      {/* Final Game / Match Over Modal */}
      <GameOverModal
        isOpen={matchState.status === 'MATCH_OVER' || (matchState.format === 'SINGLE' && gameState.phase === 'MATCH_END')}
        winner={matchState.format === 'SINGLE' ? gameState.winner : matchState.matchWinner}
        playerScore={gameState.playerScore}
        cpuScore={gameState.cpuScore}
        matchState={matchState}
        gameState={gameState}
        yoyoAnalysis={yoyoAnalysis}
        firstMatchMilestones={firstMatchState?.milestones}
        onPlayAgain={() => handleStartNewMatch(matchState.format, matchState.matchStarter)}
        onBackToLobby={() => setCurrentScreen('LOBBY')}
      />

      {/* Rules Modal */}
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />

      {/* History Log Drawer */}
      <HistoryLogDrawer
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        events={gameState.eventLog}
      />

      {/* Exit Confirmation Modal */}
      <ExitConfirmModal
        isOpen={isExitConfirmOpen}
        onStay={() => setIsExitConfirmOpen(false)}
        onLeave={() => {
          setIsExitConfirmOpen(false);
          setCurrentScreen('LOBBY');
        }}
      />

      {/* Practice Table Selection Modal */}
      <PracticeModal
        isOpen={isPracticeModalOpen}
        onClose={() => setIsPracticeModalOpen(false)}
        onSelectConcept={(lesson) => handleSelectPracticeConcept(lesson)}
        onStartFreePractice={() => handleStartFreePractice()}
      />

      {/* Yoyo Board Director: Non-intrusive Live Coaching, Grounded Spotlight & Teaching Cards */}
      <YoyoBoardDirector
        moment={activeCoachingMoment}
        onDismiss={handleDismissCoachingMoment}
        onNextStep={handleNextOrientationStep}
      />
    </div>
  );
};

