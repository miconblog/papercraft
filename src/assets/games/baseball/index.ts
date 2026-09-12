/**
 * 야구 게임판 도안 (IDE-014)
 *
 * 치수는 전부 [`./dimensions.ts`](./dimensions.ts)에서 온다. 아트워크
 * (`public/games/baseball/*.svg`)도 같은 상수로 그리므로 슬롯 좌표와 그림이
 * 어긋나지 않는다 — 치수를 고칠 때는 `dimensions.ts`만 고치고
 * `npm run artwork baseball`을 돌린다.
 *
 * ## 축구 게임판과 다른 점
 *
 * 규격이 진짜 범용인지 보려고 **구조가 다른 게임**을 골랐다(`IDE-011`). 실제로
 * 세 군데가 다르다:
 *
 * 1. **그룹이 하나다.** 축구는 홈·원정이 똑같이 열한 명씩 필드에 서지만, 야구는
 *    판에 수비만 선다 — 그마저 포수를 뺀 여덟이고, 공격 쪽 마커는 없다(2026-09-08
 *    사용자 요청). 그래서 프리셋도 수비 그룹에만 있고, 마커 좌우 반전
 *    (`mirrorMarkers`)은 쓰지 않는다 — 편이 위치로 갈리므로 방향으로 가를 이유가
 *    없다.
 * 2. **프리셋이 진영이 아니라 전술이다.** 축구의 4-3-3은 팀별로 한 벌씩
 *    필요했지만(좌우 반전) 야구의 수비 시프트는 한 벌뿐이다. `formationId`를
 *    쓰지 않는 첫 게임이라, 프리셋 UI가 `label`만으로도 읽히는지 여기서 드러난다.
 * 3. **판 위에는 경기장뿐이다.** 타순표·아웃·주자 칸을 두었다가 뺐다(2026-09-08
 *    사용자 요청). 주자는 베이스 위 동전으로, 아웃은 옆에 둔 동전으로 센다 —
 *    한 타석 동안 바뀌는 값을 인쇄물이 기억할 수는 없다.
 */
import { defineGame } from '@/lib/schema';
import { RULES } from './rules';
import {
  artworkPath,
  BOARD,
  DEFENSE_POSITIONS,
  FIELDER_CIRCLE_ARTWORK_ID,
  FIELDER_POSES,
  markerArtworkId,
  PLAY_AREA,
  PLAYER_MARKER,
  poseStyleSetId,
  SHEETS,
} from './dimensions';

const FIELD_PART_ID = 'field';
const PLAY_REGION_ID = 'fair-territory';

const defenseSlotId = (positionId: string): string => `defense-${positionId}`;

/**
 * 수비 시프트 — 판에 서는 여덟 명의 좌표 한 벌.
 *
 * 순서가 `DEFENSE_POSITIONS`와 같다. 좌표는 눈으로 맞춘 뒤 마커 상자(20×22mm)가
 * 서로 닿지 않는지 확인한 값이고, 그 확인은 `parseGame`이 등록 때 다시 한다 —
 * 겹치는 시프트는 등록되는 순간 예외로 터진다.
 *
 * 야구에서 수비 위치는 **타자에 따라 바뀌는 전술**이다. 그래서 프리셋 이름이
 * 진영이 아니라 상황이다 — 번트를 대비하면 내야가 앞으로 나오고, 장타를
 * 경계하면 외야가 담장까지 물러선다. 판을 처음 열었을 때는 기본 수비다.
 */
