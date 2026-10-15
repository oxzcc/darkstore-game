// Сборщик-заглушка по art/reference/character_picker_*.png: собака в форме из кубов.
// Окрас — порода; форма у всех одна (зелёная кепка и фартук, белая рубашка). Цвет сборщика — только кольцо (08, 3.2).
// Рост ~1,5 м, «чиби»: большая голова (08, раздел 2). Настоящая воксельная модель — позже.
import { PALETTE } from '../../config/palette';

type Props = {
  position: [number, number, number];
  facing: number;   // поворот вокруг вертикали, радианы
  hop: number;      // подскок при ходьбе, метры (как в Crossy Road, 08, раздел 9)
  fur: string;
  ringColor: string;
};

const SHIRT = '#FFFFFF';
const PAWS = '#3A342A';

function Box({ p, s, c, shadow = true }: { p: [number, number, number]; s: [number, number, number]; c: string; shadow?: boolean }) {
  return (
    <mesh position={p} castShadow={shadow} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} />
    </mesh>
  );
}

/** Квадратное кольцо под ногами (ui_06): четыре плоские полоски. */
function Ring({ color }: { color: string }) {
  const r = 0.42, w = 0.07, y = 0.02;
  return (
    <group>
      <Box p={[0, y, -r]} s={[2 * r + w, 0.02, w]} c={color} shadow={false} />
      <Box p={[0, y, r]} s={[2 * r + w, 0.02, w]} c={color} shadow={false} />
      <Box p={[-r, y, 0]} s={[w, 0.02, 2 * r]} c={color} shadow={false} />
      <Box p={[r, y, 0]} s={[w, 0.02, 2 * r]} c={color} shadow={false} />
    </group>
  );
}

export default function Picker({ position, facing, hop, fur, ringColor }: Props) {
  return (
    <group position={position}>
      <Ring color={ringColor} />
      <group position={[0, hop, 0]} rotation={[0, facing, 0]}>
        {/* лапы */}
        <Box p={[-0.1, 0.17, 0]} s={[0.14, 0.34, 0.16]} c={PAWS} />
        <Box p={[0.1, 0.17, 0]} s={[0.14, 0.34, 0.16]} c={PAWS} />
        {/* туловище: рубашка и зелёный фартук спереди (+z — «вперёд») */}
        <Box p={[0, 0.58, 0]} s={[0.4, 0.48, 0.28]} c={SHIRT} />
        <Box p={[0, 0.54, 0.145]} s={[0.34, 0.4, 0.02]} c={PALETTE.primary} />
        {/* лапы-руки */}
        <Box p={[-0.25, 0.6, 0.02]} s={[0.1, 0.34, 0.12]} c={fur} />
        <Box p={[0.25, 0.6, 0.02]} s={[0.1, 0.34, 0.12]} c={fur} />
        {/* голова, морда, нос, уши */}
        <Box p={[0, 1.07, 0]} s={[0.5, 0.46, 0.46]} c={fur} />
        <Box p={[0, 0.98, 0.27]} s={[0.24, 0.18, 0.12]} c={SHIRT} />
        <Box p={[0, 1.03, 0.34]} s={[0.08, 0.06, 0.04]} c={PAWS} />
        <Box p={[-0.17, 1.38, -0.04]} s={[0.12, 0.18, 0.1]} c={fur} />
        <Box p={[0.17, 1.38, -0.04]} s={[0.12, 0.18, 0.1]} c={fur} />
        {/* кепка с козырьком */}
        <Box p={[0, 1.33, 0]} s={[0.52, 0.1, 0.48]} c={PALETTE.primary} />
        <Box p={[0, 1.29, 0.3]} s={[0.4, 0.04, 0.16]} c={PALETTE.primary} />
      </group>
    </group>
  );
}
