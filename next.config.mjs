import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure Next picks the project directory instead of a parent yarn workspace
  outputFileTracingRoot: path.resolve(__dirname),
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      // Use the CJS build that avoids require.extensions for bundler compatibility
      handlebars: 'handlebars/dist/cjs/handlebars.js',
    };
    return config;
  },
};

export default nextConfig;
