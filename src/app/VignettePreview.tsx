// Страница просмотра сценок-иллюстраций (прототип 16.10): открыть игру с «?scenes» в конце адреса.
// Показывает портрет и все готовые сценки итога для каждого сборщика, чтобы оценить их, не дожидаясь нужной развилки в игре.
import { STARTING_PICKERS } from '../config/pickers';
import { PRODUCTS } from '../config/products';
import { RESULT_VIGNETTES } from '../config/vignettes';
import { SITUATION_BY_ID } from '../config/calls';
import { PickerPortrait, ResultVignette } from '../scene/vignette/Vignette';
import '../ui/theme.css';

const PRODUCT = PRODUCTS.water?.look ?? null;

function captionFor(key: string): string {
  const [sid, oid, verdict] = key.split('.');
  const s = SITUATION_BY_ID[sid];
  const o = s?.options.find((x) => x.id === oid);
  if (!o) return key;
  return `${o.label} → ${verdict === 'ok' ? o.okTitle : o.badTitle}`;
}

export default function VignettePreview() {
  return (
    <div className="vg-page">
      <h1>Сценки-иллюстрации · прототип</h1>
      <h2>Портрет в окне развилки (224 × 250)</h2>
      <div className="vg-row">
        {STARTING_PICKERS.map((p) => (
          <figure key={p.id} className="vg-portrait">
            <div className="vg-portrait-box"><PickerPortrait look={p.look} /></div>
            <figcaption>{p.name}</figcaption>
          </figure>
        ))}
      </div>
      {Object.entries(RESULT_VIGNETTES).map(([key, recipe]) => (
        <section key={key}>
          <h2>Итог: {captionFor(key)}</h2>
          <div className="vg-col">
            {STARTING_PICKERS.map((p) => (
              <figure key={p.id}>
                <div className="vg-result-box"><ResultVignette recipe={recipe} look={p.look} product={PRODUCT} /></div>
                <figcaption>{p.name}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
