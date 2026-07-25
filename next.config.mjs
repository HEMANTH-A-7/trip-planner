/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root explicitly: an unrelated package-lock.json in the
  // parent home directory otherwise makes Next.js guess the wrong root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
