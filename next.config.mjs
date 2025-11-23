/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure proper output for Vercel
  output: 'standalone',
  // Disable custom server for Vercel deployment
  // Vercel will use serverless functions instead
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Ensure static files are properly served
  trailingSlash: false,
};

export default nextConfig;
