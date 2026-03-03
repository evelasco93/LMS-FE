/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "https://zf7o4xenif.execute-api.us-east-1.amazonaws.com/dev/v2";

    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
