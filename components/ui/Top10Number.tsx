import React from 'react';

interface Top10NumberProps {
  rank: number;
  className?: string;
}

export const Top10Number: React.FC<Top10NumberProps> = ({ rank, className = '' }) => {
  const isDoubleDigit = rank >= 10;

  return (
    <svg
      viewBox={isDoubleDigit ? '0 0 140 180' : '0 0 90 180'}
      className={`h-[150px] md:h-[185px] w-auto select-none pointer-events-none drop-shadow-lg ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="50%"
        y="82%"
        textAnchor="middle"
        fontSize="175"
        fontWeight="900"
        fontFamily="Impact, 'Arial Black', sans-serif"
        fill="#141414"
        stroke="#595959"
        strokeWidth="6"
        strokeLinejoin="round"
        paintOrder="stroke fill"
      >
        {rank}
      </text>
    </svg>
  );
};
