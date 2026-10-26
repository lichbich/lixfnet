import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow cross-origin dev access from local LAN IPs and Cloudflare Tunnel domains
  allowedDevOrigins: [
    '192.168.2.2',
    '192.168.*.*',
    '192.168.*',
    '10.*.*.*',
    '172.*.*.*',
    '*.trycloudflare.com',
    '*.loca.lt',
    '*.ngrok-free.app',
    'localhost:3000',
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
