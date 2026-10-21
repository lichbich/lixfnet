import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * LIXFNET Wordmark Logo
 * Designed in the iconic cinema style with vibrant red gradient & crisp typography
 */
export const LixfnetLogo: React.FC<LogoProps> = ({ className = 'h-7 w-auto' }) => {
  return (
    <svg
      viewBox="0 0 132 30"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="LIXFNET"
    >
      <defs>
        <linearGradient id="lixfnet-red-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E50914" />
          <stop offset="50%" stopColor="#FF1824" />
          <stop offset="100%" stopColor="#B81D24" />
        </linearGradient>
        <filter id="lixfnet-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="rgba(229,9,20,0.5)" />
        </filter>
      </defs>
      <text
        x="66"
        y="25"
        textAnchor="middle"
        fill="url(#lixfnet-red-grad)"
        filter="url(#lixfnet-glow)"
        fontFamily="var(--font-bebas), 'Bebas Neue', 'Impact', 'Arial Black', sans-serif"
        fontSize="30"
        fontWeight="900"
        letterSpacing="2.5px"
        className="select-none tracking-widest font-black"
      >
        LIXFNET
      </text>
    </svg>
  );
};

export const NetflixLogo = LixfnetLogo;

/**
 * LIXFNET Folded Ribbon "L" Icon (Used in HeroBanner, cards, and favicon)
 */
export const LixfnetRibbonL: React.FC<{ className?: string }> = ({ className = 'w-6 h-10' }) => {
  return (
    <svg
      viewBox="0 0 20 28"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="LIXFNET Ribbon L"
    >
      <defs>
        <filter id="ribbon-shadow-l" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="-1" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.75" />
        </filter>
        <linearGradient id="ribbon-grad-l" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FF1824" />
          <stop offset="100%" stopColor="#E50914" />
        </linearGradient>
      </defs>
      {/* Back vertical ribbon base (darker red) */}
      <path d="M0 0 H5.2 V24.5 C3.5 24.8 1.8 25.1 0 25.4 Z" fill="#991217" />
      {/* Front vertical ribbon overlay */}
      <path d="M0 0 H5.2 V20.5 H0 Z" fill="#B81D24" />
      {/* Horizontal bottom ribbon with 3D fold & drop shadow */}
      <path
        d="M0 19.5 H19.5 V26 C13 27 6.5 27.2 0 26.4 Z"
        fill="url(#ribbon-grad-l)"
        filter="url(#ribbon-shadow-l)"
      />
    </svg>
  );
};

export const NetflixRibbonN = LixfnetRibbonL;
