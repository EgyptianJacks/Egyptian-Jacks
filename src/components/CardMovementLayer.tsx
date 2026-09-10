import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MovementSequence, ZoneRect } from '../types/movement';
import { resolveAnchorRect } from '../engine/anchorResolver';
import { CardView } from './CardView';

interface CardMovementLayerProps {
  activeSequence: MovementSequence | null;
  onSequenceComplete: (sequenceId: string) => void;
}

export const CardMovementLayer: React.FC<CardMovementLayerProps> = ({
  activeSequence,
  onSequenceComplete,
}) => {
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [impactFlash, setImpactFlash] = useState<{ x: number; y: number; id: string } | null>(null);

  // Reset stage when a new sequence begins
  useEffect(() => {
    if (activeSequence) {
      setCurrentStage(0);
      setImpactFlash(null);
    }
  }, [activeSequence?.id]);

  // Determine reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }, []);

  // Filter items belonging to the current stage
  const stageItems = useMemo(() => {
    if (!activeSequence) return [];
    return activeSequence.items.filter((item) => item.stage === currentStage);
  }, [activeSequence, currentStage]);

  // Advance stage or complete sequence once stage duration elapses
  useEffect(() => {
    if (!activeSequence || stageItems.length === 0) return;

    // Trigger destination impact flash if capturing or stealing
    const captureItem = stageItems.find(
      (item) => item.destinationZone === 'PLAYER_WINNING_PILE' || item.destinationZone === 'CPU_WINNING_PILE'
    );
    if (captureItem && !prefersReducedMotion) {
      const destRect = resolveAnchorRect(captureItem.destinationZone, captureItem.destinationCardId);
      setImpactFlash({
        x: destRect.x + (destRect.width || 60) / 2,
        y: destRect.y + (destRect.height || 90) / 2,
        id: `${activeSequence.id}_${currentStage}`,
      });
    }

    // Calculate maximum time required for the current stage
    let maxTimeMs = 0;
    stageItems.forEach((item) => {
      const totalTime = item.delayMs + item.durationMs;
      if (totalTime > maxTimeMs) {
        maxTimeMs = totalTime;
      }
    });

    const bufferMs = prefersReducedMotion ? 10 : 20;
    const stageTimer = setTimeout(() => {
      const nextStage = currentStage + 1;
      if (nextStage < activeSequence.totalStages) {
        setCurrentStage(nextStage);
      } else {
        onSequenceComplete(activeSequence.id);
      }
    }, (prefersReducedMotion ? 40 : maxTimeMs) + bufferMs);

    return () => clearTimeout(stageTimer);
  }, [activeSequence, currentStage, stageItems, prefersReducedMotion, onSequenceComplete]);

  if (!activeSequence || stageItems.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden select-none">
      {/* Capture / Steal Impact Gold Ring Burst */}
      {impactFlash && !prefersReducedMotion && (
        <div
          key={impactFlash.id}
          className="fixed pointer-events-none z-40 -translate-x-1/2 -translate-y-1/2"
          style={{ left: impactFlash.x, top: impactFlash.y }}
        >
          <div className="w-20 h-20 rounded-full border-2 border-[var(--gold)]/80 animate-capture-impact bg-[var(--gold)]/20 shadow-[0_0_24px_var(--gold)]" />
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {stageItems.map((item) => {
          const origin: ZoneRect = resolveAnchorRect(item.originZone, item.originCardId);
          const dest: ZoneRect = resolveAnchorRect(item.destinationZone, item.destinationCardId);

          const durationSec = prefersReducedMotion ? 0.05 : item.durationMs / 1000;
          const delaySec = prefersReducedMotion ? 0 : item.delayMs / 1000;

          return (
            <motion.div
              key={`${activeSequence.id}_stage${currentStage}_${item.id}`}
              initial={{
                position: 'fixed',
                left: 0,
                top: 0,
                x: origin.x,
                y: origin.y,
                scale: 0.95,
                opacity: 0.95,
                rotate: 0,
                zIndex: 60,
              }}
              animate={{
                x: dest.x,
                y: dest.y,
                scale: [0.95, 1.06, 1],
                opacity: 1,
                rotate: item.rotationDeg || 0,
                zIndex: 70,
              }}
              exit={{
                opacity: 0,
                scale: 1,
                transition: { duration: 0.02 },
              }}
              transition={{
                duration: durationSec,
                delay: delaySec,
                ease: [0.2, 0.85, 0.3, 1], // Smooth physical card arc with slight lift and soft settle
              }}
              className="drop-shadow-2xl will-change-transform"
              style={{
                width: origin.width || 64,
                height: origin.height || 96,
              }}
            >
              <CardView
                card={item.card}
                faceDown={item.faceDown}
                size="md"
                className="w-full h-full shadow-2xl"
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

