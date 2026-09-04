/**
 * 축구 게임판 도안 (IDE-004)
 *
 * 치수는 전부 [`./dimensions.ts`](./dimensions.ts)에서 온다. 아트워크
 * (`public/games/soccer/*.svg`)도 같은 상수로 그리므로 슬롯 좌표와 그림이
 * 어긋나지 않는다 — 치수를 고칠 때는 `dimensions.ts`만 고치고
 * `npm run artwork`를 돌린다.
 *
 * 선수 마커 아트워크와 전술 대형 프리셋의 확정은 `IDE-010`이 한다. 여기 있는
 * 4-4-2·3-5-2 좌표는 규격이 도는지 보이는 출발점이다.
 */
import { defineGame, mirrorPositions, type SlotPosition } from '@/lib/schema';
import {
  artworkPath,
  BALL,
  BALL_COUNT,
  BOARD,
  BOARD_TEAM_NAME,
  FIELD,
  SHEETS,
  SCORE_TABLE,
  SCORE_TEAM_NAME_Y_MM,
  boardTeamNameXMm,
  scoreTeamColumnCenterXMm,
} from './dimensions';

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
 *
 * 골키퍼의 x는 골대 자리(골라인에서 안쪽 `GOAL.depthMm`)를 피한다 — 마커가 그
 * 위에 서면 종이 골대를 놓을 자리가 없다.
 */
const FORMATIONS: Record<string, ReadonlyArray<readonly [number, number]>> = {
  '4-4-2': [
    [32, 105],
    [52, 48],
    [52, 87],
    [52, 123],
    [52, 162],
    [90, 48],
    [90, 87],
    [90, 123],
    [90, 162],
    [126, 87],
    [126, 123],
  ],
  '3-5-2': [
    [32, 105],
    [52, 62],
    [52, 105],
    [52, 148],
    [90, 38],
    [90, 72],
    [90, 105],
    [90, 138],
    [90, 172],
    [126, 87],
    [126, 123],
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
          BOARD.widthMm,
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
      xMm: boardTeamNameXMm(i as 0 | 1),
      yMm: BOARD_TEAM_NAME.yMm,
      align: 'center' as const,
      fontSizeMm: BOARD_TEAM_NAME.fontSizeMm,
      maxWidthMm: BOARD_TEAM_NAME.maxWidthMm,
    },
    {
      partId: 'score-sheet',
      mode: 'text' as const,
      xMm: scoreTeamColumnCenterXMm(i as 0 | 1),
      yMm: SCORE_TEAM_NAME_Y_MM,
      align: 'center' as const,
      fontSizeMm: 5,
      maxWidthMm: SCORE_TABLE.teamColumnMm - 6,
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
      id: 'rules-card',
      kind: 'cutout',
      title: '게임 방법',
      description: '기본 규칙과 하우스 룰 안내. 오려서 상자에 넣어 둔다.',
      widthMm: SHEETS.rulesCard.widthMm,
      heightMm: SHEETS.rulesCard.heightMm,
      orientation: 'portrait',
      // 규칙 본문이 3mm라 다른 부속보다 하한이 높다.
      minScale: 0.85,
      maxScale: 2,
      marks: ['cut'],
      artwork: artworkPath('rules-card'),
    },
    {
      id: 'goals',
      kind: 'buildable',
      title: '골대 전개도',
      description:
        '오려 접어 세우는 입체 골대 2개. 바닥이 없어 공이 턱에 걸리지 않는다. ' +
        '공 마커와 같은 배율로 뽑아야 입구와 공의 크기가 맞는다.',
      widthMm: SHEETS.goals.widthMm,
      heightMm: SHEETS.goals.heightMm,
      orientation: 'landscape',
      minScale: 0.8,
      maxScale: 2,
      // 접는선은 전부 산접기다 — 인쇄면이 골대 바깥을 향한다.
      marks: ['cut', 'fold-mountain', 'glue'],
      artwork: artworkPath('goals'),
    },
    {
      id: 'ball-markers',
      kind: 'cutout',
      title: '공 마커',
      description:
        `연필로 튕기는 납작한 종이 공. 지름 ${BALL.diameterMm}mm짜리 ${BALL_COUNT}개가 한 시트에 있다. ` +
        '골대 전개도와 같은 배율로 뽑는다.',
      widthMm: SHEETS.ballMarkers.widthMm,
      heightMm: SHEETS.ballMarkers.heightMm,
      orientation: 'landscape',
      // 공은 글자가 아니라 골대 입구와의 크기 관계가 하한을 정한다.
      minScale: 0.8,
      maxScale: 2,
      defaultCopies: 2,
      marks: ['cut'],
      artwork: artworkPath('ball-markers'),
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
        positions: mirrorPositions(home, BOARD.widthMm, homeToAwaySlotId),
      },
    ];
  }),
});
