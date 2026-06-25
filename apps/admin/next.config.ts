import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@workstation/types'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uxegtdclsndoaobmrdcd.supabase.co',
      },
    ],
  },
}

export default nextConfig
