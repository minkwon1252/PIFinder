/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output makes the Docker production image small and self-contained.
  output: "standalone",
  experimental: {
    // Server Actions are used for sensitive logic (membership gate, admin writes).
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
