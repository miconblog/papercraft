/**
 * 축구 게임판 — 도안 규격의 예시 인스턴스 (IDE-003)
 *
 * 규격이 실제 게임을 표현할 수 있는지 확인하려고 먼저 쓴 도안이다. 여기 있는
 * 치수와 좌표는 **규격 검증용 초안**이고, 실제 작도값은 IDE-004(필드·부속)와
 * IDE-010(마커·대형)이 실측으로 확정한다. 아트워크(SVG) 경로도 그때 채운다.
 *
 * 좌표는 파트 로컬 mm, 원점은 좌상단이다.
 */
import { defineGame, mirrorPositions, type SlotPosition } from '@/lib/schema';

/** 운동장은 배율 100%에서 A4를 가로로 놓은 크기다(IDE-002). */
const FIELD_WIDTH_MM = 297;
const FIELD_HEIGHT_MM = 210;
/** 터치라인과 종이 가장자리 사이. 선수 마커는 이 안쪽에만 놓인다. */
const FIELD_INSET_MM = 8;
const HALF_WIDTH_MM = FIELD_WIDTH_MM / 2 - FIELD_INSET_MM;

const TEAMS = [
  {
    id: 'home',
    label: '홈 팀',
    defaultName: '파랑 팀',
    defaultColor: '#1d4ed8',
  },
  {
    id: 'away',
    label: '원정 팀',
    defaultName: '빨강 팀',
    defaultColor: '#dc2626',
  },
] as const;

/**
 * 홈 진영 기준 대형 좌표. 배열 순서가 선수 슬롯 1–11번이고, 1번은 골키퍼다.
 * 원정 진영은 세로 중심선 기준으로 뒤집어 쓴다.
 */
const FORMATIONS: Record<string, ReadonlyArray<readonly [number, number]>> = {
  '4-4-2': [
    [18, 105],
    [48, 45],
    [48, 85],
    [48, 125],
    [48, 165],
    [88, 45],
    [88, 85],
    [88, 125],
    [88, 165],
    [125, 85],
    [125, 125],
  ],
  '3-5-2': [
    [18, 105],
    [48, 60],
    [48, 105],
    [48, 150],
    [88, 35],
    [88, 70],
    [88, 105],
    [88, 140],
    [88, 175],
    [125, 85],
    [125, 125],
  ],
};

/** 슬롯의 기본 좌표는 4-4-2 배치다 — 첫 화면이 곧 쓸 수 있는 배치여야 한다. */
const DEFAULT_FORMATION = '4-4-2';

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
          FIELD_WIDTH_MM,
          homeToAwaySlotId,
        );

  return positions.map((pos, i) => ({
    id: pos.slotId,
    kind: 'number' as const,
    label: `${team.label} ${i + 1}번`,
    help: i === 0 ? '골키퍼 자리다.' : undefined,
    groupId: team.id,
    tags: i === 0 ? ['goalkeeper'] : [],
    min: 1,
    max: 99,
    integer: true,
    default: i + 1,
    placements: [
      {
        partId: 'field',
        mode: 'marker' as const,
        xMm: pos.xMm,
        yMm: pos.yMm,
        styleSetId: 'player-marker',
        regionId: 'playable-field',
      },
    ],
  }));
});

const teamNameSlots = TEAMS.map((team, i) => ({
  id: `${team.id}-name`,
  kind: 'text' as const,
  label: `${team.label} 이름`,
  groupId: team.id,
  maxLength: 12,
  default: team.defaultName,
  placeholder: '팀 이름',
  placements: [
    // 보드와 점수 기록칸 양쪽에 나온다 — 슬롯 하나가 여러 파트에 놓이는 경우다.
    {
      partId: 'field',
      mode: 'text' as const,
      xMm: i === 0 ? 74 : 223,
      yMm: 16,
      align: 'center' as const,
      fontSizeMm: 7,
      maxWidthMm: 60,
    },
    {
      partId: 'score-sheet',
      mode: 'text' as const,
      xMm: i === 0 ? 52.5 : 157.5,
      yMm: 20,
      align: 'center' as const,
      fontSizeMm: 5,
      maxWidthMm: 80,
    },
  ],
}));

const teamColorSlots = TEAMS.map((team) => ({
  id: `${team.id}-color`,
  kind: 'color' as const,
  label: `${team.label} 색`,
  help: '흑백으로 뽑아도 두 팀이 구분되도록 밝기 차이를 두면 좋다.',
  groupId: team.id,
  default: team.defaultColor,
  placements: [
    {
      partId: 'field',
      mode: 'paint' as const,
      layerId: `pc-team-${team.id}`,
      property: 'fill' as const,
    },
    {
      partId: 'score-sheet',
      mode: 'paint' as const,
      layerId: `pc-team-${team.id}`,
      property: 'fill' as const,
    },
  ],
}));

