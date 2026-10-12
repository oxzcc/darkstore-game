// Экран ТСД «Сборки» (06, раздел 5; структура — по скриншоту автора 12.10: приложение сборщика).
// Сверху «Соберите заказ» и время; вкладки «Заказ» (что ещё собрать, по адресам) и «Собрано» (что уже в тележке).
// Только показывает данные из props: store не трогает (09, раздел 6.3). Кнопки «−1», «Не найдено», «На фасовку» — M5e2.
import { useState, type CSSProperties } from 'react';
import type { ProductLook } from '../../model/product';
import type { PickingView } from '../../store/selectors';
import { clockText, plural } from '../../store/selectors';

type Line = PickingView['lines'][number];
type Tab = 'order' | 'picked';

/** Цвет товара квадратиком, пока нет воксельных иконок (08, раздел 9). */
function Swatch({ look }: { look: ProductLook | null }) {
  const style = look ? ({ '--sw': look.color, '--sw2': look.accent } as CSSProperties) : undefined;
  return <span className="swatch" style={style} />;
}

function LineRow({ line, picked }: { line: Line; picked?: boolean }) {
  const over = line.taken > line.qty;
  const full = line.taken >= line.qty;
  const cls = picked ? (over ? ' over' : full ? ' full' : ' part') : line.taken > 0 ? ' part' : '';
  return (
    <div className="tsd-line">
      <Swatch look={line.look} />
      <div className="tsd-line-text">
        <div className="tsd-line-name">{line.name}</div>
        <span className={`tsd-qty${cls}`}>{line.taken} / {line.qty} шт</span>
      </div>
    </div>
  );
}

/** Строка ответа ТСД на последний скан. */
function ScanMessage({ scan }: { scan: PickingView['lastScan'] }) {
  if (!scan) return <div className="tsd-msg idle">Нажмите на товар на полке — ТСД его отсканирует</div>;
  if (scan.result === 'notInOrder') return <div key={scan.at} className="tsd-msg bad">{scan.name} — нет в заказе</div>;
  if (scan.result === 'shelfEmpty') return <div key={scan.at} className="tsd-msg mute">{scan.name}: на полке {scan.address} больше нет</div>;
  const l = scan.line;
  const extra = l && l.taken > l.qty;
  return (
    <div key={scan.at} className={`tsd-msg ${extra ? 'warn' : 'ok'}`}>
      +1 {scan.name}{l ? ` · ${l.taken} из ${l.qty}` : ''}{extra ? ' — лишняя' : ''}
    </div>
  );
}

export default function PickingTsd({ view }: { view: PickingView }) {
  const [tab, setTab] = useState<Tab>('order');
  const left = view.lines.filter((l) => l.taken < l.qty);
  const picked = view.lines.filter((l) => l.taken > 0);
  const units = view.lines.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="tsd">
      <div className="tsd-head">
        <div className="tsd-head-title">Соберите заказ</div>
        <div className="tsd-head-time">{clockText(view.elapsed)}</div>
      </div>

      <div className="tsd-tabs">
        <button className={tab === 'order' ? 'on' : ''} onClick={() => setTab('order')}>
          Заказ {left.length > 0 && <span className="tsd-badge">{left.length}</span>}
        </button>
        <button className={tab === 'picked' ? 'on' : ''} onClick={() => setTab('picked')}>
          Собрано
        </button>
      </div>

      <div className="tsd-scroll">
        {tab === 'order' && (
          <>
            <div className="tsd-info">
              <div className="tsd-info-row">
                <span className="tsd-order-no">Заказ №{view.number}</span>
                <span className="tsd-units">{units} {plural(units, 'штука', 'штуки', 'штук')}</span>
              </div>
              <div className="tsd-chips">
                <span className="tsd-chip picker" style={{ '--pc': view.picker.color } as CSSProperties}>{view.picker.name}</span>
                <span className="tsd-chip">{view.summary}</span>
              </div>
            </div>
            {left.map((l, i) => (
              <div key={l.index} className="tsd-group">
                {(i === 0 || left[i - 1].address !== l.address) && <div className="tsd-addr">{l.address}</div>}
                <LineRow line={l} />
              </div>
            ))}
          </>
        )}
        {tab === 'picked' && (
          picked.length === 0
            ? <div className="tsd-empty">Пока пусто. Отсканированный товар попадёт сюда.</div>
            : picked.map((l) => (
              <div key={l.index} className="tsd-group">
                <div className="tsd-addr">{l.address}</div>
                <LineRow line={l} picked />
              </div>
            ))
        )}
      </div>

      <ScanMessage scan={view.lastScan} />
    </div>
  );
}
