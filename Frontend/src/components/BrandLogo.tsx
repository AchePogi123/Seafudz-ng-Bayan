import React from 'react';
import { Link } from 'react-router-dom';

interface BrandLogoProps {
  variant?: 'light' | 'dark'; // 'light' for light backgrounds, 'dark' for dark backgrounds
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  clickable?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'light',
  size = 'md',
  showSubtitle = true,
  clickable = true,
  onClick,
  className = ''
}) => {
  const isDarkBg = variant === 'dark';

  const titleSizes = {
    sm: 'text-lg',
    md: 'text-xl sm:text-[22px]',
    lg: 'text-2xl sm:text-3xl',
    xl: 'text-3xl sm:text-4xl'
  };

  const badgeSizes = {
    sm: 'text-[9px]',
    md: 'text-[10px] sm:text-[11px]',
    lg: 'text-xs sm:text-[13px]',
    xl: 'text-sm sm:text-base'
  };

  const subtitleSizes = {
    sm: 'text-[7.5px] tracking-[0.18em]',
    md: 'text-[8.5px] sm:text-[9px] tracking-[0.2em]',
    lg: 'text-[9.5px] sm:text-[10px] tracking-[0.22em]',
    xl: 'text-xs tracking-[0.25em]'
  };

  const content = (
    <div className={`group inline-flex flex-col select-none text-left transition-all duration-200 ${className}`}>
      {/* Main Text Logo Row */}
      <div className="flex items-baseline gap-1.5 leading-none">
        {/* Typographic Wordmark */}
        <span
          className={`font-black tracking-tight transition-colors duration-200 ${titleSizes[size]} ${
            isDarkBg ? 'text-white' : 'text-slate-900'
          }`}
        >
          Sea<span className="text-orange-600 group-hover:text-orange-500 transition-colors">fudz</span>
        </span>

        {/* Minimalist Aesthetic "ng Bayan" Accent with Matching Curved Swoosh */}
        <span
          className={`relative inline-block font-extrabold uppercase tracking-wider text-orange-600 transition-colors ${badgeSizes[size]}`}
        >
          <span className="text-orange-400 font-normal lowercase italic text-[0.9em] mr-0.5">ng</span> Bayan
          <svg
            className="absolute -bottom-1 left-0 w-full h-1.5 text-orange-400 opacity-90 group-hover:opacity-100 transition-opacity pointer-events-none"
            viewBox="0 0 70 8"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 5.5C20 2.5 45 2.5 68 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </div>

      {/* Clean Tagline */}
      {showSubtitle && (
        <span
          className={`uppercase font-semibold block mt-1 ${subtitleSizes[size]} ${
            isDarkBg ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-400 group-hover:text-slate-600'
          } transition-colors`}
        >
          Fresh Seafood &amp; Bilao Feasts
        </span>
      )}
    </div>
  );

  if (clickable) {
    return (
      <Link to="/" onClick={onClick} className="inline-block outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-md py-0.5 cursor-pointer">
        {content}
      </Link>
    );
  }

  return content;
};

export default BrandLogo;
