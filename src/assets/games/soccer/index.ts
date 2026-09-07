/**
 * 축구 게임판 도안 (IDE-004)
 *
 * 치수는 전부 [`./dimensions.ts`](./dimensions.ts)에서 온다. 아트워크
 * (`public/games/soccer/*.svg`)도 같은 상수로 그리므로 슬롯 좌표와 그림이
 * 어긋나지 않는다 — 치수를 고칠 때는 `dimensions.ts`만 고치고
 * `npm run artwork`를 돌린다.
 *
 * 선수 마커 아트워크(원형·일러스트, 필드 선수·골키퍼 각각)와 전술 대형 프리셋은
 * `IDE-010`이 확정했다 — 마커는 `artwork/player-markers.ts`, 대형 근거는
 * `docs/soccer-artwork.md` 11절을 본다.
 */
import { defineGame, mirrorPositions, type SlotPosition } from '@/lib/schema';
import { RULES } from './rules';
import {
  artworkPath,
  BALL,
  BOARD,
  FIELD,
  FORMATION_LANES,
  GOALKEEPER_POSE,
  MARKER_POSES,
  markerArtworkId,
  poseStyleSetId,
  GOAL,
  PLAYER_MARKER,
  SHEETS,
} from './dimensions';

const TEAMS = [
  {
    id: 'home',
    label: '홈 팀',
    defaultColor: '#1d4ed8',
  },
  {
    id: 'away',
    label: '원정 팀',
    defaultColor: '#dc2626',
  },
] as const;

/**
 * 대형 좌표 — **홈 팀 기준**이다. 배열 순서가 선수 슬롯 1–11번이고, 1번은
 * 골키퍼다. 원정은 `mirrorPositions`로 좌우 반전해 쓴다.
 *
 * **골키퍼를 뺀 열 명이 자기 진영에 다섯, 상대 진영에 다섯**이다(2026-09-06
 * 사용자 요청). 그래서 대형마다 중원이 하프라인을 사이에 두고 갈린다 — 4-3-3은
 * 수비 넷 + 수비형 중원 하나가 자기 진영, 중원 둘 + 공격 셋이 상대 진영이다.
 * 자기 진영은 `DF`·`DM` 레인, 상대 진영은 `MF`·`AM`·`FW` 레인만 쓴다.
 *
 * 현대 축구에서 흔한 여섯 대형이다. x는 `FORMATION_LANES`의 값만 쓴다 —
 * 레인이 서로 떨어져 있다는 것이 "어떤 대형 조합을 골라도 겹치지 않는다"의
 * 근거다. y는 같은 레인 안에서 충분히 벌린다(넷이 설 때 46mm 간격).
 */
const {
  goalkeeper: GK,
  defence: DF,
  defensiveMidfield: DM,
  midfield: MF,
  attackingMidfield: AM,
  forward: FW,
} = FORMATION_LANES;

const BACK_FOUR: ReadonlyArray<readonly [number, number]> = [
  [DF, 35],
  [DF, 82],
  [DF, 128],
  [DF, 175],
];
const BACK_THREE: ReadonlyArray<readonly [number, number]> = [
  [DF, 55],
  [DF, 105],
  [DF, 155],
];

/** 순서가 곧 셀렉트 박스의 차례다 — 많이 쓰는 것부터. */
const FORMATIONS: Record<string, ReadonlyArray<readonly [number, number]>> = {
  '4-3-3': [
    [GK, 105],
    ...BACK_FOUR,
    [DM, 105],
    [MF, 70],
    [MF, 140],
    [FW, 52],
    [FW, 105],
    [FW, 158],
  ],
  '4-2-3-1': [
    [GK, 105],
    ...BACK_FOUR,
    [DM, 105],
    [MF, 105],
    [AM, 48],
    [AM, 105],
    [AM, 162],
    [FW, 105],
  ],
  '4-4-2': [
    [GK, 105],
    ...BACK_FOUR,
    [DM, 105],
    [MF, 55],
    [MF, 105],
    [MF, 155],
    [FW, 82],
    [FW, 128],
  ],
  '3-5-2': [
    [GK, 105],
    ...BACK_THREE,
    [DM, 78],
    [DM, 132],
    [MF, 55],
    [MF, 105],
    [MF, 155],
    [FW, 82],
    [FW, 128],
  ],
  '3-4-3': [
    [GK, 105],
    ...BACK_THREE,
    [DM, 78],
    [DM, 132],
    [MF, 70],
    [MF, 140],
    [FW, 52],
    [FW, 105],
    [FW, 158],
  ],
  '4-1-4-1': [
    [GK, 105],
    ...BACK_FOUR,
    [DM, 105],
    [MF, 35],
    [MF, 82],
    [MF, 128],
    [MF, 175],
    [FW, 105],
  ],
};

