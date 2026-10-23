import http from 'http';
import { URL } from 'url';

const PORT = process.env.PORT || 8989;

/**
 * Ultra-lightweight Streaming Proxy for NetLix
 * Enables users abroad to stream HLS video through a residential Vietnam IP.
 * - RAM usage: ~30MB
 * - CPU usage: < 1%
 * - Zero disk writes (direct memory stream pipe)
 */
const server = http.createServer(async (req, res) => {
  // Global CORS headers allowing cross-origin streaming in web player
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url || '/', `http://localhost:${PORT}`);

  // Health check endpoint
  if (reqUrl.pathname === '/health' || reqUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'NetLix Streaming Proxy', port: PORT }));
    return;
  }

  const targetUrl = reqUrl.searchParams.get('url');
  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Missing "url" query parameter. Example: /m3u8?url=https://s1.phimapi.com/.../index.m3u8');
    return;
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Referer: 'https://phimapi.com/',
        Origin: 'https://phimapi.com',
      },
    });

    if (!upstreamRes.ok) {
      res.writeHead(upstreamRes.status, { 'Content-Type': 'text/plain' });
      res.end(`Upstream error: ${upstreamRes.status} ${upstreamRes.statusText}`);
      return;
    }

    const contentType = upstreamRes.headers.get('content-type') || '';
    const isM3u8 =
      reqUrl.pathname.includes('m3u8') ||
      targetUrl.includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('x-mpegURL');

    // Determine current proxy origin for rewriting URLs
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
    const proxyBase = `${proto}://${host}`;

    if (isM3u8) {
      // 1. Rewrite M3U8 Master / Media Playlist
      const rawText = await upstreamRes.text();
      const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

      const rewritten = rawText
        .split('\n')
        .map((line) => {
          const trimmed = line.trim();
          // Keep comment / metadata tags untouched
          if (!trimmed || trimmed.startsWith('#')) return line;

          // Resolve full URL for relative paths
          let absoluteUrl = trimmed;
          if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            absoluteUrl = new URL(trimmed, baseUrl).toString();
          }

          // If child playlist, route through /m3u8; if segment, route through /ts
          const routeType = absoluteUrl.includes('.m3u8') ? 'm3u8' : 'ts';
          return `${proxyBase}/${routeType}?url=${encodeURIComponent(absoluteUrl)}`;
        })
        .join('\n');

      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      res.end(rewritten);
    } else {
      // 2. Stream TS Segments (Direct Binary Pipe)
      res.writeHead(200, {
        'Content-Type': contentType || 'video/MP2T',
        'Cache-Control': 'public, max-age=86400',
      });

      if (upstreamRes.body) {
        const reader = upstreamRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        res.end();
      }
    }
  } catch (error) {
    console.error(`[Proxy Error] ${targetUrl}:`, error.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`Proxy Gateway Error: ${error.message}`);
    } else {
      res.end();
    }
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[NetLix Proxy] Cổng ${PORT} đã đang được chạy từ trước (Sẵn sàng sử dụng).`);
    process.exit(0);
  } else {
    console.error('[NetLix Proxy] Lỗi khởi động:', err);
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 NetLix Streaming Proxy đang chạy trên cổng ${PORT}`);
  console.log(`👉 Kiểm tra: http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});
