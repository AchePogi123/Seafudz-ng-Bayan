import React from 'react'

export const OceanCreatures: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      <style>{`
        @keyframes swimRight {
          0% { transform: translateX(-15vw) translateY(0) rotate(0deg); }
          25% { transform: translateX(20vw) translateY(-20px) rotate(3deg); }
          50% { transform: translateX(50vw) translateY(-30px) rotate(2deg); }
          75% { transform: translateX(80vw) translateY(12px) rotate(5deg); }
          100% { transform: translateX(115vw) translateY(0) rotate(0deg); }
        }
        @keyframes swimLeft {
          0% { transform: translateX(115vw) translateY(0) rotate(0deg); }
          25% { transform: translateX(80vw) translateY(20px) rotate(4deg); }
          50% { transform: translateX(50vw) translateY(30px) rotate(-3deg); }
          75% { transform: translateX(20vw) translateY(-15px) rotate(-5deg); }
          100% { transform: translateX(-15vw) translateY(0) rotate(0deg); }
        }
        @keyframes fishWiggle {
          0%, 100% { transform: rotate(0deg) scaleY(1); }
          25% { transform: rotate(2.5deg) scaleY(0.96); }
          50% { transform: rotate(0deg) scaleY(1.03); }
          75% { transform: rotate(-2.5deg) scaleY(0.96); }
        }
        @keyframes crabSwimRight {
          0% { transform: translateX(-15vw) translateY(0px) rotate(-4deg); }
          25% { transform: translateX(20vw) translateY(-15px) rotate(4deg); }
          50% { transform: translateX(55vw) translateY(10px) rotate(-4deg); }
          75% { transform: translateX(85vw) translateY(-10px) rotate(3deg); }
          100% { transform: translateX(115vw) translateY(0px) rotate(-4deg); }
        }
        @keyframes crabPaddle {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.05) rotate(4deg); }
        }
        @keyframes squidSwim {
          0% { transform: translateX(115vw) translateY(10px) rotate(3deg); }
          33% { transform: translateX(70vw) translateY(-20px) rotate(-3deg); }
          66% { transform: translateX(30vw) translateY(15px) rotate(2deg); }
          100% { transform: translateX(-15vw) translateY(0px) rotate(0deg); }
        }
        @keyframes squidPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08) scaleX(0.94); }
        }
        @keyframes mantaSwimRight {
          0% { transform: translateX(-20vw) translateY(0px) rotate(0deg); }
          25% { transform: translateX(25vw) translateY(-18px) rotate(-1.5deg); }
          50% { transform: translateX(60vw) translateY(12px) rotate(2deg); }
          75% { transform: translateX(90vw) translateY(-10px) rotate(-1deg); }
          100% { transform: translateX(120vw) translateY(0px) rotate(0deg); }
        }
        @keyframes mantaWingWave {
          0%, 100% { transform: scaleY(1) translateY(0px); }
          50% { transform: scaleY(0.88) translateY(2px); }
        }
        @keyframes turtleSwimLeft {
          0% { transform: translateX(120vw) translateY(0px) rotate(0deg); }
          30% { transform: translateX(75vw) translateY(-20px) rotate(2deg); }
          65% { transform: translateX(35vw) translateY(15px) rotate(-2deg); }
          100% { transform: translateX(-20vw) translateY(0px) rotate(0deg); }
        }
        @keyframes flipperPaddle {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-10deg); }
        }
      `}</style>

      {/* Swimming Fish 1 (Swimming Right - Nose at x=90 leads forward) */}
      <div className="absolute top-12 left-0 animate-[swimRight_24s_ease-in-out_infinite] opacity-40">
        <svg className="w-24 h-12 text-[#caf0f8] animate-[fishWiggle_1.8s_ease-in-out_infinite]" viewBox="0 0 100 60" fill="currentColor">
          <path d="M90,30 Q65,5 35,30 Q65,55 90,30 Z M35,30 L8,12 L18,30 L8,48 Z M60,14 Q48,6 42,14" />
        </svg>
      </div>

      {/* Swimming Crab (Side Paddling Right) */}
      <div className="absolute top-1/3 left-0 animate-[crabSwimRight_22s_linear_infinite] opacity-50" style={{ animationDelay: '2s' }}>
        <svg className="w-20 h-16 text-orange-300 animate-[crabPaddle_1.5s_ease-in-out_infinite]" viewBox="0 0 100 80" fill="currentColor">
          <path d="M 25 45 C 25 28 75 28 75 45 C 75 58 25 58 25 45 Z" />
          <path d="M 30 35 C 18 20 8 28 20 38 C 24 40 28 42 32 44 Z" />
          <path d="M 70 35 C 82 20 92 28 80 38 C 76 40 72 42 68 44 Z" />
          <path d="M 28 48 C 18 52 12 60 14 66 M 32 52 C 22 58 18 68 20 74 M 36 55 C 28 62 25 72 27 78" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <path d="M 72 48 C 82 52 88 60 86 66 M 68 52 C 78 58 82 68 80 74 M 64 55 C 72 62 75 72 73 78" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          <circle cx="42" cy="28" r="3.5" />
          <circle cx="58" cy="28" r="3.5" />
        </svg>
      </div>

      {/* Swimming Squid 1 (Main Leader) */}
      <div className="absolute top-[45%] right-0 animate-[squidSwim_20s_linear_infinite] opacity-45">
        <svg className="w-22 h-14 text-[#94d2bd] animate-[squidPulse_2s_ease-in-out_infinite]" viewBox="0 0 100 60" fill="currentColor">
          <path d="M 70 30 C 55 16 20 16 10 30 C 20 44 55 44 70 30 Z" />
          <path d="M 12 30 L 2 18 L 18 25 Z M 12 30 L 2 42 L 18 35 Z" />
          <path d="M 70 24 C 82 20 92 22 98 25 M 70 28 C 84 27 94 28 100 30 M 70 32 C 84 33 94 32 100 30 M 70 36 C 82 40 92 38 98 35" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      {/* Swimming Squid 2 (Upper Companion) */}
      <div className="absolute top-[22%] right-0 animate-[squidSwim_24s_linear_infinite] opacity-40" style={{ animationDelay: '4s' }}>
        <svg className="w-16 h-10 text-[#caf0f8] animate-[squidPulse_1.8s_ease-in-out_infinite]" viewBox="0 0 100 60" fill="currentColor">
          <path d="M 70 30 C 55 16 20 16 10 30 C 20 44 55 44 70 30 Z" />
          <path d="M 12 30 L 2 18 L 18 25 Z M 12 30 L 2 42 L 18 35 Z" />
          <path d="M 70 24 C 82 20 92 22 98 25 M 70 28 C 84 27 94 28 100 30 M 70 32 C 84 33 94 32 100 30 M 70 36 C 82 40 92 38 98 35" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      {/* Swimming Fish 2 (Swimming Left - Nose at x=10 leads forward) */}
      <div className="absolute top-1/4 left-0 animate-[swimLeft_28s_ease-in-out_infinite] opacity-35" style={{ animationDelay: '3s' }}>
        <svg className="w-20 h-10 text-white/50 animate-[fishWiggle_1.5s_ease-in-out_infinite]" viewBox="0 0 100 60" fill="currentColor">
          <path d="M10,30 Q35,5 65,30 Q35,55 10,30 Z M65,30 L92,12 L82,30 L92,48 Z M40,14 Q52,6 58,14" />
        </svg>
      </div>

      {/* Swimming Fish 3 (Swimming Right - Nose at x=90 leads forward) */}
      <div className="absolute top-1/3 left-0 animate-[swimRight_14s_ease-in-out_infinite] opacity-40" style={{ animationDelay: '1s' }}>
        <svg className="w-14 h-7 text-[#caf0f8] animate-[fishWiggle_1.2s_ease-in-out_infinite]" viewBox="0 0 100 60" fill="currentColor">
          <path d="M90,30 Q65,5 35,30 Q65,55 90,30 Z M35,30 L8,12 L18,30 L8,48 Z M60,14 Q48,6 42,14" />
        </svg>
      </div>

      {/* Swimming Fish 4 (Swimming Right - Nose at x=90 leads forward) */}
      <div className="absolute bottom-16 left-0 animate-[swimRight_19s_ease-in-out_infinite] opacity-35" style={{ animationDelay: '7s' }}>
        <svg className="w-16 h-8 text-[#94d2bd] animate-[fishWiggle_1.6s_ease-in-out_infinite]" viewBox="0 0 100 60" fill="currentColor">
          <path d="M90,30 Q65,5 35,30 Q65,55 90,30 Z M35,30 L8,12 L18,30 L8,48 Z M60,14 Q48,6 42,14" />
        </svg>
      </div>

      {/* Manta Ray Gliding Horizontally RIGHT (Facing Right Head-First) */}
      <div className="absolute top-[28%] left-0 animate-[mantaSwimRight_26s_linear_infinite] opacity-45">
        <svg className="w-48 h-28 text-[#caf0f8] animate-[mantaWingWave_2.8s_ease-in-out_infinite]" viewBox="0 0 150 90" fill="currentColor">
          <path d="M 132 45 C 112 28 78 8 56 3 C 60 22 55 38 42 45 C 55 52 60 68 56 87 C 78 82 112 62 132 45 Z" />
          <path d="M 130 38 Q 142 32 144 40 Q 138 44 132 44 Z" />
          <path d="M 130 52 Q 142 58 144 50 Q 138 46 132 46 Z" />
          <path d="M 95 32 Q 88 45 95 58 M 82 35 Q 76 45 82 55" stroke="rgba(0,45,60,0.35)" strokeWidth="1.5" fill="none" />
          <path d="M 42 45 Q 22 46 3 48" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      {/* Pawikan Sea Turtle Paddling Horizontally LEFT (Facing Left Head-First) */}
      <div className="absolute top-[60%] left-0 animate-[turtleSwimLeft_32s_ease-in-out_infinite] opacity-45" style={{ animationDelay: '3s' }}>
        <svg className="w-36 h-24 text-[#94d2bd] animate-[flipperPaddle_2s_ease-in-out_infinite]" viewBox="0 0 130 90" fill="currentColor">
          <ellipse cx="68" cy="45" rx="28" ry="20" />
          <path d="M 68 25 L 56 36 L 56 54 L 68 65 L 80 54 L 80 36 Z M 56 36 L 42 34 M 56 54 L 42 56 M 80 36 L 94 34 M 80 54 L 94 56 M 68 25 L 68 23 M 68 65 L 68 67" stroke="rgba(0,45,60,0.55)" strokeWidth="1.5" fill="none" />
          <path d="M 42 45 C 32 38 22 40 14 45 C 22 50 32 52 42 45 Z" />
          <circle cx="22" cy="44" r="1.5" fill="rgba(0,45,60,0.8)" />
          <path d="M 54 30 Q 32 10 16 16 Q 30 28 46 36 Z" />
          <path d="M 54 60 Q 32 80 16 74 Q 30 62 46 54 Z" />
          <path d="M 94 30 Q 108 22 116 28 Q 106 34 98 36 Z" />
          <path d="M 94 60 Q 108 68 116 62 Q 106 56 98 54 Z" />
          <path d="M 96 45 L 106 45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

export const ArchiveCreatures = OceanCreatures;
export default OceanCreatures;