const SHIFTS: ReadonlyArray<{
  readonly id: string;
  readonly label: string;
  /** `DEFENSE_POSITIONS` 순서대로 [x, y]. */
  readonly positions: ReadonlyArray<readonly [number, number]>;
}> = [
  {
    id: 'standard',
    label: '기본 수비',
    positions: [
      [105, 210], // 투수 — 마운드
      [158, 194], // 1루수
      [145, 144], // 2루수 — 1·2루 사이 베이스라인 뒤
      [52, 194], // 3루수
      [65, 144], // 유격수 — 2·3루 사이 베이스라인 뒤
      [35, 82], // 좌익수
      [105, 62], // 중견수
      [175, 82], // 우익수
    ],
  },
  {
    id: 'infield-in',
    label: '내야 전진',
    positions: [
      [105, 210],
      [150, 214],
      [135, 174],
      [60, 214],
      [75, 174],
      [35, 82],
      [105, 62],
      [175, 82],
    ],
  },
  {
    id: 'no-doubles',
    label: '장타 경계',
    positions: [
      [105, 210],
      [165, 184],
      [140, 149],
      [45, 184],
      [70, 149],
      [28, 55],
      [105, 38],
      [182, 55],
    ],
  },
  {
    id: 'pull-shift',
    label: '당겨치기 시프트',
    positions: [
      [105, 210],
      [162, 199],
      [150, 154],
      [62, 184],
      [112, 152],
      [60, 88],
      [125, 58],
      [185, 92],
    ],
  },
];

/** 슬롯의 기본 좌표는 기본 수비다 — 첫 화면이 곧 쓸 수 있는 배치여야 한다. */
const DEFAULT_SHIFT = SHIFTS[0];

/**
 * 등번호 슬롯의 공통 모양.
 *
 * 축구 게임판과 같이 **숫자가 아니라 글자**다. `number` 슬롯은 빈 값을 허용하지
 * 않는데 이 도안의 기본값은 비어 있어야 한다 — 아이가 종이에 직접 쓰는 자리다
 * (2026-09-05 결정). 넣고 싶은 사람은 에디터에서 넣을 수 있다.
 */
const numberSlotShape = {
  kind: 'text' as const,
  maxLength: 2,
  default: '',
  placeholder: '비움',
};

const defenseSlots = DEFENSE_POSITIONS.map((position, i) => {
  const [xMm, yMm] = DEFAULT_SHIFT.positions[i];
  return {
    ...numberSlotShape,
    // 번호는 자리 순서가 아니라 야구의 수비 번호다 — 포수(2번)가 빠져 둘이
    // 어긋난다(`./dimensions.ts`의 `DEFENSE_POSITIONS`).
    label: `${position.number}. ${position.label}`,
    id: defenseSlotId(position.id),
    groupId: 'defense',
    tags: [position.id],
    placements: [
      {
        partId: FIELD_PART_ID,
        mode: 'marker' as const,
        xMm,
        yMm,
        // 세트가 곧 자세다 — 투수는 투구, 유격수는 달리는 자세로 그려진다.
        styleSetId: poseStyleSetId(position.poseId),
        regionId: PLAY_REGION_ID,
      },
    ],
  };
});

/**
 * 마커 스타일 세트 — **자세 하나 = 세트 하나**다.
 *
 * 세 변형(`circle` · `illustration` · `outline`)을 모든 세트가 똑같이 갖는다.
 * 사용자가 고르는 것은 세트가 아니라 변형이고(`marker-style` 슬롯 하나가 모든
 * 세트를 동시에 바꾼다), 세트는 슬롯에 배정된 자세다. 스키마가 "선택 슬롯의
 * 선택지 = 변형 id 목록"을 강제하므로 세트마다 변형 구성이 같아야 한다.
 *
 * 빈 원은 자세와 무관해 **세트 전부가 파일 하나를 나눠 쓴다**. 타자 원을 따로
 * 두었다가 타자가 판에서 빠지면서 없앴다(2026-09-08) — 판에 서는 것이 수비뿐이라
 * 흑백에서 공수를 가를 표식이 필요 없다.
 */
