/**
 * 점 잇기 도안 실측 치수 (IDE-019)
 *
 * 여기 있는 값이 **배율 100%에서 종이 위 mm**다. 도안 정의(`./index.ts`)와
 * 아트워크 생성기(`./artwork/`)가 같은 상수를 읽는다.
 *
 * 좌표계는 `docs/game-authoring.md`를 따른다: 파트 로컬 mm, 원점 좌상단,
 * y는 아래로 증가한다.
 *
 * 앞선 네 게임과 다른 점은 **판 위 그림의 자리를 여기서 정하지 않는다**는
 * 것이다. 축구의 페널티 아크나 윷판의 밭은 좌표가 도안에 박혀 있지만, 점
 * 잇기의 점은 사용자가 넣은 사진에서 나온다. 그래서 이 파일이 정하는 것은
 * **그림이 앉을 상자**(`ART_AREA`·`OUTLINE_BOX`)이고 그 안의 좌표는
 * `lib/dot-to-dot`이 계산한다.
 *
 * 작도 근거는 [docs/dot-to-dot-artwork.md](../../../../docs/dot-to-dot-artwork.md)에 있다.
 */
import {
  DOT_METRICS,
  fitOutline,
  toFlat,
} from '../../../lib/dot-to-dot/index.ts';

/**
 * 점 잇기 판 — **190×277mm 세로 한 장**이다.
 *
 * A4 세로(210×297)에서 가정용 프린터의 인쇄 여백을 뺀 크기다. 사진이 가로여도
 * 이 판을 쓴다 — 보드 파트는 정확히 1개여야 하고(`parseGame`), 윤곽선을 비율
 * 그대로 맞춰 넣고 남는 쪽을 비운다. 사진을 돌려 넣는 선택지는 `IDE-020`이 준다.
 */
export const BOARD = { widthMm: 190, heightMm: 277 } as const;

/**
 * 완성 그림 부속 — 판과 **같은 가로세로비**의 절반 크기다.
 *
 * 비율을 맞춘 것은 어른이 두 장을 겹쳐 보기 때문이다. 다 이은 그림이 이것과
 * 같은 모양이어야 "사진이 제대로 땄다"를 눈으로 확인할 수 있다.
 */
export const ANSWER = { widthMm: 100, heightMm: 146 } as const;

/** 판 위 글자 조판. */
export const TYPE = {
  /** 제목 — 사용자가 넣은 도안 이름이 여기 찍힌다. */
  titleYMm: 14,
  titleFontMm: 6,
  titleMaxWidthMm: 150,
  /** 제목 칸 밑줄. 제목을 비우고 아이가 손으로 쓸 수 있게 늘 그린다. */
  titleRuleYMm: 20,
  titleRuleInsetMm: 26,
  /** 놀이 방법 한 줄. */
  hintYMm: 27.5,
  hintFontMm: 3.4,
  /** 바닥 한 줄. */
  footerYMm: 269,
  footerFontMm: 3,
  /** 시작·끝 안내 글자("시작"·"1로"). 번호보다 작다. */
  markerFontMm: 2.8,
  /** 번호 중심에서 이만큼 더 바깥이다. */
  markerExtraOffsetMm: 8.5,
  /** 부속의 오림선 여백. */
  cutInsetMm: 4,
  answerTitleYMm: 12,
  answerTitleFontMm: 4.6,
  answerNoteYMm: 138,
  answerNoteFontMm: 2.6,
} as const;

/**
 * 그림이 들어갈 수 있는 판 안쪽 — **번호까지 포함**한 영역이다.
 *
 * 위는 놀이 방법 한 줄 아래, 아래는 바닥 한 줄 위다. 번호를 이 상자 안으로
 * 붙들어(`planDots`의 `clampTo`) 종이 밖으로 나가는 수가 없게 한다.
 */
export const ART_AREA = {
  x: 12,
  y: 33,
  width: BOARD.widthMm - 24,
  height: 230,
} as const;

/**
 * 윤곽선 자체가 앉는 상자. `ART_AREA`에서 **번호가 밀려날 폭만큼** 안으로 들어와
 * 있다.
 *
 * 번호는 윤곽선 바깥으로 밀리므로(IDE-019 「번호」) 윤곽을 판 끝까지 채우면
 * 번호가 갈 자리가 없다. 여백은 점 반지름 + 글자 반높이 + 겹침 회피로 밀릴 수
 * 있는 최대 거리를 더한 값이다.
 */
export const LABEL_REACH_MM = 11;

export const OUTLINE_BOX = {
  x: ART_AREA.x + LABEL_REACH_MM,
  y: ART_AREA.y + LABEL_REACH_MM,
  width: ART_AREA.width - LABEL_REACH_MM * 2,
  height: ART_AREA.height - LABEL_REACH_MM * 2,
} as const;

