/**
 * 골프 게임판 도안 (IDE-030)
 *
 * 치수와 코스는 전부 [`./dimensions.ts`](./dimensions.ts)에서 온다. 아트워크
 * (`public/games/golf/*.svg`)도 같은 상수를 읽으므로 슬롯 좌표와 그림이
 * 어긋나지 않는다 — 코스를 고칠 때는 `dimensions.ts`만 고치고
 * `npm run artwork golf`를 돌린다.
 *
 * ## 앞선 다섯 게임과 다른 점
 *
 * 1. **판이 열여덟 장이다.** 홀 하나가 A4 한 장이고(2026-09-15 사용자 요청),
 *    열여덟 장이 다 나와야 한 라운드가 된다. 보드는 정확히 1개여야 하므로
 *    나머지 열일곱을 담을 파트 종류가 필요했다 — 규격에 `sheet`가 그래서
 *    생겼다(`lib/schema/parts.ts`). 1번 홀이 보드인 것은 카탈로그 썸네일과
 *    소개 페이지가 가리킬 대표 판이 하나는 있어야 하기 때문이다.
 * 2. **판이 열여덟 장인데 그림은 함수 하나에서 나온다.** `renderHole`이
 *    `HOLES`의 홀을 받아 그린다. 판마다 손으로 그렸다면 카드 하나의 치수를
 *    고치는 데 열여덟 파일을 고쳐야 한다.
 * 3. **혼자도 넷도 친다**(`players: 1~4`). 상대를 이기는 놀이가 아니라 자기
 *    타수를 줄이는 놀이라, 인원이 늘어도 규칙이 바뀌지 않는다.
 * 4. **인쇄물이 학습지를 겸한다.** 기록표가 이 게임의 절반이다 — 홀마다 숫자를
 *    쓰고, 아홉씩 더하고, 둘을 더하고, 파를 뺀다(2026-09-15 사용자 요청).
 *
 * 마커도 배치 프리셋도 없다. 공은 종이 위를 굴러다니므로 도안이 자리를 정해 줄
 * 것이 없고, 사용자가 고치는 것은 이름 다섯 개뿐이다.
 */
import { defineGame } from '@/lib/schema';
import { RULES } from './rules';
import { CUSTOM_SLOT } from './artwork/dynamic';
import {
  BOARD,
  COURSE_PAR,
  CUSTOM_HOLE,
  CUSTOM_HOLE_DEFAULTS,
  INK,
  BALL_SHEET,
  HOLES,
  NAME_NUMBER_INSET_MM,
  PANEL,
  PLAYER_COUNT,
  PLAYER_LABELS,
  SCORE_CARD,
  artworkPath,
  holePartId,
  playerRowCenterY,
  scoreColumnEdges,
  sumColumnEdges,
  sumRowCenterY,
  sumYards,
  type HoleSpec,
} from './dimensions';

/** 홀 판 열여덟 장을 만들기 화면에서 한 묶음으로 보이게 하는 이름. */
const HOLE_SERIES = '홀 판';
const SCORE_CARD_PART_ID = 'score-card';
const BALL_PART_ID = 'balls';

/** 홀마다 성격이 하나씩 다르다 — 소개 페이지의 구성 목록이 이 줄을 읽는다. */
function holeDescription(hole: HoleSpec): string {
  const hazards: string[] = [];
  if (hole.ponds.length > 0 || hole.streams.length > 0) {
    hazards.push('물을 건너거나 비켜 가야 한다');
  }
  if (hole.bunkers.length >= 3) hazards.push('벙커가 여럿이라 길이 좁다');
  else if (hole.bunkers.length > 0) hazards.push('그린 둘레에 벙커가 있다');
  return (
    `파 ${hole.par} · ${hole.yards}야드. 아래 티에서 위 그린의 홀까지 공을 튕겨 간다. ` +
    `종이 전체가 코스이고 점선 밖은 O.B.다.${hazards.length > 0 ? ` ${hazards.join('. ')}.` : ''} ` +
    '오리거나 접지 않는다.'
  );
}

