import { defineConfig } from 'vite';
import fs from 'node:fs';
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

const pageName = (url) => (url === '/' ? 'index' : url.replace(/^\//, '').replace(/\.html$/, ''));
// Страница — адрес без расширения или с .html; служебные пути Vite и исходники страницами не считаются
const isPageUrl = (url) =>
  (!path.extname(url) || url.endsWith('.html')) &&
  !url.startsWith('/@') &&
  !url.startsWith('/src/') &&
  !url.startsWith('/node_modules/');

// Адрес без строки запроса
const pathOf = (request) => (request.url ?? '/').split('?', 1)[0];

// В разработке страницу собирает vituum, поэтому адрес только подменяется на /404.html (код ответа остаётся 200)
const rewriteToNotFound = (request) => {
  request.url = '/404.html';
};

// Есть ли страница по этому адресу: root — папка, где лежат страницы, suffix — их расширение
const hasPage = (root, url, suffix) => {
  const file = path.resolve(root, `${pageName(url)}${suffix}`);

  return fs.existsSync(file);
};

/**
 * Страница 404 для разработки и предпросмотра: адрес, которого нет, открывает 404.html с кодом ответа 404.
 * На боевом сервере то же делает его настройка (error_page), этот плагин нужен только vite dev и vite preview.
 */
const notFoundPage = () => ({
  name: 'not-found-page',
  // В разработке страницы собирает vituum из src/pages/*.njk
  configureServer: (server) => {
    server.middlewares.use((request, _response, next) => {
      const url = pathOf(request);

      if (isPageUrl(url) && !hasPage('src/pages', url, '.njk')) {
        rewriteToNotFound(request);
      }

      next();
    });
  },
  // В предпросмотре — из готовой сборки dist
  configurePreviewServer: (server) => {
    server.middlewares.use((request, response, next) => {
      const url = pathOf(request);

      if (isPageUrl(url) && !hasPage('dist', url, '.html')) {
        // Готовую страницу отдаём сами: статический сервер предпросмотра сбросил бы код 404 на 200
        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(fs.readFileSync(path.resolve('dist', '404.html')));

        return;
      }

      next();
    });
  },
});

export default defineConfig({
  // base: '/repo/',
  plugins: [
    notFoundPage(),
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
