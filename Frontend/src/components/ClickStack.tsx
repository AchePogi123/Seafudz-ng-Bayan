import React, { useState } from 'react';

export interface ClickStackItem {
  id: string | number;
  title: string;
  subtitle?: string;
  content: string;
  badge?: string;
}

export interface ClickStackProps {
  items: ClickStackItem[];
  className?: string;
}

export const ClickStack: React.FC<ClickStackProps> = ({ items, className = '' }) => {
  const [stack, setStack] = useState<ClickStackItem[]>(items);

  const handleClick = (index: number) => {
    if (index === 0) {
      // Cycle top card to the back of the stack
      setStack(prev => {
        const [first, ...rest] = prev;
        return [...rest, first];
      });
    } else {
      // Bring clicked card to top focus
      setStack(prev => {
        const clicked = prev[index];
        const remaining = prev.filter((_, i) => i !== index);
        return [clicked, ...remaining];
      });
    }
  };

  return (
    <div className={`relative w-full min-h-[440px] sm:min-h-[460px] sm:aspect-square max-w-[520px] mx-auto ${className}`}>
      {stack.map((item, index) => {
        const isTop = index === 0;
        const offset = Math.min(index, 4) * 14;
        const scale = 1 - Math.min(index, 4) * 0.035;
        const opacity = 1 - Math.min(index, 4) * 0.15;
        const zIndex = stack.length - index;

        return (
          <div
            key={item.id}
            onClick={() => handleClick(index)}
            className={`absolute inset-0 bg-[#001e28]/95 backdrop-blur-2xl border border-[#0a9396]/40 p-6 sm:p-10 rounded-[28px] sm:rounded-[32px] shadow-[0_-20px_45px_rgba(0,0,0,0.4)] hover:border-[#94d2bd] hover:shadow-[0_0_35px_rgba(148,210,189,0.35)] transition-all duration-500 ease-out group overflow-hidden cursor-pointer select-none flex flex-col justify-between ${
              isTop ? 'hover:-translate-y-2' : ''
            }`}
            style={{
              transform: `translateY(${offset}px) scale(${scale})`,
              opacity: opacity,
              zIndex: zIndex,
            }}
          >
            {/* Ambient Card Light Reflection Glow */}
            <div className="absolute -top-24 -right-24 w-52 h-52 bg-gradient-to-br from-[#0a9396]/40 via-[#94d2bd]/25 to-transparent blur-3xl rounded-full pointer-events-none group-hover:scale-150 transition-transform duration-700" />

            {/* Top Header */}
            <div>
              <div className="flex items-center justify-between gap-4 mb-5 relative z-10">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-[#0a9396]/20 border border-[#0a9396]/40 text-[#94d2bd] flex items-center justify-center text-sm font-mono font-extrabold group-hover:bg-[#0a9396] group-hover:text-white transition-all duration-300">
                    {item.badge || `0${(index % 9) + 1}`}
                  </span>
                  <span className="text-[10px] font-mono tracking-[0.2em] text-[#94d2bd] font-bold uppercase">
                    {item.subtitle || 'FAQ EXHIBIT'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-400 group-hover:text-[#94d2bd] transition-colors font-semibold">
                    {isTop ? 'CLICK TO CYCLE' : 'CLICK TO FOCUS'}
                  </span>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#0a9396] group-hover:bg-[#94d2bd] group-hover:shadow-[0_0_12px_#94d2bd] transition-all duration-300" />
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-4 tracking-tight group-hover:text-[#94d2bd] transition-colors leading-snug relative z-10">
                {item.title}
              </h3>
            </div>

            {/* Bottom Content */}
            <p className="text-sm sm:text-base text-neutral-200 leading-relaxed font-normal relative z-10">
              {item.content}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default ClickStack;
