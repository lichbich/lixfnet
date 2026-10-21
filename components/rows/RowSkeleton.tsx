import React from 'react';

export const RowSkeleton: React.FC<{
  title?: string;
  variant?: 'landscape' | 'portrait';
}> = ({ title, variant = 'landscape' }) => {
  return (
    <section className="my-6 sm:my-8 px-4 sm:px-8 md:px-12">
      {title && <div className="h-6 w-56 bg-zinc-800 rounded animate-pulse mb-4" />}
      <div className="flex items-center gap-3 sm:gap-4 overflow-hidden py-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className={`flex-shrink-0 rounded-md bg-zinc-850 border border-white/5 animate-pulse bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 ${
              variant === 'portrait'
                ? 'w-[145px] sm:w-[175px] md:w-[195px] aspect-[2/3]'
                : 'w-[210px] sm:w-[240px] md:w-[260px] aspect-video'
            }`}
          />
        ))}
      </div>
    </section>
  );
};