/**
 * 홀 판 열여덟 장. **첫 장만 보드**이고 나머지는 낱장(`sheet`)이다.
 *
 * 배율 하한 0.8은 홀 정보 카드의 타수 줄(3mm)이 정한다 — 그 아래로 내려가면
 * "3타 버디"가 읽히지 않는다. ⚠︎ 실물 출력으로 재확인이 필요하다.
 */
const holeParts = HOLES.map((hole, index) => ({
  id: holePartId(hole.number),
  kind: (index === 0 ? 'board' : 'sheet') as 'board' | 'sheet',
  // 열여덟 장이 만들기 화면에서 셀렉트 하나로 접힌다(2026-09-15 사용자 요청).
  // 인쇄는 그대로 파트마다 한 줄이라 한 번에 다 뽑을 수 있다.
  series: HOLE_SERIES,
  title: `${hole.number}번 홀 · ${hole.name} (파 ${hole.par})`,
  description: holeDescription(hole),
  widthMm: BOARD.widthMm,
  heightMm: BOARD.heightMm,
  orientation: 'portrait' as const,
  minScale: 0.8,
  maxScale: 3,
  artwork: artworkPath(holePartId(hole.number)),
}));

/**
 * 코스 이름이 홀 판마다 한 번씩, 기록표에 한 번 앉는다.
 *
 * 홀 판에서는 **카드 안**이다(2026-09-15). 카드가 홀마다 다른 자리에 앉으므로
 * 좌표도 홀마다 다르다 — `hole.panel`을 읽어 그 안의 같은 자리를 가리킨다.
 */
const courseNamePlacements = [
  ...HOLES.map((hole) => ({
    partId: holePartId(hole.number),
    mode: 'text' as const,
    xMm: hole.panel[0] + PANEL.widthMm / 2,
    yMm: hole.panel[1] + PANEL.courseNameYMm,
    align: 'center' as const,
    fontSizeMm: PANEL.courseNameFontMm,
    maxWidthMm: PANEL.courseNameMaxWidthMm,
  })),
  {
    partId: SCORE_CARD_PART_ID,
    mode: 'text' as const,
    xMm: SCORE_CARD.courseNameXMm,
    yMm: SCORE_CARD.courseNameYMm,
    align: 'end' as const,
    fontSizeMm: SCORE_CARD.courseNameFontMm,
    maxWidthMm: SCORE_CARD.courseNameMaxWidthMm,
  },
];

const tableEdges = scoreColumnEdges();
const sumEdges = sumColumnEdges();
/** 이름 칸의 가로 중심과 폭 — 왼쪽 끝의 줄 번호를 비켜 앉는다. */
const nameSpot = (left: number, right: number) => ({
  xMm: (left + NAME_NUMBER_INSET_MM + right) / 2,
  maxWidthMm: right - left - NAME_NUMBER_INSET_MM - 2,
});
const tableName = nameSpot(tableEdges[0], tableEdges[1]);
const sumName = nameSpot(sumEdges[0], sumEdges[1]);

/**
 * 사람 넷의 이름 슬롯. **기록표에만** 나타난다 — 홀 판에는 이름이 들어갈
 * 자리도, 들어가야 할 이유도 없다.
 *
 * 기본값은 비어 있다. 아이가 종이에 직접 쓰는 자리이기 때문이고(축구 게임판의
 * 등번호와 같은 규칙, 2026-09-05), 그래서 표의 이름 칸은 비어 있어도 줄 번호
 * 1·2·3·4로 자기 줄을 찾을 수 있게 그렸다.
 */
