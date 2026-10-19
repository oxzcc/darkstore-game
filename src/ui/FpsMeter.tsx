// Счётчик кадров (F0, план адаптива 19.10): включается адресом с «?fps», игре не мешает.
// Показывает кадры в секунду сейчас и худшую секунду за последние 10 с, размер картинки склада в пикселях
// и сколько 3D-холстов открыто сразу (склад + сценки в окнах) — для замера на телефоне.
// Считает по requestAnimationFrame браузера: сцена рисуется в том же ритме.
import { useEffect, useState } from 'react';

const WINDOW_SECONDS = 10;

type Reading = { fps: number; min: number; size: string; canvases: number };

export const fpsMeterOn = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('fps');

export default function FpsMeter() {
  const [r, setR] = useState<Reading>({ fps: 0, min: 0, size: '—', canvases: 0 });
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const history: number[] = [];
    const loop = (now: number) => {
      frames++;
      if (now - last >= 1000) {
        const fps = Math.round((frames * 1000) / (now - last));
        history.push(fps);
        if (history.length > WINDOW_SECONDS) history.shift();
        const canvases = [...document.querySelectorAll('canvas')];
        const main = canvases[0];
        setR({
          fps,
          min: Math.min(...history),
          size: main ? `${main.width}×${main.height} · ×${window.devicePixelRatio.toFixed(1)}` : '—',
          canvases: canvases.length,
        });
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const tone = r.fps >= 50 ? 'ok' : r.fps >= 30 ? 'mid' : 'bad';
  return (
    <div className={`fps-meter ${tone}`} aria-hidden>
      <b>{r.fps}</b> к/с · мин {r.min}
      <span>{r.size} · холстов {r.canvases}</span>
    </div>
  );
}
