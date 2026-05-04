/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['10.42.0.80', '127.0.0.1', 'localhost'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