const playerSlots = Array.from({ length: PLAYER_COUNT }, (_, i) => ({
  id: `player-${i + 1}`,
  kind: 'text' as const,
  label: PLAYER_LABELS[i],
  help:
    i === 0
      ? '기록표의 세 표에 같은 이름이 찍힌다. 비워 두면 아이가 직접 쓴다.'
      : undefined,
  maxLength: 5,
  default: '',
  placeholder: '비움',
  placements: [
    {
      partId: SCORE_CARD_PART_ID,
      mode: 'text' as const,
      xMm: tableName.xMm,
      yMm: playerRowCenterY(SCORE_CARD.outTableYMm, i),
      align: 'center' as const,
      fontSizeMm: SCORE_CARD.labelFontMm,
      maxWidthMm: tableName.maxWidthMm,
    },
    {
      partId: SCORE_CARD_PART_ID,
      mode: 'text' as const,
      xMm: tableName.xMm,
      yMm: playerRowCenterY(SCORE_CARD.inTableYMm, i),
      align: 'center' as const,
      fontSizeMm: SCORE_CARD.labelFontMm,
      maxWidthMm: tableName.maxWidthMm,
    },
    {
      partId: SCORE_CARD_PART_ID,
      mode: 'text' as const,
      xMm: sumName.xMm,
      yMm: sumRowCenterY(i),
      align: 'center' as const,
      fontSizeMm: SCORE_CARD.sumFontMm,
      maxWidthMm: sumName.maxWidthMm,
    },
  ],
}));

/**
 * 나만의 홀의 슬롯 — **판 위에서 끄는 점 넷**과 **칸에 적는 값 넷** (IDE-031).
 *
 * 점 슬롯(`points`)이 이 게임에서 처음 쓰인다. 길·벙커·연못·카드 자리가 모두
 * 판 위의 손잡이이고, 사용자가 끌면 그 값에서 판이 다시 그려진다. 상자는
 * 슬롯마다 다르다 — 길은 페어웨이 반폭만큼 안쪽, 카드는 카드 크기만큼 안쪽이다.
 */
