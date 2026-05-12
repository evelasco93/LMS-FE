/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Keep linting available in development/CI, but do not block production builds.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
