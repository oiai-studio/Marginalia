import { defineConfig } from 'astro/config';

// Deployment target: GitHub Pages. Update `site` once the repo's GitHub
// Pages URL is confirmed (org/user name is a placeholder until then).
export default defineConfig({
  site: 'https://oiai-studio.github.io',
  base: '/Marginalia',
  output: 'static',
  trailingSlash: 'always',
});
