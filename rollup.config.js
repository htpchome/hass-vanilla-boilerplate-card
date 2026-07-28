/**
 * rollup.config.js
 * ---------------------------------------------------------------
 * Bundles /src into a single HACS-compatible file at the repo
 * root: `hass-vanilla-boilerplate-card.js`.
 *
 * Notes:
 *   - Output format is `iife` so the bundle is a self-executing
 *     script that can be loaded directly with a <script> tag.
 *   - We disable code-splitting and use a single chunk because
 *     HACS only serves one file per card.
 *   - For development, `npm run build:watch` rebuilds on save.
 * ---------------------------------------------------------------
 */

import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const isProd = process.env.NODE_ENV === 'production';

export default {
  input: 'src/card.js',
  output: {
    file: 'hass-vanilla-boilerplate-card.js',
    format: 'iife',
    name: 'HassVanillaBoilerplateCard',
    sourcemap: !isProd,
    inlineDynamicImports: true,
  },
  plugins: [
    nodeResolve(),
    isProd
      ? terser({
          ecma: 2020,
          module: false,
          compress: { passes: 2 },
          format: { comments: false },
        })
      : null,
  ].filter(Boolean),
};