const customSlots = [
  {
    id: CUSTOM_SLOT.number,
    kind: 'number' as const,
    label: '홀 번호',
    help: '카드에 크게 찍힌다. 만든 홀로 그 번호의 홀을 바꿔 쳐도 된다.',
    min: 1,
    max: 18,
    integer: true,
    default: CUSTOM_HOLE_DEFAULTS.number,
    placements: [{ partId: CUSTOM_HOLE.partId, mode: 'control' as const }],
  },
  {
    id: CUSTOM_SLOT.name,
    kind: 'text' as const,
    label: '홀 이름',
    maxLength: 8,
    default: CUSTOM_HOLE_DEFAULTS.name,
    placeholder: '나만의 홀',
    placements: [{ partId: CUSTOM_HOLE.partId, mode: 'control' as const }],
  },
  {
    id: CUSTOM_SLOT.par,
    kind: 'number' as const,
    label: '파',
    help: '카드의 타수 이름이 이 값에서 나온다 — 파 4면 3타가 버디다.',
    min: 3,
    max: 5,
    integer: true,
    default: CUSTOM_HOLE_DEFAULTS.par,
    presets: [
      { value: 3, label: '파 3', help: '한 번에 그린까지 가는 짧은 홀' },
      { value: 4, label: '파 4', help: '가장 흔한 길이' },
      { value: 5, label: '파 5', help: '두 번 쳐야 그린이 보이는 긴 홀' },
    ],
    placements: [{ partId: CUSTOM_HOLE.partId, mode: 'control' as const }],
  },
  {
    id: CUSTOM_SLOT.width,
    kind: 'number' as const,
    label: '페어웨이 폭(mm)',
    help: '좁을수록 어렵다. 거리는 길 길이에서 저절로 나온다.',
    min: CUSTOM_HOLE.widthRangeMm.min,
    max: CUSTOM_HOLE.widthRangeMm.max,
    integer: true,
    default: CUSTOM_HOLE_DEFAULTS.fairwayWidthMm,
    presets: [
      { value: 38, label: '좁게' },
      { value: 48, label: '보통' },
      { value: 58, label: '넓게' },
    ],
    placements: [{ partId: CUSTOM_HOLE.partId, mode: 'control' as const }],
  },
  {
    id: CUSTOM_SLOT.path,
    kind: 'points' as const,
    label: '길 — 티에서 그린까지',
    help: '첫 점이 티, 마지막 점이 그린이다. 가운데 점을 늘리면 굽은 홀이 된다.',
    box: { partId: CUSTOM_HOLE.partId, ...CUSTOM_HOLE.pathBox },
    min: 2,
    max: 5,
    handle: { color: INK.fairwayStroke, radiusMm: 4, noun: '길목' },
    default: [...CUSTOM_HOLE_DEFAULTS.path],
    placements: [{ partId: CUSTOM_HOLE.partId, mode: 'control' as const }],
  },
  {
    id: CUSTOM_SLOT.bunkers,
    kind: 'points' as const,
    label: '벙커',
    box: { partId: CUSTOM_HOLE.partId, ...CUSTOM_HOLE.hazardBox },
    min: 0,
    max: 6,
    handle: { color: INK.bunkerStroke, radiusMm: 3.5, noun: '벙커' },
    default: [...CUSTOM_HOLE_DEFAULTS.bunkers],
    placements: [{ partId: CUSTOM_HOLE.partId, mode: 'control' as const }],
  },
  {
    id: CUSTOM_SLOT.ponds,
    kind: 'points' as const,
    label: '연못',
    box: { partId: CUSTOM_HOLE.partId, ...CUSTOM_HOLE.hazardBox },
    min: 0,
    max: 3,
    handle: { color: INK.waterStroke, radiusMm: 3.5, noun: '연못' },
    default: [...CUSTOM_HOLE_DEFAULTS.ponds],
    placements: [{ partId: CUSTOM_HOLE.partId, mode: 'control' as const }],
  },
  {
    id: CUSTOM_SLOT.card,
    kind: 'points' as const,
    label: '홀 정보 카드 자리',
    help: '카드의 왼쪽 위 모서리다. 코스를 가리지 않는 빈 자리로 끈다.',
    box: { partId: CUSTOM_HOLE.partId, ...CUSTOM_HOLE.cardBox },
    min: 1,
    max: 1,
    handle: { color: '#6b7280', radiusMm: 3.5, noun: '카드' },
    default: [...CUSTOM_HOLE_DEFAULTS.card],
    placements: [{ partId: CUSTOM_HOLE.partId, mode: 'control' as const }],
  },
];

