import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const isWatch = process.argv.includes('--watch');

// Build sandbox code
const codeBuild = esbuild.build({
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  format: 'iife',
  target: 'es2020',
  ...(isWatch ? { plugins: [watchPlugin('code.js')] } : {}),
});

// Build UI code
const uiBuild = esbuild.build({
  entryPoints: ['src/ui/ui.ts'],
  bundle: true,
  outfile: 'dist/ui-bundle.js',
  format: 'iife',
  target: 'es2020',
  ...(isWatch ? { plugins: [watchPlugin('ui-bundle.js')] } : {}),
});

function watchPlugin(name) {
  return {
    name: `watch-${name}`,
    setup(build) {
      build.onEnd(() => {
        buildHtml();
        console.log(`[${name}] rebuilt`);
      });
    },
  };
}

function buildHtml() {
  const htmlTemplate = fs.readFileSync('src/ui/index.html', 'utf8');
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');
  let js = '';
  try {
    js = fs.readFileSync('dist/ui-bundle.js', 'utf8');
  } catch {}

  const output = htmlTemplate
    .replace('<!-- STYLES -->', `<style>${css}</style>`)
    .replace('<!-- SCRIPT -->', `<script>${js}</script>`);

  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/ui.html', output);
}

await Promise.all([codeBuild, uiBuild]);
buildHtml();
console.log('Build complete');

if (isWatch) {
  console.log('Watching for changes...');
  // esbuild watch keeps process alive
}
