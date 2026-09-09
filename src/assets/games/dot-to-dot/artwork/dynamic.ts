/**
 * 값에서 판을 그린다 (IDE-019)
 *
 * 세계일주가 낸 자리(IDE-016 2단계)를 그대로 쓴다 — 도안 정의는 데이터라 함수를
 * 실을 수 없으므로 게임 id별 렌더러가 여기 따로 있고, 등록소
 * (`lib/games/dynamic-artwork.ts`)가 서버에서만 부른다. 미리보기는 API로 받고
 * 내보내기는 같은 함수를 부르므로 화면과 PDF가 같은 그림이다.
 *
 * 세계일주와 다른 점은 **크기가 바뀌지 않는다**는 것이다. 사진이 무엇이든 판은
 * 190×277 한 장이고, 바뀌는 것은 그 위의 점과 번호뿐이다.
 *
 * 읽는 값: `outline`(윤곽 슬롯 — 판 좌표 mm) · `detail`(세부 선, 고리 여럿) ·
 * `dot-count` · `guide-line`.
 */
import { renderAnswer } from './answer.ts';
import { DEFAULT_DOT_COUNT, renderBoard } from './board.ts';
import { SAMPLE_DETAIL, SAMPLE_OUTLINE } from '../dimensions.ts';

/**
 * 스키마 모듈을 끌어오지 않는다 — 아트워크 코드는 `npm run artwork`가 Node로
 * 직접 실행한다. 값의 모양만 구조적으로 받는다(세계일주 렌더러와 같은 규약).
 */
export interface DynamicValues {
  readonly values: Readonly<Record<string, unknown>>;
}

export const OUTLINE_SLOT_ID = 'outline';
export const DETAIL_SLOT_ID = 'detail';
export const DOT_COUNT_SLOT_ID = 'dot-count';
export const GUIDE_SLOT_ID = 'guide-line';
export const BOARD_PART_ID = 'board';
export const ANSWER_PART_ID = 'answer';
/** 안내선을 켠 선택지의 값. 도안 정의의 `guide-line` 선택지와 같아야 한다. */
export const GUIDE_ON = 'on';

/**
 * 값에서 윤곽을 꺼낸다. 없거나 모양이 틀리면 **보기 그림으로 되돌린다.**
 *
 * 조용한 대체가 위험한 자리도 있지만(고른 도시가 빠진 세계일주 판) 여기는
 * 다르다 — 값이 깨지는 경우는 옛 저장값뿐이고, 그때 빈 종이를 내는 것보다
 * 사진을 다시 넣으라고 말할 그림이라도 있는 편이 낫다. 값의 검증 자체는
 * `validateCustomization`이 이미 막는다.
 */
export const outlineFromValues = (
  customization: DynamicValues,
): readonly number[] => {
  const value = customization.values[OUTLINE_SLOT_ID];
  if (!Array.isArray(value) || value.length < 6) return SAMPLE_OUTLINE;
  if (value.some((v) => typeof v !== 'number' || !Number.isFinite(v)))
    return SAMPLE_OUTLINE;
  if (value.length % 2 !== 0) return SAMPLE_OUTLINE;
  return value as number[];
};

/**
 * 값에서 세부 선을 꺼낸다. 고리의 목록이고, 모양이 틀린 고리는 조용히 뺀다 —
 * 세부는 그림을 돕는 것이라 하나가 깨졌다고 판 전체를 포기할 이유가 없다.
 *
 * 값이 아예 없으면 **보기 그림의 눈·코**로 되돌린다(윤곽과 같은 규칙이다).
 */
export const detailFromValues = (
  customization: DynamicValues,
): ReadonlyArray<readonly number[]> => {
  const value = customization.values[DETAIL_SLOT_ID];
  if (value === undefined) return SAMPLE_DETAIL;
  if (!Array.isArray(value)) return [];
  return value.filter(
    (ring): ring is number[] =>
      Array.isArray(ring) &&
      ring.length >= 6 &&
      ring.length % 2 === 0 &&
      ring.every((v) => typeof v === 'number' && Number.isFinite(v)),
  );
};

const dotCountFromValues = (customization: DynamicValues): number => {
  const value = customization.values[DOT_COUNT_SLOT_ID];
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : DEFAULT_DOT_COUNT;
};

export const renderDotToDotArtwork = (
  partId: string,
  customization: DynamicValues,
): string | null => {
  const outline = outlineFromValues(customization);
  const detail = detailFromValues(customization);
  if (partId === BOARD_PART_ID) {
    return renderBoard({
      outline,
      detail,
      dotCount: dotCountFromValues(customization),
      guide: customization.values[GUIDE_SLOT_ID] === GUIDE_ON,
    });
  }
  if (partId === ANSWER_PART_ID) return renderAnswer({ outline, detail });
  return null;
};
