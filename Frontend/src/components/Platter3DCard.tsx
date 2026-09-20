import React, { useRef, useState, useCallback } from 'react';

interface Platter3DCardProps {
  image: string;
  title: string;
  description?: string;
  price: number;
  serves: string;
  tag1: string;
  tag2: string;
  orderLink?: string;
}

export const Platter3DCard: React.FC<Platter3DCardProps> = ({
  image,
  title,
  price,
  serves,
  tag1,
  tag2
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, rotateZ: 0 });
  const [isHovered, setIsHovered] = useState(false);
  // Mouse move 3D tilt calculations
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Smooth tilt angles (-14deg to +14deg)
    const rotateX = ((y - centerY) / centerY) * -14;
    const rotateY = ((x - centerX) / centerX) * 14;

    setTilt({ rotateX, rotateY, rotateZ: (x - centerX) * 0.02 });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTilt({ rotateX: 0, rotateY: 0, rotateZ: 0 });
  }, []);

  return (
    <div className="relative mx-auto max-w-lg select-none text-center">
      {/* 3D Bilao Perspective Stage */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ perspective: 1200 }}
        className="relative flex flex-col items-center justify-center py-6 cursor-grab active:cursor-grabbing"
      >
        {/* Floating 3D Bamboo Bilao Platter Disc */}
        <div
          style={{
            transform: `perspective(1200px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) rotateZ(${tilt.rotateZ}deg) scale3d(${isHovered ? 1.04 : 1}, ${isHovered ? 1.04 : 1}, 1)`,
            transformStyle: 'preserve-3d',
            transition: isHovered
              ? 'transform 0.08s ease-out'
              : 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)'
          }}
          className="relative w-72 h-72 sm:w-96 sm:h-96 rounded-full flex items-center justify-center"
        >
          {/* Layer 1: Outermost Woven Bamboo Rim with 3D Depth */}
          <div
            style={{ transform: 'translateZ(10px)' }}
            className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#8d5b2d] via-[#b07d4f] to-[#d4a373] p-3 sm:p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25),0_10px_20px_rgba(141,91,45,0.3)] border-4 border-[#6f451f]"
          >
            {/* Woven Rim Detail Ring */}
            <div className="w-full h-full rounded-full border-2 border-dashed border-[#5c3717]/60 p-1.5 sm:p-2 bg-gradient-to-br from-[#b07d4f] to-[#7f4f27]">
              {/* Inner Banana Leaf Ring */}
              <div className="w-full h-full rounded-full border-4 border-[#2d6a4f]/70 overflow-hidden relative shadow-inner bg-[#1b4332]">
                {/* Center High-Resolution Seafood Feast */}
                <img
                  src={image}
                  alt={title}
                  className="w-full h-full object-cover scale-110"
                />

                {/* Subtle Radial Surface Glare */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none bg-gradient-to-tr from-transparent via-white/15 to-transparent"
                  style={{ transform: 'translateZ(30px)' }}
                />
              </div>
            </div>
          </div>

          {/* Layer 2: Floating 3D Badge (Top Left) */}
          <div
            style={{ transform: 'translateZ(55px)' }}
            className="absolute -top-1 left-2 sm:left-4 bg-white/95 px-3.5 py-1.5 rounded-full text-xs font-bold text-orange-700 shadow-md border border-orange-200 pointer-events-none"
          >
            {tag1}
          </div>

          {/* Layer 3: Floating 3D Bestseller Badge (Top Right) */}
          <div
            style={{ transform: 'translateZ(55px)' }}
            className="absolute -top-1 right-2 sm:right-4 bg-slate-900/90 px-3.5 py-1.5 rounded-full text-xs font-bold text-white shadow-md pointer-events-none"
          >
            {tag2}
          </div>

          {/* Layer 4: Floating Price Tag (Bottom Center) */}
          <div
            style={{ transform: 'translateZ(60px)' }}
            className="absolute -bottom-3 bg-white px-5 py-2 rounded-full shadow-lg border border-slate-200 pointer-events-none"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Starting</span>
              <span className="text-lg font-black text-slate-900">₱{price.toLocaleString()}</span>
              <span className="text-[11px] font-semibold text-orange-600">• {serves}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Platter3DCard;