/** 슬롯의 기본 좌표는 4-3-3 배치다 — 첫 화면이 곧 쓸 수 있는 배치여야 한다. */
const DEFAULT_FORMATION = '4-3-3';

/**
 * 선수 슬롯 1–11번이 쓰는 자세 (2026-09-06).
 *
 * 옛 인쇄본처럼 판 위 선수가 저마다 다른 동작을 하고 있게 한다(사용자 요청).
 * 배정 기준은 **기본 대형(4-3-3)의 역할**이다 — 1번 골키퍼는 세이브, 2–5번
 * 수비는 낮게 벌려 선 자세와 달리기, 6–8번 중원은 달리기·패스, 9–11번 공격은
 * 질주·슛·헤딩이다. 같은 줄에 선 이웃끼리는 자세를 엇갈리게 두어 줄이 반복돼
 * 보이지 않게 했다.
 *
 * 자세는 슬롯에 붙는다(대형이 아니라). 대형을 바꾸면 같은 선수가 다른 레인으로
 * 옮겨 가므로 역할과 자세가 어긋날 수 있는데, 자세는 판을 살리는 장식이지
 * 규칙에 쓰이는 값이 아니라 그대로 둔다 — 대형마다 자세를 다시 배정하면
 * 프리셋을 고를 때마다 그림이 튄다.
 *
 * 두 팀이 같은 표를 쓴다. 원정은 마커를 통째로 좌우 반전하므로 자세가 같아도
 * 서로 반대쪽을 본다(`mirrorMarkers`).
 */
const POSE_BY_PLAYER: readonly string[] = [
  GOALKEEPER_POSE.id, // 1 · 골키퍼
  'block', // 2 · 오른쪽 수비
  'run', // 3 · 중앙 수비
  'block', // 4 · 중앙 수비
  'pass', // 5 · 왼쪽 수비
  'run', // 6 · 중원
  'pass', // 7 · 중원
  'run', // 8 · 중원
  'sprint', // 9 · 오른쪽 공격
  'strike', // 10 · 중앙 공격
  'header', // 11 · 왼쪽 공격
];

const playerSlotId = (team: string, n: number) => `${team}-player-${n}`;

const homeToAwaySlotId: Record<string, string> = Object.fromEntries(
  FORMATIONS[DEFAULT_FORMATION].map((_, i) => [
    playerSlotId('home', i + 1),
    playerSlotId('away', i + 1),
  ]),
);

const homePositions = (formationId: string): SlotPosition[] =>
  FORMATIONS[formationId].map(([xMm, yMm], i) => ({
    slotId: playerSlotId('home', i + 1),
    xMm,
    yMm,
  }));

const playerSlots = TEAMS.flatMap((team) => {
  const positions =
    team.id === 'home'
      ? homePositions(DEFAULT_FORMATION)
      : mirrorPositions(
          homePositions(DEFAULT_FORMATION),
          BOARD.widthMm,
          homeToAwaySlotId,
        );

  return positions.map((pos, i) => ({
    id: pos.slotId,
    // 숫자가 아니라 **글자**다. `number` 슬롯은 빈 값을 허용하지 않는데, 이
    // 도안의 기본값은 비어 있어야 한다 — 아이가 종이에 직접 쓰는 자리다
    // (2026-09-05 사용자 요청). 넣고 싶은 사람은 에디터에서 넣을 수 있다.
    kind: 'text' as const,
    label: `${team.label} ${i + 1}번`,
    help:
      i === 0
        ? '골키퍼 자리다. 비워 두면 등번호 없이 빈 원으로 인쇄된다.'
        : undefined,
    groupId: team.id,
    tags: i === 0 ? ['goalkeeper'] : [],
    maxLength: 2,
    default: '',
    placeholder: '비움',
    placements: [
      {
        partId: 'field',
        mode: 'marker' as const,
        xMm: pos.xMm,
        yMm: pos.yMm,
        // 세트가 곧 **자세**다(`POSE_BY_PLAYER`). 골키퍼 세트는 그 위에
        // 장갑과 안쪽 테까지 달라 흑백에서도 역할이 구분된다.
        styleSetId: poseStyleSetId(POSE_BY_PLAYER[i]),
        regionId: 'playable-field',
      },
    ],
  }));
});

