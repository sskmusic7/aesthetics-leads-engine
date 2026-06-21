/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // Enable static export for Netlify
  distDir: 'out', // Output to 'out' directory instead of '.next'
  images: {
    unoptimized: true // Required for static export
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://46.101.74.92:3001'
  },
  // Skip trailing slash redirect for static export
  skipTrailingSlashRedirect: true
}

module.exports = nextConfig
