/**
 * 윷놀이 도안 (IDE-017)
 *
 * 치수는 전부 [`./dimensions.ts`](./dimensions.ts)에서 온다. 아트워크
 * (`public/games/yut-nori/*.svg`)도 같은 상수로 그리므로 슬롯 좌표와 그림이
 * 어긋나지 않는다 — 치수를 고칠 때는 `dimensions.ts`만 고치고
 * `npm run artwork yut-nori`를 돌린다.
 *
 * ## 앞선 세 게임과 다른 점
 *
 * 1. **판이 정사각이다.** 축구는 A4 가로, 야구는 A4 세로였다. 파트 검증이
 *    `widthMm >= heightMm`를 `landscape`로 읽으므로 **정사각 보드는
 *    `landscape`로 선언해야 통과한다**(`lib/schema/parts.ts`). 규칙이 이미
 *    그렇게 정해져 있었고 이 게임이 처음 밟는다.
 * 2. **판 위에 마커가 하나도 없다.** 축구의 전술 대형도 야구의 수비 시프트도
 *    "시작할 때 말이 판 위 어디에 서 있는가"였는데, 윷놀이는 말이 **판 밖에서**
 *    시작한다. 그래서 `styleSets`·`presets`가 비고 보드 파트에는 슬롯 배치가
 *    하나도 없다 — 만들기 화면에서 말판을 골라도 옵션 줄이 비는 첫 게임이다
 *    (`slotsAffectingPart`가 빈 배열을 준다).
 * 3. **그룹이 판이 아니라 부속에만 산다.** 편(팀)은 이름과 색만 갖고, 그 둘은
 *    말 시트에 나타난다. 세계일주의 말 여섯과 같은 모양이되 여기서는 넷이
 *    편이고 편마다 말이 넷이다.
 */
import { defineGame } from '@/lib/schema';
import { RULES } from './rules';
import {
  SIDES,
  STICK_SHEET,
  TOKEN,
  TOKENS_PER_SIDE,
  TOKEN_SHEET,
  BOARD,
  RULES_SHEET,
  artworkPath,
  sideLayerId,
  tokenCenterXMm,
  tokenFoldYMm,
} from './dimensions';

const BOARD_PART_ID = 'board';
const TOKENS_PART_ID = 'tokens';
const STICKS_PART_ID = 'sticks';
const RULES_PART_ID = 'rules-sheet';

const sideGroupId = (n: number): string => `side-${n}`;
const sideNameSlotId = (n: number): string => `side-${n}-name`;
const sideColorSlotId = (n: number): string => `side-${n}-color`;

/**
 * 편 이름이 앉는 자리 — 말 넷 × 두 면이라 배치가 여덟이다.
 *
 * 텐트형 말은 접으면 위쪽 면이 뒤로 넘어가 뒤집히므로 그 면의 글자는 미리
 * 180° 돌려 둔다(`rotationDeg`). 미리보기와 인쇄 렌더러가 같은 값을 읽으므로
 * 화면에서 바로 선 글자가 종이에서도 바로 선다.
 */
const namePlacements = (sideIndex: number) => {
  const foldYMm = tokenFoldYMm(sideIndex);
  const shared = {
    partId: TOKENS_PART_ID,
    mode: 'text' as const,
    align: 'center' as const,
    fontSizeMm: TOKEN.nameFontMm,
    maxWidthMm: TOKEN.nameMaxWidthMm,
  };
  return Array.from({ length: TOKENS_PER_SIDE }, (_, tokenIndex) => {
    const xMm = tokenCenterXMm(tokenIndex);
    return [
      { ...shared, xMm, yMm: foldYMm + TOKEN.nameOffsetMm },
      {
        ...shared,
        xMm,
        yMm: foldYMm - TOKEN.nameOffsetMm,
        rotationDeg: 180,
      },
    ];
  }).flat();
};

/**
 * 편 하나 = 그룹 하나. 이름 슬롯과 색 슬롯을 가리킨다.
 *
 * 마커가 없으므로 `mirrorMarkers`는 쓰지 않는다. 편은 말의 색과 그림으로
 * 갈리지 방향으로 갈리지 않는다.
 */
const sideGroups = SIDES.map((side) => ({
  id: sideGroupId(side.id),
  label: `${side.id}편 · ${side.label}`,
  nameSlotId: sideNameSlotId(side.id),
  colorSlotId: sideColorSlotId(side.id),
}));

const sideSlots = SIDES.flatMap((side, sideIndex) => [
  {
    id: sideNameSlotId(side.id),
    kind: 'text' as const,
    label: `${side.id}편 이름`,
    help: '비워 두면 오린 뒤 손으로 써도 된다. 말 넷에 모두 찍힌다.',
    groupId: sideGroupId(side.id),
    maxLength: 5,
    default: '',
    placeholder: '이름',
    placements: namePlacements(sideIndex),
  },
  {
    id: sideColorSlotId(side.id),
    kind: 'color' as const,
    label: `${side.id}편 색`,
    help: '흑백으로 뽑아도 그림이 다르니 편은 갈린다. 색은 알아보기 쉬우라고 있다.',
    groupId: sideGroupId(side.id),
    default: side.color,
    placements: [
      {
        partId: TOKENS_PART_ID,
        mode: 'paint' as const,
        layerId: sideLayerId(side.id),
        property: 'fill' as const,
      },
    ],
  },
]);

