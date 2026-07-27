/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root explicitly: an unrelated package-lock.json in the
  // parent home directory otherwise makes Next.js guess the wrong root.
  turbopack: {
    root: import.meta.dirname,
  },
  images: {
    // Destination photos come back from the Pexels API at request time, so
    // they have to be allow-listed by host before next/image will touch them.
    // Going through the optimiser rather than hotlinking the raw JPEG is what
    // gets them served as AVIF at the size actually on screen.
    remotePatterns: [
      { protocol: "https", hostname: "images.pexels.com", pathname: "/photos/**" },
    ],
  },
};

export default nextConfig;
