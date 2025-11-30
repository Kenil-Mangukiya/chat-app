/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove output: 'standalone' - not compatible with custom server
  // output: 'standalone',  // <-- REMOVE THIS LINE
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  trailingSlash: false,
};

export default nextConfig;