export default defineGame({
  schemaVersion: 1,
  id: 'golf',
  title: '골프 게임판',
  tagline: '연필로 공을 튕겨 18홀을 도는, 기록하며 더하는 골프',
  description:
    '홀 하나가 A4 한 장이다. 열여덟 장을 차례로 펼쳐 놓고, 판 아래 티에 놓은 ' +
    '공을 연필로 튕겨 위쪽 그린의 홀에 넣는다. 한 번 튕기면 1타이고, 벙커와 ' +
    '물과 O.B.에는 벌타가 붙는다. 홀마다 친 횟수를 기록표에 적고, 아홉 홀씩 ' +
    '더해 전반(OUT)과 후반(IN)을 내고, 둘을 더해 총타수를 낸다. 거기서 코스 ' +
    `파 ${COURSE_PAR}를 빼면 오늘의 성적이다 — 숫자를 쓰고 더하고 빼는 일이 ` +
    '놀이 안에 들어 있다. 파·버디·이글 같은 점수의 이름은 실제 골프와 같고, ' +
    '홀 판마다 얹힌 카드에 이 홀에서 몇 타가 무엇인지 적혀 있다. 혼자 쳐도 되고 ' +
    '넷이 ' +
    '함께 쳐도 된다.',
  players: { min: 1, max: 4 },
  supplies: ['연필', '가위', '두꺼운 종이(공을 오릴 것)'],
  // 카탈로그 썸네일은 1번 홀이다 — 만들어 낸 아이콘보다 실제로 인쇄될 판이
  // 정직한 미리보기다(축구·야구와 같은 선택).
  thumbnail: artworkPath(holePartId(1)),

  rules: [...RULES],

  parts: [
    ...holeParts,
    {
      id: CUSTOM_HOLE.partId,
      kind: 'sheet',
      // 홀 판과 같은 묶음이다 — 만들기 화면의 홀 셀렉트 맨 끝에 붙는다.
      series: HOLE_SERIES,
      title: '나만의 홀',
      description:
        '판 위에서 직접 짓는 홀 한 장. 티와 그린을 잇는 길목, 벙커, 연못, 홀 ' +
        '정보 카드 자리를 손잡이로 끌어 옮기면 그 값으로 판이 다시 그려진다. ' +
        '거리는 길 길이에서 저절로 나온다. 값을 바꿔 여러 번 뽑으면 서로 다른 ' +
        '홀이 여러 장 된다. 오리거나 접지 않는다.',
      widthMm: BOARD.widthMm,
      heightMm: BOARD.heightMm,
      orientation: 'portrait',
      minScale: 0.8,
      maxScale: 3,
      artwork: artworkPath(CUSTOM_HOLE.partId),
      // 크기는 고정이고 그림만 값에서 나온다 — 점 잇기 판과 같은 쓰임이다.
      dynamic: {},
    },
    {
      id: SCORE_CARD_PART_ID,
      kind: 'sheet',
      title: '기록표',
      description:
        'A4 가로 한 장. 전반 아홉 홀과 후반 아홉 홀의 표가 따로 있고, 아래에 ' +
        '둘을 더하는 합산 칸이 있다. 파와 거리는 인쇄되어 있고 타수와 이름은 ' +
        `비어 있다 — 아이가 직접 쓴다. 코스 파는 ${COURSE_PAR}다. 오리거나 접지 않는다.`,
      widthMm: SCORE_CARD.widthMm,
      heightMm: SCORE_CARD.heightMm,
      orientation: 'landscape',
      // 거리 줄(3mm)이 하한을 정한다. ⚠︎ 실물 출력으로 재확인이 필요하다.
      minScale: 0.85,
      maxScale: 2,
      artwork: artworkPath(SCORE_CARD_PART_ID),
    },
    {
      id: BALL_PART_ID,
      kind: 'cutout',
      title: '공',
      description:
        '오려 쓰는 공 열여섯 개. 지름 12mm라 홀 원(지름 16mm)에 닿아 멈추면 ' +
        '들어간 것이다. 두꺼운 종이에 뽑으면 연필로 튕겼을 때 더 잘 미끄러진다. ' +
        '잃어버리기 쉬워 기본 두 벌이다. ' +
        '깃대는 두지 않는다 — 홀이 어디인지는 판에 그린 깃발이 알린다.',
      widthMm: BALL_SHEET.widthMm,
      heightMm: BALL_SHEET.heightMm,
      // 정사각 시트다. 규격은 `widthMm >= heightMm`를 가로로 읽으므로
      // 정사각은 landscape다(윷놀이 말판과 같다).
      orientation: 'landscape',
      minScale: 0.8,
      maxScale: 2,
      defaultCopies: 2,
      marks: ['cut'],
      artwork: artworkPath(BALL_PART_ID),
    },
  ],

  slots: [
    {
      id: 'course-name',
      kind: 'text',
      label: '코스 이름',
      help: '홀 판 열여덟 장과 기록표에 함께 찍힌다. 비워 두면 아무것도 인쇄되지 않는다.',
      maxLength: 14,
      default: '',
      placeholder: '우리 골프장',
      placements: courseNamePlacements,
    },
    ...playerSlots,
    ...customSlots,
  ],
});

/** 코스 전체 거리. 소개 페이지와 테스트가 쓴다. */
export const COURSE_YARDS = sumYards(HOLES);
