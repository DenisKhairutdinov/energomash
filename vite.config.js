import { defineConfig } from 'vite';
import path from 'node:path';
import vituum from 'vituum';
import nunjucks from '@vituum/vite-plugin-nunjucks';
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons';
import browserslist from 'browserslist';
import { browserslistToTargets } from 'lightningcss';

const myTargets = [
  'chrome >= 109',
  'edge >= 109',
  'firefox >= 115',
  'opera >= 95',
  'safari >= 15.6',
  'ios_saf >= 15.6',
];

export default defineConfig({
  // base: '/repo/',
  plugins: [
    vituum({
      pages: {
        normalize: true,
      },
    }),
    nunjucks({ root: './src/templates' }),
    createSvgIconsPlugin({
      iconDirs: [path.resolve(process.cwd(), 'src/assets/icons')],
      symbolId: 'icon-[dir]-[name]',
      recursive: true,
      inject: 'body-last',
    }),
    // legacy({
    //   targets: myTargets,
    //   modernPolyfills: false,
    // }),
  ],
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: browserslistToTargets(browserslist(myTargets)),
    },
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        additionalData: `@use '/src/styles/base/functions.scss' as *;
                         @use '/src/styles/base/mixins.scss' as *;
                         @use '/src/styles/base/vars.scss' as *;`,
      },
    },
  },
  build: {
    cssMinify: 'lightningcss',
  },
});