/**
 * 마커 스타일 세트 — **자세 하나 = 세트 하나**다.
 *
 * 세 변형(`circle` · `illustration` · `outline`)을 모든 세트가 똑같이 갖는다.
 * 사용자가 고르는 것은 세트가 아니라 변형이고(`marker-style` 슬롯 하나가 모든
 * 세트를 동시에 바꾼다), 세트는 슬롯에 배정된 자세다. 스키마가 "선택 슬롯의
 * 선택지 = 변형 id 목록"을 강제하므로 세트마다 변형 구성이 같아야 한다.
 *
 * 빈 원은 자세와 무관해 **파일 하나를 모든 세트가 나눠 쓴다** — 자세마다 같은
 * 원을 열두 번 찍을 이유가 없다.
 */
const markerStyleSet = (
  pose: { readonly id: string; readonly label: string },
  isGoalkeeper: boolean,
) => ({
  id: poseStyleSetId(pose.id),
  label: `${isGoalkeeper ? '골키퍼' : '선수'} 마커 · ${pose.label}`,
  selectorSlotId: 'marker-style',
  variants: [
    {
      id: 'circle',
      label: '빈 원',
      widthMm: PLAYER_MARKER.circle.widthMm,
      heightMm: PLAYER_MARKER.circle.heightMm,
      valueFontSizeMm: PLAYER_MARKER.circle.valueFontSizeMm,
      // 속을 채우지 않는다 — 아이가 칠할 면이다. 팀 색은 테두리로 받고,
      // 등번호도 흰 배경 위라 팀 색으로 찍힌다.
      filled: false,
      artwork: artworkPath(
        isGoalkeeper ? 'goalkeeper-marker-circle' : 'player-marker-circle',
      ),
    },
    {
      id: 'illustration',
      label: '선수 그림',
      widthMm: PLAYER_MARKER.illustration.widthMm,
      heightMm: PLAYER_MARKER.illustration.heightMm,
      valueFontSizeMm: PLAYER_MARKER.illustration.valueFontSizeMm,
      artwork: artworkPath(markerArtworkId(pose.id, 'illustration')),
    },
    {
      id: 'outline',
      label: '선수 그림 · 색칠용',
      widthMm: PLAYER_MARKER.illustration.widthMm,
      heightMm: PLAYER_MARKER.illustration.heightMm,
      valueFontSizeMm: PLAYER_MARKER.illustration.valueFontSizeMm,
      // 속이 비어 있다 — 실루엣과 같은 그림을 아이가 칠할 수 있게 낸 변형이라
      // 등번호도 빈 원과 같은 규칙(팀 색)을 따라야 흰 종이 위에서 읽힌다.
      filled: false,
      artwork: artworkPath(markerArtworkId(pose.id, 'outline')),
    },
  ],
});

const markerStyleSets = [
  ...MARKER_POSES.map((pose) => markerStyleSet(pose, false)),
  markerStyleSet(GOALKEEPER_POSE, true),
];

/*
 * 팀 이름 슬롯은 없다(2026-09-06 사용자 요청 — "팀 이름 입력칸도 필요없어").
 * 점수 기록칸 헤더는 **판 · 이름 · 이름**이고 그 아래는 비어 있다 — 등번호처럼
 * 아이가 종이에 직접 쓰는 자리다. 어느 칸이 어느 팀인지도 그 손글씨가 정한다
 * (2026-09-08 사용자 요청으로 색 막대를 뺐다).
 */

/**
 * 팀 색 — 이제 **운동장 마커 테두리에만** 쓴다(2026-09-08).
 *
 * 마커를 빈 원으로 바꾸면서 한 번 뺐다가, 사용자가 "원의 색상은 빨강과 파랑으로
 * 구분해 달라"고 해 되살렸다(2026-09-05). 원 **안**은 여전히 비어 있다 — 색이
 * 붙는 곳은 테두리와 화살촉뿐이라 아이가 칠할 면은 그대로 남는다.
 *
 * 점수 기록칸의 색 막대는 뺐다(2026-09-08). 그래서 이 슬롯은 **배치가 하나도
 * 없다** — 마커 색은 배치가 아니라 그룹의 `colorSlotId`를 통해 렌더러가 읽어
 * 가기 때문이다(`lib/customization/render.ts`). 마커는 파트 레이어가 아니라
 * 슬롯마다 따로 그려진다.
 */
