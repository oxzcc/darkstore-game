import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Настройки сборки.
// base — адрес, по которому игра лежит на сайте. На GitHub Pages игра открывается
// по ссылке oxzcc.github.io/darkstore-game/, поэтому при публикации (сборка в режиме
// pages: `npm run build -- --mode pages`, так делает .github/workflows/deploy.yml)
// base = '/darkstore-game/'. В Codespaces и при обычной сборке игра открывается с корня, base = '/'.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'pages' ? '/darkstore-game/' : '/',
}));