/** 완성 그림 부속에서 실루엣이 앉는 상자. */
export const ANSWER_BOX = {
  x: 10,
  y: 20,
  width: ANSWER.widthMm - 20,
  height: 112,
} as const;

/** 점 지름·번호 크기·최소 간격은 라이브러리가 들고 있다. 여기서는 이름만 잇는다. */
export const METRICS = DOT_METRICS;

/** 안내선 농도 — 15% 회색. 보고 따라 그을 수 있되 답이 되지는 않는다. */
export const GUIDE_COLOR = '#d9d9d9';
export const GUIDE_STROKE_MM = 0.5;
/** 완성 그림의 실루엣 선. 답이므로 진하게 그린다. */
export const ANSWER_STROKE_MM = 0.9;

export const artworkPath = (partId: string): string =>
  `/games/dot-to-dot/${partId}.svg`;

/**
 * 보기 그림 — **앉은 고양이**의 실루엣이다.
 *
 * 사진을 넣기 전의 기본값이자 카탈로그 썸네일이다. 빈 판을 기본값으로 두면
 * 소개 페이지에 아무것도 없는 종이가 걸리고, 사진을 넣기 전에는 이 놀이가
 * 무엇인지 보이지 않는다.
 *
 * 몸과 머리는 좌우 대칭이라 **오른쪽 절반만 적고 뒤집어 잇는다.** 손으로 적은
 * 좌표가 스무 쌍이면 한쪽이 어긋나도 눈에 안 띄는데, 뒤집어 만들면 그럴 수가
 * 없다. **꼬리만 뒤집지 않는다** — 대칭에 함께 태우면 꼬리가 양쪽에 하나씩
 * 달려 고양이가 아니라 날개 달린 무엇이 된다.
 *
 * 좌표는 폭 2 · 높이 2쯤인 상자에 그린 값이고, 판에 넣을 때 `OUTLINE_BOX`에
 * 맞춰 늘린다. 귀 끝과 꼬리 끝이 뾰족해 **모서리 먼저** 규칙이 실제로 걸린다.
 */

/** 머리 꼭대기(대칭축)에서 엉덩이까지. 왼쪽은 이것을 뒤집어 쓴다. */
const CAT_UPPER: ReadonlyArray<readonly [number, number]> = [
  [0.0, -1.0], // 머리 꼭대기 — 대칭축
  [0.18, -0.97],
  [0.28, -0.91], // 귀 안쪽 뿌리
  [0.4, -1.2], // 귀 끝 — 뾰족한 모서리
  [0.52, -0.86], // 귀 바깥 뿌리
  [0.6, -0.74],
  [0.64, -0.58],
  [0.6, -0.45],
  [0.5, -0.36], // 볼
  [0.36, -0.29], // 목 — 가장 잘록한 자리
  [0.42, -0.1], // 어깨
  [0.5, 0.2],
  [0.56, 0.5],
  [0.62, 0.78], // 엉덩이 — 꼬리가 여기서 나간다
];

/** 밑동. 위 절반과 이어져 대칭 실루엣을 이룬다. */
const CAT_LOWER: ReadonlyArray<readonly [number, number]> = [
  [0.5, 1.03],
  [0.26, 1.06],
];

/**
 * 꼬리 — **오른쪽에만** 붙는다. 엉덩이에서 나가 바닥을 따라 오른쪽으로 눕는다.
 *
 * 나가는 선(윗면)과 돌아오는 선(아랫면)이 만나지 않게 두께를 0.12쯤 둔다.
 * 스스로 교차하는 다각형은 넓이 계산도 방향 판정도 뜻을 잃는다.
 */
const CAT_TAIL: ReadonlyArray<readonly [number, number]> = [
  [0.86, 0.8],
  [1.02, 0.92], // 꼬리 끝 — 뾰족한 모서리
  [0.96, 1.04],
  [0.78, 0.99],
  [0.66, 1.0],
];

/** 대칭 절반(꼬리 없음). 왼쪽을 만들 때 쓴다. */
const CAT_SIDE = [...CAT_UPPER, ...CAT_LOWER];

const catPoints = (): Array<{ x: number; y: number }> => {
  const right = [...CAT_UPPER, ...CAT_TAIL, ...CAT_LOWER].map(([x, y]) => ({
    x,
    y,
  }));
  const bottom = { x: 0, y: 1.07 };
  const left = [...CAT_SIDE]
    .reverse()
    .slice(0, -1) // 머리 꼭대기는 오른쪽 절반이 이미 갖고 있다
    .map(([x, y]) => ({ x: -x, y }));
  return [...right, bottom, ...left];
};

/** 판에 앉힌 보기 그림. 도안 정의의 기본값이자 아트워크 산출의 입력이다. */
export const SAMPLE_OUTLINE: number[] = toFlat(
  fitOutline(catPoints(), OUTLINE_BOX),
);
