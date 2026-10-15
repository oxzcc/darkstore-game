import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Настройки сборки.
// base — адрес, по которому игра лежит на сайте. На GitHub Pages игра открывается
// по ссылке oxzcc.github.io/darkstore-game/, поэтому при публикации (переменная
// GITHUB_PAGES=true, её ставит .github/workflows/deploy.yml) base = '/darkstore-game/'.
// В Codespaces и при обычном запуске игра открывается с корня сайта, base = '/'.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/darkstore-game/' : '/',
});
