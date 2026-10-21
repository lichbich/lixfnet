import React from 'react';

interface Top10BadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export const Top10Badge: React.FC<Top10BadgeProps> = ({ className = '', size = 'md' }) => {
  const isSm = size === 'sm';
  return (
    <div
      className={`inline-flex flex-col items-center justify-center font-black leading-tight bg-[#E50914] text-white shadow-lg ${
        isSm ? 'px-1 py-0.5 text-[9px] rounded-xs' : 'px-1.5 py-0.5 text-[11px] rounded-xs'
      } ${className}`}
      style={{
        boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
      }}
    >
      <span className="tracking-tighter font-extrabold text-[8px] uppercase">TOP</span>
      <span className="text-[12px] font-black -mt-0.5">10</span>
    </div>
  );
};

interface StatusBadgeProps {
  ribbon?: string;
  subBadge?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ ribbon, subBadge, className = '' }) => {
  if (!ribbon && !subBadge) return null;

  return (
    <div className={`inline-flex flex-col items-center drop-shadow-md ${className}`}>
      {ribbon && (
        <span className="bg-[#E50914] text-white text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-t-xs uppercase tracking-tight">
          {ribbon}
        </span>
      )}
      {subBadge && (
        <span className="bg-black/90 text-white text-[9px] sm:text-[10px] font-medium px-2 py-0.2 rounded-b-xs border-t border-white/10">
          {subBadge}
        </span>
      )}
    </div>
  );
};

export const RatingBadge: React.FC<{ rating: string; className?: string }> = ({
  rating,
  className = '',
}) => {
  return (
    <span
      className={`border border-white/40 text-white/90 text-xs px-1.5 py-0.2 font-medium tracking-wide uppercase ${className}`}
    >
      {rating}
    </span>
  );
};

export const QualityBadge: React.FC<{ quality: string; className?: string }> = ({
  quality,
  className = '',
}) => {
  return (
    <span
      className={`border border-white/30 text-white/80 text-[10px] px-1 py-0.2 rounded font-semibold ${className}`}
    >
      {quality}
    </span>
  );
};
