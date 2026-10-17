// Страница просмотра сценок-иллюстраций: открыть игру с «?scenes» в конце адреса.
// Конструктор позы (порода, поза, эмоция, что в лапах, товар), витрина реквизита (V2a) и готовые сцены итога.
// 3D-окон на странице немного (браузер держит около 16 одновременно), поэтому сцены выбираются кнопками.
import { useState, type ReactNode } from 'react';
import { STARTING_PICKERS } from '../config/pickers';
import { PRODUCTS } from '../config/products';
import {
  RESULT_VIGNETTES, VIGNETTE,
  type VignetteCamera, type VignetteHold, type VignetteMood, type VignettePose, type VignetteRecipe,
} from '../config/vignettes';
import { SITUATION_BY_ID } from '../config/calls';
import { PickerPortrait, ResultVignette } from '../scene/vignette/Vignette';
import '../ui/theme.css';

const POSES: [VignettePose, string][] = [
  ['idle', 'стоит'], ['walk', 'идёт'], ['call', 'зовёт'], ['oops', 'ой'], ['carry', 'несёт'], ['cheer', 'радуется'],
  ['reach', 'тянется вверх'], ['kneel', 'у нижней полки'], ['push', 'толкает тележку'], ['impatient', 'ждёт, притопывая'],
  ['squeeze', 'протискивается'], ['think', 'думает'], ['tired', 'устал'], ['point', 'показывает'], ['compare', 'сравнивает'],
];
const MOODS: [VignetteMood, string][] = [
  ['call', 'зовёт'], ['happy', 'доволен'], ['oops', 'ой'], ['think', 'задумался'], ['tired', 'устал'], ['angry', 'сердится'],
];
const HOLDS: [VignetteHold, string][] = [
  [null, 'ничего'], ['tsd', 'ТСД'], ['product', 'товар'], ['twoProducts', 'два товара'], ['productBox', 'коробка с товаром'],
  ['box', 'коробка'], ['clipboard', 'накладная'],
];

const FULL_BODY: VignetteCamera = { target: [0, 0.95, 0], azimuthDeg: 20, elevationDeg: 12, distance: 4.6, fovDeg: 30 };
const WIDE: VignetteCamera = { target: [0.1, 1.0, -0.2], azimuthDeg: 14, elevationDeg: 16, distance: 7, fovDeg: 30 };
const BG = VIGNETTE.wallColor;

/** Витрина реквизита V2a: по сцене на каждую группу предметов. */
const KIT: [string, VignetteRecipe][] = [
  ['Полки: чужой товар, пусто, в глубине, вперемешку', {
    dog: { at: [1.0, 0, 0.55], turn: -0.2, pose: 'reach', mood: 'think', hold: null },
    props: [
      { kind: 'rack', at: [-1.0, 0, -0.75], top: 'empty', mid: 'other' },
      { kind: 'rack', at: [1.0, 0, -0.75], top: 'messy', mid: 'deep' },
    ],
    camera: WIDE, background: BG,
  }],
  ['Тележка и паллета', {
    dog: { at: [-1.31, 0, -0.44], turn: 0.4, pose: 'push', mood: 'happy', hold: null },
    props: [
      { kind: 'cart', at: [-1.0, 0, 0.3], turn: 0.4, full: true },
      { kind: 'pallet', at: [1.2, 0, -0.3], boxes: 7 },
    ],
    camera: WIDE, background: BG,
  }],
  ['Стол фасовки и пакет', {
    dog: { at: [0.5, 0, 0.45], turn: -0.2, pose: 'carry', mood: 'happy', hold: 'productBox' },
    props: [
      { kind: 'table', at: [-0.3, 0, -0.6] },
      { kind: 'bag', at: [-0.7, 0.85, -0.6], turn: 0.3 },
    ],
    camera: FULL_BODY, background: BG,
  }],
  ['Грузовик и водитель', {
    dog: { at: [-0.5, 0, 0.4], turn: 0.5, pose: 'think', mood: 'think', hold: 'clipboard' },
    props: [
      { kind: 'truck', at: [2.6, 0, -5.6] },
      { kind: 'pallet', at: [-1.7, 0, -0.8], boxes: 9 },
      { kind: 'npc', role: 'driver', at: [0.9, 0, 0.2], turn: -0.5, pose: 'impatient', mood: 'angry', hold: null },
    ],
    camera: WIDE, background: BG,
  }],
  ['Зона брака, заваленная коробками', {
    dog: { at: [1.3, 0, 0.6], turn: -0.5, pose: 'carry', mood: 'oops', hold: 'box' },
    props: [{ kind: 'scrapZone', at: [-0.3, 0, -0.6], full: true }],
    camera: WIDE, background: BG,
  }],
  ['Дверь клиента и телефон: доволен / недоволен', {
    dog: { at: [0, 0, 0], turn: 0.3, pose: 'point', mood: 'happy', hold: null },
    props: [
      { kind: 'door', at: [-1.6, 0, -0.9] },
      { kind: 'bag', at: [-1.4, 0, -0.2] },
      { kind: 'phone', at: [1.2, 1.3, 0.2], reaction: 'good' },
      { kind: 'phone', at: [2.0, 1.3, 0.2], reaction: 'bad' },
    ],
    camera: WIDE, background: BG,
  }],
  ['Значки', {
    dog: { at: [0, 0, 0.3], turn: 0, pose: 'think', mood: 'think', hold: null },
    props: (['clock', 'question', 'exclaim', 'check', 'cross', 'star'] as const).map((symbol, i) => (
      { kind: 'icon' as const, at: [-1.75 + i * 0.7, 2.45, 0] as [number, number, number], symbol }
    )),
    camera: { target: [0, 1.4, 0], azimuthDeg: 0, elevationDeg: 6, distance: 6.5, fovDeg: 30 },
    background: BG,
  }],
  ['Стремянка, другой сборщик, мятая коробка', {
    dog: { at: [0.9, 0, 0.45], turn: -0.3, pose: 'kneel', mood: 'oops', hold: null },
    props: [
      { kind: 'rack', at: [-0.2, 0, -0.75], top: 'gap' },
      { kind: 'ladder', at: [-0.6, 0, 0.05], turn: 0.15 },
      { kind: 'npc', role: 'picker', at: [-1.6, 0, 0.5], turn: 0.5, pose: 'tired', mood: 'tired', hold: null },
      { kind: 'box', at: [0.2, 0, 0.9], dented: true },
      { kind: 'box', at: [1.7, 0.2, 0.7], rot: [0, 0.4, 1.2], open: true },
      { kind: 'product', at: [1.3, 0.1, 1.15], rot: [Math.PI / 2, 0, 0.6] },
    ],
    camera: WIDE, background: BG,
  }],
];

