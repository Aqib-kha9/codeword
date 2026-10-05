/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Capacitor ke Android WebView me chalawe khatir app ke static HTML/CSS/JS
  // banawal jai — matlab "out" folder me pura app nikal jai.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

module.exports = nextConfig;
