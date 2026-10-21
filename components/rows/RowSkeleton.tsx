import React from 'react';

export const RowSkeleton: React.FC<{
  title?: string;
  variant?: 'landscape' | 'portrait' | 'standard';
}> = ({ title, variant = 'landscape' }) => {
  const isPortrait = variant === 'portrait';

  return (
    <section className="my-6 sm:my-8 px-4 sm:px-8 md:px-12">
      <div className="h-6 w-48 sm:w-64 bg-zinc-800/80 rounded animate-pulse mb-4" />
      <div className="flex items-center gap-3 sm:gap-4 overflow-hidden py-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className={`relative flex-shrink-0 rounded-md bg-zinc-850 border border-white/5 overflow-hidden animate-pulse bg-gradient-to-r from-zinc-850 via-zinc-800 to-zinc-850 ${
              isPortrait
                ? 'w-[145px] sm:w-[175px] md:w-[195px] aspect-[2/3]'
                : 'w-[210px] sm:w-[240px] md:w-[260px] aspect-video'
            }`}
          >
            <div className="absolute inset-0 -translate-x-full animate-netflix-shimmer bg-gradient-to-r from-transparent via-white/[0.06] to-transparent pointer-events-none" />
          </div>
        ))}
      </div>
    </section>
  );
};