export default defineGame({
  schemaVersion: 1,
  id: 'soccer',
  title: '축구 게임판',
  tagline: '종이 공을 연필로 튕겨 상대 골대에 넣는 2인용 축구',
  description:
    '운동장을 인쇄해 펼치고, 선수 마커 위의 종이 공을 연필로 튕겨 패스와 슛을 한다. ' +
    '골대는 오려 접어 세우고, 점수는 함께 뽑은 기록칸에 적는다. 등번호와 팀 이름·색, ' +
    '선수 배치를 원하는 대로 바꿔 인쇄할 수 있다.',
  players: { min: 2, max: 2 },
  supplies: ['연필', '가위', '풀'],
  thumbnail: '/games/soccer/thumbnail.png',

  parts: [
    {
      id: 'field',
      kind: 'board',
      title: '운동장',
      description:
        '배율 100%에서 A4를 가로로 놓은 크기다. 오리거나 접지 않는다.',
      widthMm: FIELD_WIDTH_MM,
      heightMm: FIELD_HEIGHT_MM,
      orientation: 'landscape',
      minScale: 0.5,
      maxScale: 4,
      regions: [
        {
          id: 'playable-field',
          label: '필드',
          rect: {
            xMm: FIELD_INSET_MM,
            yMm: FIELD_INSET_MM,
            widthMm: FIELD_WIDTH_MM - FIELD_INSET_MM * 2,
            heightMm: FIELD_HEIGHT_MM - FIELD_INSET_MM * 2,
          },
        },
        {
          id: 'home-half',
          label: '홈 진영',
          rect: {
            xMm: FIELD_INSET_MM,
            yMm: FIELD_INSET_MM,
            widthMm: HALF_WIDTH_MM,
            heightMm: FIELD_HEIGHT_MM - FIELD_INSET_MM * 2,
          },
        },
        {
          id: 'away-half',
          label: '원정 진영',
          rect: {
            xMm: FIELD_WIDTH_MM / 2,
            yMm: FIELD_INSET_MM,
            widthMm: HALF_WIDTH_MM,
            heightMm: FIELD_HEIGHT_MM - FIELD_INSET_MM * 2,
          },
        },
      ],
    },
    {
      id: 'score-sheet',
      kind: 'cutout',
      title: '점수 기록칸',
      description: '여러 판을 이어 적는 칸. 오려서 옆에 두고 쓴다.',
      widthMm: 210,
      heightMm: 148.5,
      orientation: 'landscape',
      minScale: 0.7,
      maxScale: 2,
      marks: ['cut'],
    },
    {
      id: 'rules-card',
      kind: 'cutout',
      title: '게임 방법',
      description: '기본 규칙과 하우스 룰 안내. 오려서 상자에 넣어 둔다.',
      widthMm: 148.5,
      heightMm: 210,
      orientation: 'portrait',
      // 규칙 텍스트가 들어가므로 보드보다 축소 하한이 높다. 실측은 IDE-004에서 한다.
      minScale: 0.8,
      maxScale: 2,
      marks: ['cut'],
    },
    {
      id: 'goals',
      kind: 'buildable',
      title: '골대 전개도',
      description: '오려 접어 세우는 입체 골대 2개.',
      widthMm: 210,
      heightMm: 297,
      orientation: 'portrait',
      minScale: 0.8,
      maxScale: 2,
      marks: ['cut', 'fold-mountain', 'fold-valley', 'glue'],
    },
    {
      id: 'ball-markers',
      kind: 'cutout',
      title: '공 마커',
      description:
        '연필로 튕기는 납작한 종이 공. 잃어버릴 때를 대비해 여러 개 뽑는다.',
      widthMm: 105,
      heightMm: 74,
      orientation: 'landscape',
      minScale: 0.9,
      maxScale: 2,
      defaultCopies: 2,
      marks: ['cut'],
    },
  ],

  groups: TEAMS.map((team) => ({
    id: team.id,
    label: team.label,
    nameSlotId: `${team.id}-name`,
    colorSlotId: `${team.id}-color`,
  })),

  styleSets: [
    {
      id: 'player-marker',
      label: '선수 마커',
      selectorSlotId: 'marker-style',
      variants: [
        {
          id: 'circle',
          label: '원 + 등번호',
          widthMm: 12,
          heightMm: 12,
          valueFontSizeMm: 5,
        },
        {
          id: 'illustration',
          label: '선수 일러스트',
          widthMm: 13,
          heightMm: 16,
          valueFontSizeMm: 4,
        },
      ],
    },
  ],

  slots: [
    {
      id: 'marker-style',
      kind: 'choice',
      label: '선수 마커 모양',
      options: [
        { value: 'circle', label: '원 + 등번호' },
        { value: 'illustration', label: '선수 일러스트' },
      ],
      default: 'circle',
      placements: [{ partId: 'field', mode: 'control' }],
    },
    ...teamNameSlots,
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
        positions: mirrorPositions(home, FIELD_WIDTH_MM, homeToAwaySlotId),
      },
    ];
  }),
});
