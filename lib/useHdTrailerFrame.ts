'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

/**
 * YouTube no longer honours `vq=hd1080` or `setPlaybackQuality()` (both are no-ops since 2019).
 * The embedded player now picks its stream resolution from the iframe's *layout* size
 * (CSS pixels × devicePixelRatio). A 380px-wide hover card therefore gets 360p/480p and a
 * 900px modal gets ~720p, no matter what we ask for.
 *
 * Trick: render the iframe at a large fixed layout size (e.g. 2560×1440) so YouTube believes it
 * is playing on a big screen and streams 1080p/1440p, then shrink it visually with a CSS
 * `transform: scale()` to cover the real container. Transforms do not change the iframe's
 * internal viewport, so YouTube keeps serving the high-resolution stream.
 */
export interface HdTrailerFrameOptions {
  /** Virtual layout width of the iframe (CSS px). Default 2560 (1440p). */
  baseWidth?: number;
  /** Virtual layout height of the iframe (CSS px). Default 1440. */
  baseHeight?: number;
  /** Extra zoom beyond "cover" to crop YouTube chrome / letterbox bars. Default 1.2. */
  overscan?: number;
}

export function useHdTrailerFrame({
  baseWidth = 2560,
  baseHeight = 1440,
  overscan = 1.2,
}: HdTrailerFrameOptions = {}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState(0);

  // Callback ref: the trailer container mounts conditionally, so a plain ref + effect would miss it
  const containerRef = useCallback((node: HTMLElement | null) => setContainer(node), []);

  useEffect(() => {
    if (!container) return;

    const update = () => {
      // clientWidth/Height = untransformed layout size (unaffected by modal/card scale animations)
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      const cover = Math.max(w / baseWidth, h / baseHeight);
      setScale(cover * overscan);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => ro.disconnect();
  }, [container, baseWidth, baseHeight, overscan]);

  const iframeStyle: CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: `${baseWidth}px`,
    height: `${baseHeight}px`,
    maxWidth: 'none',
    transform: `translate(-50%, -50%) scale(${scale})`,
    transformOrigin: 'center center',
    border: 0,
    // Hide until measured so we never flash a giant unscaled frame
    visibility: scale > 0 ? 'visible' : 'hidden',
  };

  return { containerRef, iframeStyle };
}
