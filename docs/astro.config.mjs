import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://samclark2015.github.io',
  base: '/tasky/',
  integrations: [tailwind()],
});
