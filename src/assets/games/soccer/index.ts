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
import {
  artworkPath,
  BALL,
  BALL_COUNT,
  BOARD,
  FIELD,
  FORMATION_LANES,
  PLAYER_MARKER,
  SHEETS,
  SCORE_TABLE,
  SCORE_TEAM_NAME_Y_MM,
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
 * 대형 좌표 — **홈 팀이 필드 전체에 서는 배치**다. 배열 순서가 선수 슬롯
 * 1–11번이고, 1번은 골키퍼다. 원정은 `mirrorPositions`로 좌우 반전해 쓴다.
 *
 * 처음에는 두 팀을 각자 진영 절반에 세웠는데 **그러면 경기가 성립하지 않았다.**
 * 선수 마커는 운동장에 인쇄되어 움직이지 않고, 규칙은 패스가 자기 팀 선수에게
 * 닿아야 이어지고 슛도 공이 자기 팀 선수 위에 있을 때만 되게 되어 있다. 상대
 * 골대 쪽에 자기 팀 선수가 하나도 없으면 공을 앞으로 보낼 방법이 없다 —
 * 홈 팀의 최전방이 x=130이고 상대 골대가 x=273부터라 한 번에 143mm를 튕겨야
 * 슛이 됐다. 그래서 두 팀이 **번갈아 서도록** 다시 잡았다(2026-09-05).
 *
 * x는 `FORMATION_LANES`의 다섯 값만 쓴다. 원정이 그 사이사이에 들어와도
 * 겹치지 않는다는 것이 레인을 상수로 둔 이유다 — `dimensions.ts` 참고.
 * y는 대형마다 다르되 같은 레인 안에서 충분히 벌린다.
 */
const {
  goalkeeper: GK,
  defence: DF,
  midfield: MF,
  attackingMidfield: AM,
  forward: FW,
} = FORMATION_LANES;

const FORMATIONS: Record<string, ReadonlyArray<readonly [number, number]>> = {
  '4-4-2': [
    [GK, 105],
    [DF, 35],
    [DF, 82],
    [DF, 128],
    [DF, 175],
    [MF, 35],
    [MF, 82],
    [MF, 128],
    [MF, 175],
    [FW, 82],
    [FW, 128],
  ],
  '3-5-2': [
    [GK, 105],
    [DF, 55],
    [DF, 105],
    [DF, 155],
    [MF, 30],
    [MF, 67],
    [MF, 105],
    [MF, 143],
    [MF, 180],
    [FW, 82],
    [FW, 128],
  ],
  '4-3-3': [
    [GK, 105],
    [DF, 35],
    [DF, 82],
    [DF, 128],
    [DF, 175],
    [MF, 58],
    [MF, 105],
    [MF, 152],
    [FW, 52],
    [FW, 105],
    [FW, 158],
  ],
  '4-2-3-1': [
    [GK, 105],
    [DF, 35],
    [DF, 82],
    [DF, 128],
    [DF, 175],
    [MF, 78],
    [MF, 132],
    [AM, 48],
    [AM, 105],
    [AM, 162],
    [FW, 105],
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
        // 골키퍼는 별도 스타일 세트를 쓴다 — 필드 선수와 크기는 같고
        // 실루엣만 다르다(안쪽 테). 흑백에서도 역할이 구분되는 이유다.
        styleSetId: i === 0 ? 'goalkeeper-marker' : 'player-marker',
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
  // 점수 기록칸에만 나온다. 운동장에서는 뺐다 — 팀 이름 띠가 놀 면을 좁혔고,
  // 어느 팀이 어느 쪽인지는 마커 색과 화살표 방향이 이미 말해 준다(2026-09-05).
  placements: [
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
  // 운동장에는 팀 색 막대를 두지 않는다(2026-09-05) — 선수 마커가 이미 팀 색으로
  // 칠해지므로 띠를 하나 더 그릴 이유가 없었다.
  placements: [
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
  // 카탈로그(IDE-005) 썸네일 — 별도로 그리지 않고 운동장 아트워크를 그대로 쓴다.
  // 실제 인쇄될 도안을 보여주는 게 만든 아이콘보다 정직한 미리보기다.
  thumbnail: artworkPath('field'),

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
    // 원정은 왼쪽 골대로 공격한다 — 마커의 화살촉이 그쪽을 가리키게 뒤집는다.
    // 두 팀이 필드 전체에 섞여 서기 때문에 위치로는 팀을 알 수 없고, 흑백으로
    // 뽑으면 팀 색도 구분되지 않을 수 있다(IDE-010).
    mirrorMarkers: team.id === 'away',
  })),

  // 필드 선수·골키퍼가 스타일 세트를 따로 쓴다(IDE-010) — 크기는 같고 실루엣만
  // 다르다. 두 세트 다 같은 `marker-style` 슬롯으로 원형·일러스트를 고른다.
  styleSets: [
    {
      id: 'player-marker',
      label: '선수 마커',
      selectorSlotId: 'marker-style',
      variants: [
        {
          id: 'circle',
          label: '원 + 등번호',
          widthMm: PLAYER_MARKER.circle.widthMm,
          heightMm: PLAYER_MARKER.circle.heightMm,
          valueFontSizeMm: PLAYER_MARKER.circle.valueFontSizeMm,
          artwork: artworkPath('player-marker-circle'),
        },
        {
          id: 'illustration',
          label: '선수 일러스트',
          widthMm: PLAYER_MARKER.illustration.widthMm,
          heightMm: PLAYER_MARKER.illustration.heightMm,
          valueFontSizeMm: PLAYER_MARKER.illustration.valueFontSizeMm,
          artwork: artworkPath('player-marker-illustration'),
        },
      ],
    },
    {
      id: 'goalkeeper-marker',
      label: '골키퍼 마커',
      selectorSlotId: 'marker-style',
      variants: [
        {
          id: 'circle',
          label: '원 + 등번호',
          widthMm: PLAYER_MARKER.circle.widthMm,
          heightMm: PLAYER_MARKER.circle.heightMm,
          valueFontSizeMm: PLAYER_MARKER.circle.valueFontSizeMm,
          artwork: artworkPath('goalkeeper-marker-circle'),
        },
        {
          id: 'illustration',
          label: '선수 일러스트',
          widthMm: PLAYER_MARKER.illustration.widthMm,
          heightMm: PLAYER_MARKER.illustration.heightMm,
          valueFontSizeMm: PLAYER_MARKER.illustration.valueFontSizeMm,
          artwork: artworkPath('goalkeeper-marker-illustration'),
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
