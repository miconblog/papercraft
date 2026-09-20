/**
 * 야구장을 그릴 때 필요한 값 한 벌 (IDE-044)
 *
 * 야구장이 **동적 파트**가 되면서 그림이 커스터마이즈에 딸리게 됐다. 무엇이
 * 딸리는지를 여기 한 군데에 모아 둔다 — 그리는 쪽(`./field.ts`)은 값이 어디서
 * 왔는지 몰라도 되고, 읽는 쪽은 그림을 몰라도 된다.
 *
 * 딸리는 것이 셋이다.
 *
 * 1. **규칙 한 벌**(`rule-set`) — 기본이면 IDE-014가 그린 야구장 그대로다.
 * 2. **팀 수비 능력치**(`defense-ability`) — 자리마다 범위 원이 얼마나 커지나.
 * 3. **수비 마커의 지금 자리** — 원은 마커를 중심으로 그려지므로, 시프트를
 *    바꾸거나 마커를 끌면 원도 따라간다. 값이 아니라 **좌표**에 딸리는 첫
 *    동적 파트다.
 */
// 별칭(`@/`)이 아니라 상대 경로다 — `npm run artwork`가 이 파일을 node로 곧장
// 읽어 정적 한 벌을 뽑기 때문이다(다른 아트워크 파일도 같은 규약이다).
import type { GameCustomization } from '../../../../lib/schema/index.ts';
import {
  ABILITY_SLOT_ID,
  DEFAULT_RULE_SET,
  DEFAULT_SHIFT,
  DEFENSE_POSITIONS,
  RULE_SETS,
  RULE_SET_SLOT_ID,
  abilityRoomMm,
  defenseSlotId,
  reachMm,
  type DefensePosition,
  type RuleSetId,
} from '../dimensions.ts';

/** 판에 선 수비 한 명 — 자리·좌표·능력치·그래서 반경. */
export interface DefenseOnField {
  readonly position: DefensePosition;
  readonly xMm: number;
  readonly yMm: number;
  /** 이 자리에 준 능력치. 0이면 판에 적지 않는다(`IDE-032`의 규약). */
  readonly abilityMm: number;
  /** 기본 반경에 능력치를 얹은 값. */
  readonly reachMm: number;
}

export interface FieldSpec {
  readonly ruleSet: RuleSetId;
  /** `DEFENSE_POSITIONS`와 같은 차례. */
  readonly defense: readonly DefenseOnField[];
}

const isRuleSet = (value: unknown): value is RuleSetId =>
  RULE_SETS.some((set) => set.id === value);

/**
 * 능력치 배열 하나 → 자리마다의 mm.
 *
 * 값이 없거나 모양이 틀렸으면 0이다 — 옛 저장값에도 판 하나는 나와야 한다
 * (골프의 `customHoleSpec`과 같은 규약). 예산을 넘긴 값은 **그대로 두지
 * 않고 통째로 버린다**: 한 자리만 깎으면 어느 자리가 깎였는지 그림에서
 * 알 수 없고, 검증(`validateCustomization`)이 이미 사용자에게 말하고 있다.
 */
const abilityOf = (value: unknown, budgetMm: number): number[] => {
  const room = DEFENSE_POSITIONS.map((p) => abilityRoomMm(p.zone));
  if (!Array.isArray(value) || value.length !== room.length)
    return room.map(() => 0);
  const given = room.map((max, i) => {
    const raw: unknown = value[i];
    return typeof raw === 'number' && Number.isFinite(raw)
      ? Math.min(Math.max(Math.round(raw), 0), max)
      : 0;
  });
  const spent = given.reduce((sum, v) => sum + v, 0);
  return spent > budgetMm ? room.map(() => 0) : given;
};

/**
 * 커스터마이즈 → 야구장 한 장.
 *
 * 좌표는 사용자가 옮긴 자리(`positions`)를 먼저 보고, 없으면 기본 수비다.
 */
export function fieldSpecOf(
  customization: GameCustomization,
  budgetMm: number,
): FieldSpec {
  const raw = customization.values[RULE_SET_SLOT_ID];
  const ability = abilityOf(customization.values[ABILITY_SLOT_ID], budgetMm);
  return {
    ruleSet: isRuleSet(raw) ? raw : DEFAULT_RULE_SET,
    defense: DEFENSE_POSITIONS.map((position, i) => {
      const [defaultX, defaultY] = DEFAULT_SHIFT.positions[i];
      const at = customization.positions[defenseSlotId(position.id)];
      return {
        position,
        xMm: Number.isFinite(at?.xMm) ? at!.xMm : defaultX,
        yMm: Number.isFinite(at?.yMm) ? at!.yMm : defaultY,
        abilityMm: ability[i],
        reachMm: reachMm(position.zone, ability[i]),
      };
    }),
  };
}

/** 기본 규칙 · 배분 없음 · 기본 수비 — 정적 파일이 되는 한 벌. */
export const defaultFieldSpec = (): FieldSpec => ({
  ruleSet: DEFAULT_RULE_SET,
  defense: DEFENSE_POSITIONS.map((position, i) => {
    const [xMm, yMm] = DEFAULT_SHIFT.positions[i];
    return {
      position,
      xMm,
      yMm,
      abilityMm: 0,
      reachMm: reachMm(position.zone, 0),
    };
  }),
});
