import React from 'react';

interface Top10BadgeProps {
  className?: string;
  size?: 'sm' | 'md';
  platform?: 'netflix' | 'apple' | 'disney' | 'hbo' | 'prime';
}

const AppleLogo: React.FC<{ className?: string }> = ({ className = 'w-2.5 h-2.5' }) => (
  <svg
    viewBox="0 0 170 170"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.6-7.77-11.73-14.19-5.91-9.24-10.4-19.78-13.48-31.62-3.08-11.83-4.63-23.2-4.63-34.1 0-14.07 3.52-25.99 10.55-35.77 7.04-9.78 15.82-14.75 26.35-14.92 5.03 0 10.55 1.41 16.57 4.23 6.02 2.82 10.15 4.29 12.39 4.41 1.79 0 6.08-1.52 12.87-4.56 6.79-3.04 12.36-4.44 16.71-4.2 12.44.88 22.47 5.76 30.1 14.64-10.86 6.57-16.18 15.74-15.96 27.52.22 10.16 4.15 18.73 11.8 25.7 3.65 3.34 7.82 5.86 12.51 7.56-2.58 7.55-5.83 15.11-9.77 22.68zM119.22 31.84c0-7.72 2.76-14.88 8.28-21.49 5.53-6.61 12.32-10.35 20.38-11.23.22 1.08.33 2.17.33 3.26 0 7.61-2.93 15.01-8.79 22.21-5.86 7.2-12.87 11.23-21.03 12.09-.22-1.3-.33-2.4-.33-3.3-1.07-5.07 1.16-11.54z" />
  </svg>
);

export const Top10Badge: React.FC<Top10BadgeProps> = ({
  className = '',
  size = 'md',
  platform = 'netflix',
}) => {
  const isSm = size === 'sm';

  if (platform === 'apple') {
    return (
      <div
        className={`inline-flex items-center gap-1 font-black bg-black/95 backdrop-blur-md border border-white/20 text-white shadow-xl ${
          isSm ? 'px-1.5 py-0.5 text-[9px] rounded-xs' : 'px-2 py-0.5 text-[10px] rounded-xs'
        } ${className}`}
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
      >
        <span className="flex items-center gap-0.5 font-bold tracking-tight">
          <AppleLogo className={isSm ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
          <span>tv+</span>
        </span>
        <span className="text-amber-400 font-extrabold text-[8px] tracking-tighter ml-0.5">TOP 10</span>
      </div>
    );
  }

  if (platform === 'disney') {
    return (
      <div
        className={`inline-flex items-center gap-1 font-black bg-[#030b1e]/95 backdrop-blur-md border border-blue-400/50 text-white shadow-xl ${
          isSm ? 'px-1.5 py-0.5 text-[9px] rounded-xs' : 'px-2 py-0.5 text-[10px] rounded-xs'
        } ${className}`}
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
      >
        <span className="text-[10px] leading-none font-black text-blue-200">Disney+</span>
        <span className="text-white font-extrabold text-[8px] tracking-tighter">TOP 10</span>
      </div>
    );
  }

  if (platform === 'hbo') {
    return (
      <div
        className={`inline-flex items-center gap-1 font-black bg-[#160429]/95 backdrop-blur-md border border-purple-400/50 text-white shadow-xl ${
          isSm ? 'px-1.5 py-0.5 text-[9px] rounded-xs' : 'px-2 py-0.5 text-[10px] rounded-xs'
        } ${className}`}
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
      >
        <span className="text-[10px] leading-none font-black text-purple-200 tracking-wider">HBO</span>
        <span className="text-white font-extrabold text-[8px] tracking-tighter">TOP 10</span>
      </div>
    );
  }

  if (platform === 'prime') {
    return (
      <div
        className={`inline-flex items-center gap-1 font-black bg-[#000a17]/95 backdrop-blur-md border border-[#00A8E1]/50 text-white shadow-xl ${
          isSm ? 'px-1.5 py-0.5 text-[9px] rounded-xs' : 'px-2 py-0.5 text-[10px] rounded-xs'
        } ${className}`}
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
      >
        <span className="text-[10px] leading-none font-black text-[#00A8E1]">prime</span>
        <span className="text-white font-extrabold text-[8px] tracking-tighter">TOP 10</span>
      </div>
    );
  }

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

  const isUnavailable = ribbon === 'Chưa có sẵn' || ribbon === 'Sắp chiếu';
  const ribbonBg = isUnavailable
    ? 'bg-amber-600/90 text-white border-b border-amber-700/50'
    : 'bg-[#E50914] text-white';

  return (
    <div className={`inline-flex flex-col items-center drop-shadow-md ${className}`}>
      {ribbon && (
        <span className={`${ribbonBg} text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-t-xs uppercase tracking-tight`}>
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
