import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: false, // NO source maps — prevent code leak
  splitting: false,
  noExternal: [
    '@introspect/core-types',
    '@introspect/scanner',
    '@introspect/ai',
  ],
  external: [
    'chalk', 'commander', 'ora',
    'simple-git', 'fast-glob', 'js-yaml', 'uuid',
  ],
  platform: 'node',
  banner: {
    js: "import { createRequire } from 'module'; import { fileURLToPath } from 'url'; import { dirname } from 'path'; const require = createRequire(import.meta.url); const __filename = fileURLToPath(import.meta.url); const __dirname = dirname(__filename);",
  },
});
