/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@introspect/ui', '@introspect/scanner', '@introspect/ai', '@introspect/core-types'],
  sassOptions: {
    includePaths: ['./styles'],
  },
  experimental: {
    serverComponentsExternalPackages: ['simple-git'],
  },
};

module.exports = nextConfig;
