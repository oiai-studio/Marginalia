import { defineConfig } from 'astro/config';

// Deployment target: GitHub Pages, served from /Marginalia/. That base
// path only applies to the build/preview npm scripts — `npm run dev`
// serves from the root so http://localhost:4321/ works without the
// subpath. Astro's defineConfig takes a plain object only (unlike Vite,
// it has no command-callback form), so this branches on
// npm_lifecycle_event instead, which npm sets to the script name.
const isLocalDev = process.env.npm_lifecycle_event === 'dev';

export default defineConfig({
  site: 'https://oiai-studio.github.io',
  base: isLocalDev ? '/' : '/Marginalia',
  output: 'static',
  trailingSlash: 'always',
});
