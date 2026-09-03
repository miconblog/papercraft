/**
 * 배치 프리셋 (IDE-003)
 *
 * 이름 붙은 슬롯 좌표 집합이다. 축구 게임판의 전술 대형(4-4-2 등)이 여기 담긴다.
 * 프리셋은 **출발점**이고, 사용자는 적용한 뒤 자유롭게 옮긴다(IDE-006).
 *
 * 프리셋은 그룹(팀) 하나를 통째로 배치한다. 양 팀에 같은 대형을 쓰려면 홈 좌표를
 * `mirrorPositions`로 뒤집어 원정용 프리셋을 만든다 — 두 팀이 서로 다른 대형을
 * 고를 수 있어야 하므로 하나의 프리셋에 22명을 담지 않는다.
 */
import { z } from 'zod';
import { mmCoord, slug } from './units';

export const slotPosition = z.strictObject({
  slotId: slug,
  xMm: mmCoord,
  yMm: mmCoord,
});
export type SlotPosition = z.infer<typeof slotPosition>;

export const layoutPreset = z.strictObject({
  id: slug,
  label: z.string().min(1).max(40),
  /** 같은 대형의 팀별 프리셋을 묶는 키. UI가 '4-4-2' 하나로 보여줄 때 쓴다. */
  formationId: slug.optional(),
  /** 이 프리셋이 배치하는 그룹(팀). */
  groupId: slug,
  /** 좌표가 속한 파트. 그룹의 마커 슬롯이 놓인 파트와 같아야 한다. */
  partId: slug,
  positions: z.array(slotPosition).min(1),
});
export type LayoutPreset = z.infer<typeof layoutPreset>;

/**
 * 좌표를 파트 세로 중심선 기준으로 좌우 반전한다. 상대 진영용 프리셋을 만들 때
 * 쓴다. y는 그대로 두므로 대형의 위아래 구성이 보존된다.
 */
export const mirrorPositions = (
  positions: readonly SlotPosition[],
  partWidthMm: number,
  slotIdMap: Readonly<Record<string, string>>,
): SlotPosition[] =>
  positions.map((p) => {
    const mapped = slotIdMap[p.slotId];
    if (!mapped) throw new Error(`대응하는 슬롯 id가 없다: ${p.slotId}`);
    return { slotId: mapped, xMm: partWidthMm - p.xMm, yMm: p.yMm };
  });
