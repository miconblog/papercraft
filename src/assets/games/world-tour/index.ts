/**
 * 세계일주 주사위놀이 도안 (IDE-015)
 *
 * 치수는 [`./dimensions.ts`](./dimensions.ts), 도시와 경로는
 * [`./cities.ts`](./cities.ts)에서 온다. 아트워크(`public/games/world-tour/*.svg`)도
 * 같은 상수로 그린다 — `npm run artwork world-tour`.
 *
 * ## 축구·야구와 다른 점
 *
 * `IDE-011`이 찾던 "칸을 이동하는 주사위판"이다. **마커 슬롯이 하나도 없다** —
 * 말은 놀이 중에 움직이는 물건이라 인쇄물이 자리를 기억할 이유가 없고, 칸은
 * 도안이 정한다. 사용자가 고치는 것은 말 여섯의 이름과 색뿐이다(`text`·`paint`
 * 배치). 그래서 `styleSets`·`presets`가 비어 있는 첫 게임이다.
 *
 * 게임판은 **동적 파트**다(`dynamic`, IDE-016 2단계). 목록 슬롯 `cities`가
 * 켠 도시와 그 차례를 들고, 서버 렌더러(`./artwork/dynamic.ts`)가 그 값에서
 * 판을 그린다. 판의 크기는 켠 도시 수를 따라 A4 → A3 → A2로 커지고
 * (`DYNAMIC_SIZE_STEPS`), 틀 슬롯 `board-frame`이 `map`이면 지도만 낸다.
 * 파트의 정적 `artwork`는 기본값(도시 50개)으로 그린 파일이고 썸네일이 쓴다.
 */
import { defineGame } from '@/lib/schema';
import { RULES } from './rules';
import {
  CITIES,
  DEFAULT_COUNT,
  LEG_LABELS,
  PRESET_COUNTS,
  citiesFor,
} from './cities';
import {
  BOARD,
  DICE_SHEET,
  DYNAMIC_SIZE_STEPS,
  TOKEN,
  TOKEN_SHEET,
  TOKEN_STYLES,
  paperFor,
  tokenCenter,
  tokenLayerId,
} from './dimensions';

export const artworkPath = (partId: string): string =>
  `/games/world-tour/${partId}.svg`;

const BOARD_PART_ID = 'board';
const TOKENS_PART_ID = 'tokens';
const DICE_PART_ID = 'dice';

const CITIES_SLOT_ID = 'cities';
const FRAME_SLOT_ID = 'board-frame';

/**
 * 도시 수 묶음 — 목록 슬롯의 프리셋. 판 크기가 따라 바뀌므로 종이도 함께 적는다.
 * 사용자는 "몇 장인가"를 보고 고른다.
 */
const cityPresets = PRESET_COUNTS.map((count) => {
  const paper = paperFor(count);
  return {
    id: `cities-${count}`,
    label:
      paper.sheets === 1
        ? `${count}개 · A4 한 장`
        : `${count}개 · ${paper.label} (A4 ${paper.sheets}장)`,
    values: citiesFor(count).map((city) => city.id),
  };
});

const tokenGroupId = (n: number): string => `token-${n}`;
const tokenNameSlotId = (n: number): string => `token-${n}-name`;
const tokenColorSlotId = (n: number): string => `token-${n}-color`;

/**
 * 말 하나 = 그룹 하나. 이름 슬롯과 색 슬롯을 가리킨다.
 *
 * 이름은 말 원판의 아래쪽 흰 면에 찍힌다(`text` 배치). 색은 레이어
 * `pc-token-<n>`의 채움을 갈아 끼운다(`paint` 배치) — 테와 모양이 그 레이어에
 * 있다. 모양은 고정이다. 색만으로 가르면 흑백에서 누구 말인지 알 수 없다.
 */
const tokenGroups = TOKEN_STYLES.map((style) => ({
  id: tokenGroupId(style.id),
  label: `말 ${style.id} · ${style.label}`,
  nameSlotId: tokenNameSlotId(style.id),
  colorSlotId: tokenColorSlotId(style.id),
}));

const tokenSlots = TOKEN_STYLES.flatMap((style) => {
  const { xMm, yMm } = tokenCenter(style.id);
  return [
    {
      id: tokenNameSlotId(style.id),
      kind: 'text' as const,
      label: `말 ${style.id} 이름`,
      help: '비워 두면 오린 뒤 손으로 써도 된다.',
      groupId: tokenGroupId(style.id),
      maxLength: 4,
      default: '',
      placeholder: '이름',
      placements: [
        {
          partId: TOKENS_PART_ID,
          mode: 'text' as const,
          xMm,
          yMm: yMm + TOKEN.nameOffsetMm,
          align: 'center' as const,
          fontSizeMm: TOKEN.nameFontMm,
          maxWidthMm: TOKEN.nameMaxWidthMm,
        },
      ],
    },
    {
      id: tokenColorSlotId(style.id),
      kind: 'color' as const,
      label: `말 ${style.id} 색`,
      groupId: tokenGroupId(style.id),
      default: style.color,
      placements: [
        {
          partId: TOKENS_PART_ID,
          mode: 'paint' as const,
          layerId: tokenLayerId(style.id),
          property: 'fill' as const,
        },
      ],
    },
  ];
});