const markerStyleSet = (pose: {
  readonly id: string;
  readonly label: string;
}) => ({
  id: poseStyleSetId(pose.id),
  label: `수비 마커 · ${pose.label}`,
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
      artwork: artworkPath(FIELDER_CIRCLE_ARTWORK_ID),
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

/**
 * 그룹은 **하나뿐**이다 — 판에 서는 것이 수비 여덟뿐이라서다(2026-09-08 포수·타자를
 * 그라운드에서 뺐다). 공격 팀 그룹과 그 색 슬롯은 마커가 없어 함께 없앴다.
 *
 * 두 팀이 색으로 갈리는 자리는 이제 판이 아니라 **선수 스탠드**다 — 윤곽선으로만
 * 뽑아 두 줄을 아이가 서로 다른 색으로 칠한다(`./artwork/stands.ts`).
 */
const TEAMS = [
  { id: 'defense', label: '수비 팀', defaultColor: '#1d4ed8' },
] as const;

/**
 * 팀 색 — 마커에만 쓴다.
 *
 * 축구 게임판과 같이 **배치가 하나도 없다**. 색은 배치가 아니라 그룹의
 * `colorSlotId`를 통해 렌더러가 읽어 가기 때문이다(`lib/customization/render.ts`의
 * `groupColorOf`). 스코어보드에 색 막대를 두지 않은 것도 같은 이유다 — 팀 이름을
 * 아이가 직접 쓰는 자리라 색이 미리 정해져 있으면 오히려 걸린다.
 */
const teamColorSlots = TEAMS.map((team) => ({
  id: `${team.id}-color`,
  kind: 'color' as const,
  label: `${team.label} 색`,
  help: '흑백으로 뽑아도 두 팀이 구분되도록 밝기 차이를 두면 좋다.',
  groupId: team.id,
  default: team.defaultColor,
  placements: [],
}));

export default defineGame({
  schemaVersion: 1,
  id: 'baseball',
  title: '야구 게임판',
  tagline: '공을 연필로 튕겨 안타와 홈런을 치는 2인용 야구',
  description:
    '야구장을 인쇄해 펼치고, 홈플레이트 위의 공을 연필로 튕겨 타격한다. ' +
    '공이 멈춘 자리가 곧 판정이다 — 2루타선 안이면 안타, 넘으면 2루타, ' +
    '홈런선 밖으로 나가면 홈런이고, 오려 세운 수비 선수에 맞으면 아웃이다. ' +
    '수비 시프트와 등번호, 팀 색을 원하는 대로 바꿔 인쇄할 수 있다.',
  players: { min: 2, max: 2 },
  supplies: ['연필', '가위', '풀(보관함용)', '공(지름 10mm쯤)', '동전 몇 개'],
  // 카탈로그(IDE-005) 썸네일 — 별도로 그리지 않고 야구장 아트워크를 그대로 쓴다.
  // 실제 인쇄될 도안을 보여주는 게 만든 아이콘보다 정직한 미리보기다.
  thumbnail: artworkPath(FIELD_PART_ID),

  rules: [...RULES],

  parts: [
    {
      id: FIELD_PART_ID,
      kind: 'board',
      title: '야구장',
      description:
        '배율 100%에서 A4를 세로로 놓은 크기다. 홈플레이트가 아래 한가운데이고 ' +
        '내야 다이아몬드가 정규 규격으로 크게 그려져 있다 — 외야 담장 쪽 귀퉁이는 ' +
        '종이 밖으로 나가고, 종이 밖으로 나간 공은 파울이다. 오리거나 접지 않는다. ' +
        '공을 반복해서 튕기고 미끄러뜨리는 면이라 조금 두꺼운 종이에 뽑으면 오래 쓴다.',
      widthMm: BOARD.widthMm,
      heightMm: BOARD.heightMm,
      orientation: 'portrait',
      // 타순표의 번호(3.4mm)가 하한을 정한다. 절반으로 줄이면 1.7mm다.
      minScale: 0.5,
      maxScale: 4,
      artwork: artworkPath(FIELD_PART_ID),
      regions: [
        {
          id: PLAY_REGION_ID,
          label: '경기장',
          rect: {
            xMm: PLAY_AREA.xMm,
            yMm: PLAY_AREA.yMm,
            widthMm: PLAY_AREA.widthMm,
            heightMm: PLAY_AREA.heightMm,
          },
        },
      ],
    },
    {
      id: 'score-sheet',
      kind: 'cutout',
      title: '스코어보드',
      description:
        '이닝마다 낸 점수를 적는 칸. 한 장에 표가 다섯 벌 있어 다섯 판을 적는다.',
      widthMm: SHEETS.scoreSheet.widthMm,
      heightMm: SHEETS.scoreSheet.heightMm,
      orientation: 'portrait',
      // 합계 열 이름(3.4mm)이 하한을 정한다.
      minScale: 0.7,
      maxScale: 2,
      marks: ['cut'],
      artwork: artworkPath('score-sheet'),
    },
    {
      // 2026-09-12 사용자 요청 — "1번부터 9번까지 선수 기록을 적을 수 있는 기록용
      // 용지". 스코어보드가 이닝별 점수라면 이쪽은 선수별 타격이다.
      id: 'roster',
      kind: 'cutout',
      title: '선수 로스터',
      description:
        '타순 1번부터 9번까지 선수 이름을 적고 타석마다 결과를 기호로 남기는 ' +
        '기록 용지. 한 사람에 타석 다섯 칸이 있고, 오른쪽 끝에서 타수·안타·타율을 ' +
        '적는다. 한 장에 표가 두 벌이라 한 경기에 양 팀을 다 적는다. 아래 타율 ' +
        '조견표에서 타수와 안타가 만나는 칸을 찾으면 나눗셈을 못 해도 타율이 나온다.',
      widthMm: SHEETS.roster.widthMm,
      heightMm: SHEETS.roster.heightMm,
      orientation: 'portrait',
      // 머리글 글자(3.2mm)가 하한을 정한다.
      minScale: 0.7,
      maxScale: 2,
      marks: ['cut'],
      artwork: artworkPath('roster'),
    },
    {
      id: 'stands',
      kind: 'buildable',
      title: '선수 스탠드',
      description:
        '오려 접어 야구장에 세우는 선수 스무 명(한 팀 열 명 — 투수부터 야수 ' +
        '여덟에 포수와 지명타자)과 선수 보관함 한 벌이 A4 가로 한 장에 있다. ' +
        '카드 가운데를 산 모양으로 한 번 접으면 혼자 선다 — 카드에는 풀도 칼도 ' +
        '탭도 쓰지 않는다. 한 면은 그 자리의 수비 자세, 반대 면은 방망이를 든 ' +
        '타자이고 타격 자세가 열 다 다르다 — 돌려 세우면 그대로 타순이 된다. ' +
        '세워야 타구가 부딪혀 아웃이 된다. 오른쪽의 큰 전개도가 보관함이다 — ' +
        '오려 접어 네 귀를 풀로 붙이면, 다 놀고 난 선수를 접은 채로 세워 일렬로 ' +
        '담아 둘 수 있다(뚜껑은 없다). 팀마다 다른 색으로 칠해 두면 공수를 바꿀 때 ' +
        '헷갈리지 않는다.',
      widthMm: SHEETS.stands.widthMm,
      heightMm: SHEETS.stands.heightMm,
      orientation: 'landscape',
      // 포지션 이름표(3mm)가 하한을 정한다.
      minScale: 0.8,
      maxScale: 2,
      // 카드는 산접기(그림이 바깥), 보관함은 골접기와 풀칠면이다.
      marks: ['cut', 'fold-mountain', 'fold-valley', 'glue'],
      // 한 장에 두 팀이 다 들어간다 — 두 벌 뽑을 이유가 없어졌다.
      defaultCopies: 1,
      artwork: artworkPath('stands'),
    },
  ],

  groups: TEAMS.map((team) => ({
    id: team.id,
    label: team.label,
    colorSlotId: `${team.id}-color`,
    // 좌우 반전은 쓰지 않는다. 축구는 두 팀이 필드에 섞여 서서 방향으로 편을
    // 갈라야 했지만, 야구는 수비만 필드에 있고 타자는 타석에 있다 — 자리가
    // 이미 편을 말한다.
  })),

  styleSets: [...FIELDER_POSES.map((pose) => markerStyleSet(pose))],

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
      // 기본은 색칠용 선수 그림이다. 아이가 칠하는 판이라는 전제에 가장 맞는
      // 모양이고, 자세가 있어 판이 살아 보인다(축구 게임판과 같은 기본값).
      default: 'outline',
      placements: [{ partId: FIELD_PART_ID, mode: 'control' }],
    },
    ...teamColorSlots,
    ...defenseSlots,
  ],

  presets: SHIFTS.map((shift) => ({
    id: shift.id,
    label: shift.label,
    groupId: 'defense',
    partId: FIELD_PART_ID,
    positions: shift.positions.map(([xMm, yMm], i) => ({
      slotId: defenseSlotId(DEFENSE_POSITIONS[i].id),
      xMm,
      yMm,
    })),
  })),
});
