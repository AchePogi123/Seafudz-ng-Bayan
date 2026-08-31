import React, { useState, useEffect, useRef } from 'react';

interface Bubble {
  id: number;
  x: number; // percentage X position
  y: number; // percentage Y viewport position (15 - 85vh)
  size: number; // px size (6 - 16px minimal)
  duration: number; // floating animation seconds (2.2 - 3.8)
  driftX: number; // gentle horizontal drift (-20px to 20px)
  floatY: number; // vertical rising pixels (-80px to -160px)
  opacity: number; // soft minimal opacity (0.18 - 0.35)
  color: string; // delicate gradient
}

export const ScrollBubbles: React.FC = () => {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const lastScrollY = useRef(0);
  const nextId = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    // Soft, minimal translucent pearl bubble gradients
    const BUBBLE_COLORS = [
      'radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.1) 70%)',
      'radial-gradient(circle at 35% 35%, rgba(202, 240, 248, 0.75), rgba(0, 180, 216, 0.15) 70%)',
      'radial-gradient(circle at 35% 35%, rgba(148, 210, 189, 0.7), rgba(10, 147, 150, 0.12) 70%)',
    ];

    const spawnBubbles = (count: number) => {
      const newBubbles: Bubble[] = [];
      for (let i = 0; i < count; i++) {
        const id = ++nextId.current;
        // Spawns gently along Left margin (2% to 10%) or Right margin (90% to 98%)
        const isLeft = Math.random() < 0.5;
        const x = isLeft ? Math.random() * 8 + 2 : Math.random() * 8 + 90;

        // Spreads vertically across screen height (15vh to 85vh)
        const y = Math.random() * 70 + 15;

        const driftX = (Math.random() - 0.5) * 40; // -20px to +20px
        const floatY = -(Math.random() * 80 + 80); // -80px to -160px float

        newBubbles.push({
          id,
          x,
          y,
          size: Math.floor(Math.random() * 10) + 6, // 6px to 16px minimal bubbles
          duration: Math.random() * 1.6 + 2.2, // 2.2s to 3.8s
          driftX,
          floatY,
          opacity: Math.random() * 0.17 + 0.18, // 0.18 to 0.35 soft opacity
          color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)]
        });
      }

      setBubbles(prev => [...prev.slice(-20), ...newBubbles]);
    };

    const handleScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const delta = Math.abs(currentScrollY - lastScrollY.current);

          if (delta > 8) {
            const count = delta > 40 ? 2 : 1; // Minimal spawn rate (1 or 2 max)
            spawnBubbles(count);
            lastScrollY.current = currentScrollY;
          }
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const removeBubble = (id: number) => {
    setBubbles(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-35 overflow-hidden">
      <style>{`
        @keyframes minimalBubbleSpread {
          0% {
            transform: translate3d(0, 0, 0) scale(0.4);
            opacity: 0;
          }
          25% {
            opacity: var(--bubble-opacity, 0.25);
          }
          75% {
            opacity: var(--bubble-opacity, 0.25);
          }
          100% {
            transform: translate3d(var(--drift-x), var(--float-y), 0) scale(1.1);
            opacity: 0;
          }
        }
      `}</style>

      {bubbles.map(bubble => (
        <span
          key={bubble.id}
          onAnimationEnd={() => removeBubble(bubble.id)}
          className="absolute rounded-full border border-white/40 shadow-[0_0_6px_rgba(255,255,255,0.3)] pointer-events-none"
          style={{
            left: `${bubble.x}%`,
            top: `${bubble.y}vh`,
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            background: bubble.color,
            '--bubble-opacity': bubble.opacity,
            '--drift-x': `${bubble.driftX}px`,
            '--float-y': `${bubble.floatY}px`,
            animation: `minimalBubbleSpread ${bubble.duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
            willChange: 'transform, opacity'
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

export default ScrollBubbles;
