import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Настройки сборки. Пока только подключаем React.
export default defineConfig({
  plugins: [react()],
});