export default defineGame({
  schemaVersion: 1,
  id: 'world-tour',
  title: '세계일주 주사위놀이',
  tagline: '주사위를 던져 세계 도시를 한 바퀴 도는 2–6인용 말판놀이',
  description:
    '실제 세계지도 위에 서울에서 출발해 태평양·아메리카·북극해·유럽·아프리카·' +
    '아시아·오세아니아를 돌아 제주를 거쳐 서울로 돌아오는 길이 그려져 있다. ' +
    '주사위를 던져 나온 수만큼 화살표를 따라가고, 색 상자가 붙은 칸에 멈추면 ' +
    '급행·후퇴·다시·또·쉼 중 하나를 겪는다. 먼저 돌아오는 사람이 이긴다. ' +
    '도시 50개 판이 기본이고, 말 여섯의 이름과 색을 넣어 뽑을 수 있다. ' +
    '칸 옆의 작은 점이 도시의 실제 위치라 놀면서 지리를 익힌다.',
  players: { min: 2, max: 6 },
  supplies: ['가위', '풀', '두꺼운 종이(말·주사위용)'],
  thumbnail: artworkPath(BOARD_PART_ID),

  rules: [...RULES],

  parts: [
    {
      id: BOARD_PART_ID,
      kind: 'board',
      title: '게임판',
      description:
        '로빈슨 도법 태평양 중심 세계지도 위에 서울에서 출발해 세계를 한 바퀴 ' +
        '도는 칸과 화살표가 있다. 만들기 화면의 도시 목록에서 켠 도시가 그 차례대로 ' +
        '그려지고, 도시 수를 따라 판이 커진다 — 50개까지 A4 한 장, 70개까지 ' +
        'A3(A4 2장), 그 위는 A2(A4 4장). "지도만"을 고르면 제목·안내 띠 없이 지도만 ' +
        '뽑힌다. 오리거나 접지 않는다.',
      widthMm: BOARD.widthMm,
      heightMm: BOARD.heightMm,
      orientation: 'landscape',
      // 도시 이름(2.3mm)이 하한을 정한다. 0.8이면 1.84mm — 그 아래는 안 읽힌다.
      minScale: 0.8,
      maxScale: 3,
      // 기본값(도시 50개, 띠 포함)으로 그린 정적 파일 — 썸네일이 쓴다.
      artwork: artworkPath(BOARD_PART_ID),
      dynamic: {
        listSlotId: CITIES_SLOT_ID,
        frameSlotId: FRAME_SLOT_ID,
        sizeSteps: [...DYNAMIC_SIZE_STEPS],
      },
    },
    {
      id: TOKENS_PART_ID,
      kind: 'cutout',
      title: '말 여섯',
      description:
        '지름 13mm 원판 여섯. 색과 모양이 다르고, 만들기 화면에서 넣은 이름이 ' +
        '찍힌다. 두꺼운 종이에 뽑아 원을 따라 오린다. 사람 수만큼 골라 쓴다.',
      widthMm: TOKEN_SHEET.widthMm,
      heightMm: TOKEN_SHEET.heightMm,
      orientation: 'landscape',
      // 이름 글자(2mm)가 하한을 정한다.
      minScale: 1,
      maxScale: 2,
      marks: ['cut'],
      artwork: artworkPath(TOKENS_PART_ID),
    },
    {
      id: DICE_PART_ID,
      kind: 'buildable',
      title: '종이 주사위',
      description:
        '한 변 22mm 정육면체 전개도. 바깥 실선을 오리고 파선을 안으로 접어 빗금 ' +
        '면에 풀을 발라 붙인다. 마주 보는 면의 눈을 더하면 7이다.',
      widthMm: DICE_SHEET.widthMm,
      heightMm: DICE_SHEET.heightMm,
      orientation: 'landscape',
      minScale: 0.8,
      maxScale: 2,
      marks: ['cut', 'fold-valley', 'glue'],
      artwork: artworkPath(DICE_PART_ID),
    },
  ],

  groups: tokenGroups,
  slots: [
    {
      id: CITIES_SLOT_ID,
      kind: 'list',
      label: '도시',
      help: '켠 도시만 판에 그려지고, 이 차례가 길이다. 서울은 출발지라 끌 수 없다. 많을수록 판이 커진다.',
      options: CITIES.map((city) => ({
        value: city.id,
        label: city.name,
        group: LEG_LABELS[city.leg],
      })),
      presets: cityPresets,
      fixed: ['seoul'],
      // 풀 밖의 도시도 검색해서 더할 수 있다(2026-09-08 사용자 요청). 세계 도시
      // 7천 곳(Natural Earth)을 서버가 찾아 이름·경위도를 값에 실어 준다.
      custom: true,
      search: {
        providerId: 'world-cities',
        placeholder: '도시 이름으로 찾기 — 예: 류블랴나, Lisbon',
      },
      // 서울 + 칸 넷은 있어야 주사위 한 번이 뜻을 갖는다.
      min: 5,
      default: citiesFor(DEFAULT_COUNT).map((city) => city.id),
      placements: [{ partId: BOARD_PART_ID, mode: 'control' }],
    },
    {
      id: FRAME_SLOT_ID,
      kind: 'choice',
      label: '판 구성',
      options: [
        { value: 'full', label: '제목·안내 포함' },
        { value: 'map', label: '지도만' },
      ],
      default: 'full',
      placements: [{ partId: BOARD_PART_ID, mode: 'control' }],
    },
    ...tokenSlots,
  ],
});
