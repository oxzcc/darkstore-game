// Точка входа: находим <div id="root"> в index.html и рисуем в нём игру.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import VignettePreview from './app/VignettePreview';

// «?scenes» в адресе — страница просмотра сценок-иллюстраций вместо игры (прототип 16.10)
const preview = new URLSearchParams(window.location.search).has('scenes');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {preview ? <VignettePreview /> : <App />}
  </StrictMode>,
);