export default defineGame({
  schemaVersion: 1,
  id: 'yut-nori',
  title: '윷놀이',
  tagline: '윷가락 넷을 던져 말 넷을 먼저 내보내는 2~4편 말판놀이',
  description:
    '밭 스물아홉이 그려진 전통 윷판을 인쇄해 펼치고, 윷가락 넷을 던져 나온 ' +
    '수만큼 말을 옮긴다. 오른쪽 아래에서 출발해 반시계로 한 바퀴 도는 것이 ' +
    '스무 칸인데, 모서리의 큰 밭에 정확히 멈추면 가운데를 가로지르는 지름길이 ' +
    '열려 열한 칸으로 준다 — 그 갈림길에서 판이 갈린다. 같은 편 말이 만나면 ' +
    '업고 다른 편 말을 만나면 잡는다. 말 넷이 먼저 다 나는 편이 이긴다. ' +
    '편은 넷까지 뽑히고 편마다 이름과 색을 넣을 수 있다. 던지는 윷가락 넉 ' +
    '장도 종이로 접는다 — 하나에는 백도 표식이 있다.',
  players: { min: 2, max: 4 },
  supplies: ['가위', '두꺼운 종이(말·윷가락용)'],
  // 카탈로그(IDE-005) 썸네일 — 별도로 그리지 않고 말판 아트워크를 그대로 쓴다.
  // 실제 인쇄될 도안을 보여주는 게 만든 아이콘보다 정직한 미리보기다.
  thumbnail: artworkPath(BOARD_PART_ID),

  rules: [...RULES],

  parts: [
    {
      id: BOARD_PART_ID,
      kind: 'board',
      title: '말판',
      description:
        '한 변 198mm의 정사각 윷판이다. 배율 100%에서 A4 세로 한 장에 그대로 ' +
        '들어간다. 밭 스물아홉(바깥 스물 · 지름길 여덟 · 가운데 방 하나)과 ' +
        '지름길 대각선 넷, 진행 방향 화살표가 있다. 밭 이름은 적지 않는다 — ' +
        '큰 밭 다섯이 곧 지름길이 갈라지고 만나는 자리다. 오리거나 접지 않는다.',
      widthMm: BOARD.widthMm,
      heightMm: BOARD.heightMm,
      // 정사각이다. 검증이 `widthMm >= heightMm`를 가로로 읽는다.
      orientation: 'landscape',
      // 출발점 글자(3.4mm)가 하한을 정한다. 절반으로 줄이면 1.7mm다.
      minScale: 0.5,
      maxScale: 4,
      artwork: artworkPath(BOARD_PART_ID),
    },
    {
      id: TOKENS_PART_ID,
      kind: 'buildable',
      title: '말 · 네 편',
      description:
        '한 줄이 한 편이고 편마다 말이 넷이다. 두꺼운 종이에 뽑아 오리고 카드 ' +
        '가운데를 산 모양으로 한 번 접으면 혼자 선다 — 풀도 칼도 탭도 쓰지 ' +
        '않는다. 앞뒤 두 면에 같은 그림이 있어 어느 쪽에서 봐도 바로 보인다. ' +
        '밑동의 2·3·4는 업힌 말 수를 세는 표시다. 사람 수만큼 편을 골라 쓴다.',
      widthMm: TOKEN_SHEET.widthMm,
      heightMm: TOKEN_SHEET.heightMm,
      orientation: 'portrait',
      // 편 이름 글자(2.8mm)가 하한을 정한다.
      minScale: 0.8,
      maxScale: 2,
      marks: ['cut', 'fold-mountain'],
      artwork: artworkPath(TOKENS_PART_ID),
    },
    {
      id: STICKS_PART_ID,
      kind: 'buildable',
      title: '윷가락 · 넉 장',
      description:
        '던져서 눈을 내는 윷가락 넷이다. 띠 일곱을 같은 쪽으로 말면 반육각기둥 ' +
        '관이 되고, 남는 종이가 그대로 안으로 들어가 속대가 된다 — 그 속대가 ' +
        '이음매를 받치고 무게를 등 쪽에 실어 준다. 양 끝은 마구리로 막고 그 탭을 ' +
        '속대 밑으로 밀어 넣는다. 풀도 칼도 쓰지 않는다. 평평한 면이 배, 각진 ' +
        '세 면이 등이고 넉 장 가운데 하나에만 백도 과녁이 있다.',
      widthMm: STICK_SHEET.widthMm,
      heightMm: STICK_SHEET.heightMm,
      orientation: 'portrait',
      // 던져서 구르는 물건이라 배율이 곧 놀이의 성질이다. 100%가 원칙이고,
      // 종이가 얇아 자꾸 튀면 조금 키워 무게를 벌라고 위쪽만 조금 열어 둔다.
      // 줄이면 가벼워져 더 튀므로 아래쪽은 거의 열지 않는다.
      minScale: 0.9,
      maxScale: 1.3,
      marks: ['cut', 'fold-mountain', 'fold-valley'],
      artwork: artworkPath(STICKS_PART_ID),
    },
    {
      id: RULES_PART_ID,
      kind: 'cutout',
      title: '게임 방법',
      description:
        '판 옆에 두고 보는 규칙 한 장. 윷이 내는 다섯 값, 지름길이 열리는 ' +
        '조건, 업기와 잡기, 백도까지 적혀 있다. 배율 100%에서 A4 한 장이다.',
      widthMm: RULES_SHEET.widthMm,
      heightMm: RULES_SHEET.heightMm,
      orientation: 'portrait',
      // 본문 글자(2.9mm)가 하한을 정한다. 0.85면 2.5mm로, 그 아래는 안 읽힌다.
      minScale: 0.85,
      maxScale: 2,
      marks: ['cut'],
      artwork: artworkPath(RULES_PART_ID),
    },
  ],

  groups: sideGroups,
  slots: sideSlots,
});
