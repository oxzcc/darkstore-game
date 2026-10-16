// Пакет заказа (W8a) — по фото автора: белый полупрозрачный пакет, сквозь него видны цветные товары заказа,
// ручки собраны и завязаны сверху, на узле жёлтая бирка, спереди зелёный логотип. Низ пакета — y = 0, лицо — +z.
// Размер ~0,34 × 0,46 м. Только отображение.
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BoxGeometry, MeshStandardMaterial } from 'three';
import { PALETTE } from '../../config/palette';
import type { BagLook } from '../couriers';

const W = 0.34, H = 0.3, D = 0.25;

// общие геометрии и материалы на все пакеты
const body = new RoundedBoxGeometry(W, H, D, 3, 0.06);
const shoulders = new RoundedBoxGeometry(0.24, 0.08, 0.17, 2, 0.03);
const unit = new BoxGeometry(1, 1, 1);
const shell = new MeshStandardMaterial({ color: PALETTE.orderBag, transparent: true, opacity: 0.72, roughness: 0.5 });
const solid = new MeshStandardMaterial({ color: PALETTE.orderBag, roughness: 0.6 });
const tag = new MeshStandardMaterial({ color: PALETTE.orderBagTag });
const logo = new MeshStandardMaterial({ color: PALETTE.uniform });
const goods = new Map<string, MeshStandardMaterial>();
const goodsMat = (color: string) => {
  let m = goods.get(color);
  if (!m) goods.set(color, (m = new MeshStandardMaterial({ color })));
  return m;
};

type Props = { look: BagLook; position?: [number, number, number]; rotationY?: number; scale?: number };

export default function OrderBag({ look, position = [0, 0, 0], rotationY = 0, scale = 1 }: Props) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* товары внутри — просвечивают */}
      {look.items.map((it, i) => (
        <group key={i} position={it.pos}>
          <mesh geometry={unit} material={goodsMat(it.color)} scale={it.size} />
          <mesh geometry={unit} material={goodsMat(it.accent)} position={[0, it.size[1] * 0.2, it.size[2] / 2 + 0.002]} scale={[it.size[0] * 0.7, it.size[1] * 0.25, 0.004]} />
        </group>
      ))}
      {/* сам пакет */}
      <mesh geometry={body} material={shell} position={[0, H / 2, 0]} castShadow />
      <mesh geometry={shoulders} material={shell} position={[0, H + 0.02, 0]} />
      {/* собранное горлышко, узел и два «ушка» ручек */}
      <mesh geometry={unit} material={solid} position={[0, H + 0.08, 0]} scale={[0.08, 0.07, 0.07]} />
      <mesh geometry={unit} material={solid} position={[0, H + 0.12, 0]} scale={[0.07, 0.04, 0.06]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={unit} material={solid} position={[s * 0.045, H + 0.16, 0]} rotation={[0, 0, -s * 0.45]} scale={[0.03, 0.09, 0.035]} />
      ))}
      {/* жёлтая бирка на узле */}
      <mesh geometry={unit} material={tag} position={[0.02, H + 0.105, 0.04]} rotation={[0, 0, 0.15]} scale={[0.07, 0.055, 0.012]} />
      {/* логотип спереди */}
      <mesh geometry={unit} material={logo} position={[-0.06, H * 0.55, D / 2 + 0.003]} scale={[0.085, 0.085, 0.006]} />
      <mesh geometry={unit} material={logo} position={[0.06, H * 0.55, D / 2 + 0.003]} scale={[0.12, 0.025, 0.006]} />
    </group>
  );
}
