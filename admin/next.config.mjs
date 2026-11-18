import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpack from 'next/dist/compiled/webpack/webpack-lib.js';

const root = path.dirname(fileURLToPath(import.meta.url));

// React Native style platform resolution: `Foo.web.tsx` wins over `Foo.tsx`.
// react-native-svg relies on this to pick its web entry instead of the native one.
const WEB_EXTENSIONS = ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: root,

  // Allow Cloudflare Tunnel during development
  allowedDevOrigins: [
    'detail-need-passes-california.trycloudflare.com',
  ],

  transpilePackages: [
    'react-native-web',
    'react-native-svg',
    'lucide-react-native',
  ],

  experimental: {
    // Icons are imported from the package barrel, which re-exports 2000+ icon modules.
    // Rewriting those imports to the individual icon files keeps the whole barrel out of
    // every route's module graph, which is what made each route slow to compile.
    optimizePackageImports: ['lucide-react-native'],
  },

  // Turbopack is the default bundler for `next dev` and `next build`.
  // `expo-router` is aliased to the shim through tsconfig `paths`, which Turbopack honours.
  turbopack: {
    resolveAlias: {
      'react-native': 'react-native-web',
    },
    resolveExtensions: WEB_EXTENSIONS,
  },

  // Fallback for `npm run dev:webpack` / `npm run build:webpack`.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native$': 'react-native-web',
      'expo-router$': path.join(root, 'src/shims/expo-router.ts'),
    };

    config.resolve.extensions = [
      '.web.tsx',
      '.web.ts',
      '.web.js',
      ...config.resolve.extensions,
    ];

    config.plugins.push(
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
      })
    );

    return config;
  },
};

export default nextConfig;