function Buttons<T>({ items, value, onPick }: { items: [T, string][]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="vg-buttons">
      {items.map(([v, label]) => (
        <button key={String(v)} className={`vg-btn${v === value ? ' on' : ''}`} onClick={() => onPick(v)}>{label}</button>
      ))}
    </div>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return <div className="vg-field"><span>{title}</span>{children}</div>;
}

function captionFor(key: string): string {
  const [sid, oid, verdict] = key.split('.');
  const s = SITUATION_BY_ID[sid];
  const o = s?.options.find((x) => x.id === oid);
  if (!o) return key;
  return `${o.label} → ${verdict === 'ok' ? o.okTitle : o.badTitle}`;
}

const PRODUCT_ITEMS: [string, string][] = Object.values(PRODUCTS).map((p) => [p.id, p.name]);
const PICKER_ITEMS: [string, string][] = STARTING_PICKERS.map((p) => [p.id, p.name]);

export default function VignettePreview() {
  const [pickerId, setPickerId] = useState(STARTING_PICKERS[0].id);
  const [productId, setProductId] = useState('water');
  const [pose, setPose] = useState<VignettePose>('call');
  const [mood, setMood] = useState<VignetteMood>('call');
  const [hold, setHold] = useState<VignetteHold>('tsd');
  const [kit, setKit] = useState(0);
  const resultKeys = Object.keys(RESULT_VIGNETTES);
  const [resultKey, setResultKey] = useState(resultKeys[0]);

  const look = STARTING_PICKERS.find((p) => p.id === pickerId)!.look;
  const product = PRODUCTS[productId]?.look ?? null;
  const posed: VignetteRecipe = { dog: { at: [0, 0, 0], turn: 0.3, pose, mood, hold }, props: [], camera: FULL_BODY, background: BG };

  return (
    <div className="vg-page">
      <h1>Сценки-иллюстрации</h1>

      <h2>Портрет в окне развилки (224 × 250)</h2>
      <div className="vg-row">
        {STARTING_PICKERS.map((p) => (
          <figure key={p.id} className="vg-portrait">
            <div className="vg-portrait-box"><PickerPortrait look={p.look} /></div>
            <figcaption>{p.name}</figcaption>
          </figure>
        ))}
      </div>

      <h2>Общие настройки</h2>
      <Row title="Сборщик"><Buttons items={PICKER_ITEMS} value={pickerId} onPick={setPickerId} /></Row>
      <Row title="Товар задания"><Buttons items={PRODUCT_ITEMS} value={productId} onPick={setProductId} /></Row>

      <h2>Конструктор позы</h2>
      <Row title="Поза"><Buttons items={POSES} value={pose} onPick={setPose} /></Row>
      <Row title="Эмоция"><Buttons items={MOODS} value={mood} onPick={setMood} /></Row>
      <Row title="В лапах"><Buttons items={HOLDS} value={hold} onPick={setHold} /></Row>
      <div className="vg-pose-box"><ResultVignette recipe={posed} look={look} product={product} /></div>

      <h2>Реквизит (V2a)</h2>
      <Row title="Сцена"><Buttons items={KIT.map(([t], i) => [i, t] as [number, string])} value={kit} onPick={setKit} /></Row>
      <div className="vg-result-box"><ResultVignette recipe={KIT[kit][1]} look={look} product={product} /></div>

      <h2>Сцены итога (окно итога, 770 × 260)</h2>
      <Row title="Сцена"><Buttons items={resultKeys.map((k) => [k, captionFor(k)] as [string, string])} value={resultKey} onPick={setResultKey} /></Row>
      <div className="vg-col">
        {STARTING_PICKERS.map((p) => (
          <figure key={p.id}>
            <div className="vg-result-box"><ResultVignette recipe={RESULT_VIGNETTES[resultKey]} look={p.look} product={product} /></div>
            <figcaption>{p.name}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