const teamColorSlots = TEAMS.map((team) => ({
  id: `${team.id}-color`,
  kind: 'color' as const,
  label: `${team.label} 색`,
  help: '흑백으로 뽑아도 두 팀이 구분되도록 밝기 차이를 두면 좋다.',
  groupId: team.id,
  default: team.defaultColor,
  /**
   * **배치가 없다**(2026-09-08). 점수 기록칸의 색 막대가 이 슬롯의 유일한
   * 배치였는데 그 막대를 뺐다(사용자 요청 — "점수 기록도 파랑 빨강 필요없이,
   * 판/이름으로 빈칸으로"). 팀 이름을 아이가 직접 쓰는 자리라 색이 미리
   * 정해져 있으면 오히려 걸린다.
   *
   * 값은 그대로 살아 **운동장 선수 마커를 칠한다** — 마커 색은 배치가 아니라
   * 그룹을 통해 읽히기 때문이다(`colorSlotId` → `groupColorOf`). 그래서 배치가
   * 비어도 되는 유일한 슬롯이고, `parseGame`이 그 예외를 알고 있다.
   */
  placements: [],
}));

export default defineGame({
  schemaVersion: 1,
  id: 'soccer',
  title: '축구 게임판',
  tagline: '공을 연필로 튕겨 상대 골대에 넣는 2인용 축구',
  description:
    '운동장을 인쇄해 펼치고, 선수 마커 위의 공을 연필로 튕겨 패스와 슛을 한다. ' +
    '골대는 오려 접어 골라인 바깥 눈금에 맞춰 세우고, 점수는 함께 뽑은 기록칸에 ' +
    '적는다. 등번호와 팀 이름·색, 선수 배치를 원하는 대로 바꿔 인쇄할 수 있다.',
  players: { min: 2, max: 2 },
  supplies: ['연필', '가위', '풀', `공(지름 ${BALL.diameterMm}mm쯤)`],
  // 카탈로그(IDE-005) 썸네일 — 별도로 그리지 않고 운동장 아트워크를 그대로 쓴다.
  // 실제 인쇄될 도안을 보여주는 게 만든 아이콘보다 정직한 미리보기다.
  thumbnail: artworkPath('field'),

  // 규칙은 소개 페이지가 그린다. 예전에는 `rules-card` 파트로 뽑았지만 그 카드를
  // 출력물에서 뺐다(2026-09-05 사용자 요청) — 화면에서 읽으면 되는 글이라
  // 인쇄 매수를 쓸 이유가 없었다.
  rules: [...RULES],

  parts: [
    {
      id: 'field',
      kind: 'board',
      title: '운동장',
      description:
        '배율 100%에서 A4를 가로로 놓은 크기다. 오리거나 접지 않는다. ' +
        '공을 반복해서 튕기고 미끄러뜨리는 면이라 조금 두꺼운 종이에 뽑으면 오래 쓴다.',
      widthMm: BOARD.widthMm,
      heightMm: BOARD.heightMm,
      orientation: 'landscape',
      // 등번호(5mm)가 종이에서 2.5mm 아래로 내려가지 않는 선.
      minScale: 0.5,
      maxScale: 4,
      artwork: artworkPath('field'),
      regions: [
        {
          id: 'playable-field',
          label: '필드',
          rect: {
            xMm: FIELD.xMm,
            yMm: FIELD.yMm,
            widthMm: FIELD.widthMm,
            heightMm: FIELD.heightMm,
          },
        },
        {
          id: 'home-half',
          label: '홈 진영',
          rect: {
            xMm: FIELD.xMm,
            yMm: FIELD.yMm,
            widthMm: FIELD.widthMm / 2,
            heightMm: FIELD.heightMm,
          },
        },
        {
          id: 'away-half',
          label: '원정 진영',
          rect: {
            xMm: FIELD.xMm + FIELD.widthMm / 2,
            yMm: FIELD.yMm,
            widthMm: FIELD.widthMm / 2,
            heightMm: FIELD.heightMm,
          },
        },
      ],
    },
    {
      id: 'score-sheet',
      kind: 'cutout',
      title: '점수 기록칸',
      description: '여러 판을 이어 적는 칸. 오려서 옆에 두고 쓴다.',
      widthMm: SHEETS.scoreSheet.widthMm,
      heightMm: SHEETS.scoreSheet.heightMm,
      orientation: 'landscape',
      // 판 번호(3.6mm)가 하한을 정한다. 더 줄이면 점수를 적을 칸도 좁아진다.
      minScale: 0.7,
      maxScale: 2,
      marks: ['cut'],
      artwork: artworkPath('score-sheet'),
    },
    {
      id: 'goals',
      kind: 'buildable',
      title: '골대 전개도',
      description:
        '오려 접어 골라인 밖에 놓는 입체 골대. 뚜껑 달린 쟁반(쓰레받기) 모양이라 ' +
        '풀도 칼도 쓰지 않는다 — 뒷벽 탭을 옆벽 겹으로 물리고, 뚜껑은 양옆 귀를 ' +
        '옆벽에 씌워 닫는다. 앞으로 뻗은 입술이 운동장 위에 얹혀 공이 넘을 턱이 없고, ' +
        '뚜껑이 위를 막아 골포스트를 맞고 튄 공도 밖으로 나가지 않는다. 운동장 ' +
        '골라인의 눈금에 입술 좌우 끝을 맞춰 놓는다. **한 장에 두 개**가 들어 있다 — ' +
        '접는 순서는 이 페이지의 "골대 접는 법"에서 읽고, 시트에는 그림 도해만 실었다. ' +
        `골문이 ${GOAL.mouthWidthMm}×${GOAL.wallHeightMm}mm라 배율을 바꾸면 공 크기도 함께 맞춰야 한다.`,
      widthMm: SHEETS.goals.widthMm,
      heightMm: SHEETS.goals.heightMm,
      orientation: 'landscape',
      minScale: 0.8,
      maxScale: 2,
      // 인쇄면이 쟁반 안쪽을 향해야 그물이 안에서 보이므로 대부분 골접기고,
      // 뚜껑 귀 둘만 산접기다 — 옆벽을 바깥에서 감싸야 뚜껑이 들리지 않는다.
      // 풀칠면은 없다(2026-09-06) — 겹으로 탭을 물어 잠근다.
      marks: ['cut', 'fold-valley', 'fold-mountain'],
      artwork: artworkPath('goals'),
    },
  ],

  groups: TEAMS.map((team) => ({
    id: team.id,
    label: team.label,
    // 이름 슬롯은 없다 — 점수 기록칸의 팀 칸은 아이가 직접 쓴다(2026-09-06).
    colorSlotId: `${team.id}-color`,
    // 원정은 왼쪽 골대로 공격한다 — 마커의 화살촉이 그쪽을 가리키게 뒤집는다.
    // 두 팀이 필드 전체에 섞여 서기 때문에 위치로는 팀을 알 수 없고, 흑백으로
    // 뽑으면 팀 색도 구분되지 않을 수 있다(IDE-010).
    mirrorMarkers: team.id === 'away',
  })),

  // 자세마다 스타일 세트가 하나씩이다(IDE-010, 2026-09-06) — 마커 아트워크는
  // 변형에 붙고 변형은 세트에 붙으므로, 선수마다 다른 그림을 쓰려면 세트를
  // 나누는 수밖에 없다. 세트가 달라도 변형 id와 크기는 같아 슬롯끼리 바꿔
  // 끼워도 배치가 어긋나지 않는다.
  styleSets: markerStyleSets,

  slots: [
    {
      id: 'marker-style',
      kind: 'choice',
      label: '선수 마커 모양',
      options: [
        { value: 'circle', label: '빈 원' },
        { value: 'illustration', label: '선수 그림' },
        { value: 'outline', label: '선수 그림 · 색칠용' },
      ],
      // 기본은 색칠용 선수 그림이다(2026-09-06 사용자 요청). 아이가 칠하는
      // 판이라는 전제에 가장 맞는 모양이고, 자세가 있어 판이 살아 보인다.
      // 빈 원은 번호를 크게 쓰고 싶을 때 고른다.
      default: 'outline',
      placements: [{ partId: 'field', mode: 'control' }],
    },
    ...teamColorSlots,
    ...playerSlots,
  ],

  presets: Object.keys(FORMATIONS).flatMap((formationId) => {
    const home = homePositions(formationId);
    return [
      {
        id: `${formationId}-home`,
        label: `${formationId} · 홈`,
        formationId,
        groupId: 'home',
        partId: 'field',
        positions: home,
      },
      {
        id: `${formationId}-away`,
        label: `${formationId} · 원정`,
        formationId,
        groupId: 'away',
        partId: 'field',
        positions: mirrorPositions(home, BOARD.widthMm, homeToAwaySlotId),
      },
    ];
  }),
});
