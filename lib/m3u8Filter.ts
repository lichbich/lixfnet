/**
 * NetLix Intelligent M3U8 Ad-Stripper Engine
 * Strips hard-stitched mid-roll & pre-roll gambling / betting ads
 * (e.g. 9922.com, Jun88, OKVIP, /v8/ segments) from HLS stream manifests.
 */

const AD_SIGNATURES = [
  '/v8/',
  '/v7/',
  '/v9/',
  '/v6/',
  'convertv8',
  'segment_',
  'd61a03b1dabe537cc05ffe5c9c280f56',
  '9922',
  'f8bet',
  'jun88',
  'hi88',
  'shbet',
  'new88',
  '789bet',
  'okvip',
];

/**
 * Checks if a given text chunk or line matches known ad patterns
 */
export function isAdPattern(text: string): boolean {
  const lower = text.toLowerCase();
  return AD_SIGNATURES.some((sig) => lower.includes(sig));
}

/**
 * Cleans an HLS playlist (m3u8) string, removing all stitched advertising segments
 * and seamlessly joining the genuine film segments.
 */
export function cleanM3u8Manifest(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return rawText;

  // Master playlist check (EXT-X-STREAM-INF) -> doesn't contain TS segments, return as-is
  if (rawText.includes('#EXT-X-STREAM-INF') && !rawText.includes('#EXTINF')) {
    return rawText;
  }

  const lines = rawText.split(/\r?\n/);
  const result: string[] = [];
  let inDiscontinuityBlock = false;
  let blockBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '#EXT-X-DISCONTINUITY') {
      if (!inDiscontinuityBlock) {
        // Start buffering candidate block
        inDiscontinuityBlock = true;
        blockBuffer = [line];
      } else {
        // Closing discontinuity tag of the block
        blockBuffer.push(line);
        const blockContent = blockBuffer.join('\n');

        if (isAdPattern(blockContent)) {
          // Replace entire ad block with a single discontinuity tag for smooth audio/video PTS sync
          result.push('#EXT-X-DISCONTINUITY');
        } else {
          // Genuine movie discontinuity block (keep it)
          result.push(...blockBuffer);
        }

        inDiscontinuityBlock = false;
        blockBuffer = [];
      }
      continue;
    }

    if (inDiscontinuityBlock) {
      blockBuffer.push(line);
    } else {
      // Standalone check for stray ad segments
      if (isAdPattern(trimmed)) {
        // Skip this ad segment URL and its preceding #EXTINF if present
        if (result.length > 0 && result[result.length - 1].trim().startsWith('#EXTINF:')) {
          result.pop();
        }
        continue;
      }
      result.push(line);
    }
  }

  // Flush remaining buffer if manifest ended inside a block
  if (blockBuffer.length > 0) {
    const blockContent = blockBuffer.join('\n');
    if (!isAdPattern(blockContent)) {
      result.push(...blockBuffer);
    }
  }

  // Deduplicate consecutive #EXT-X-DISCONTINUITY tags
  const sanitizedLines: string[] = [];
  for (const l of result) {
    if (
      l.trim() === '#EXT-X-DISCONTINUITY' &&
      sanitizedLines[sanitizedLines.length - 1]?.trim() === '#EXT-X-DISCONTINUITY'
    ) {
      continue;
    }
    sanitizedLines.push(l);
  }

  return sanitizedLines.join('\n');
}
