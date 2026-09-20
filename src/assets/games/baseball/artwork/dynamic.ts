/**
 * 야구장 — 값에서 그때 그리는 판 (IDE-044)
 *
 * 능력치 배분은 **조합이 사실상 무한**하다(여덟 자리에 10mm를 나누는 경우의
 * 수). 파트 변형(`partVariants`)은 선택지를 미리 다 적어 두는 방식이라 쓸 수
 * 없어, 세계일주·점 잇기·골프가 간 길을 따라 동적 파트로 돌린다 — 미리보기는
 * `/api/games/baseball/artwork`로 받고 내보내기는 같은 함수를 직접 부른다.
 * 두 길이 같은 함수라 화면과 PDF가 같은 그림이다.
 *
 * **앞선 셋과 다른 점이 둘 있다.**
 *
 * 1. **마커가 있는 첫 동적 보드다.** 세계일주·점 잇기·나만의 홀에는 판 위에
 *    놓이는 마커가 없다. 마커는 렌더러가 아트워크 **위에** 따로 얹으므로
 *    (`lib/print/compose.ts`) 그림과 부딪히지 않는다.
 * 2. **값이 아니라 좌표에도 딸린다.** 수비 범위 원은 마커를 중심으로 그려지니
 *    시프트를 바꾸거나 마커를 끌면 원도 다시 그려져야 한다. 미리보기가 그것을
 *    알아채도록 `BoardPreview`가 동적 파트의 마커 좌표까지 갱신 키에 넣는다.
 *
 * **규칙 옵션도 같은 렌더러가 읽는다.** 스키마가 "변형과 동적은 함께 쓰지
 * 않는다"로 막으므로 「기본 규칙 / 실제 야구 규칙」은 파트 변형이 아니라
 * 선택 슬롯의 값이다.
 */
// 별칭(`@/`)이 아니라 상대 경로다 — `npm run artwork`가 이 파일을 node로 곧장
// 읽어 정적 한 벌을 뽑기 때문이다.
import type { GameCustomization } from '../../../../lib/schema/index.ts';
import { ABILITY_BUDGET_MM } from '../dimensions.ts';
import { defaultFieldSpec, fieldSpecOf } from './field-spec.ts';
import { renderField } from './field.ts';

/** 동적 파트인 보드의 id. */
export const FIELD_PART_ID = 'field';

/** 동적 파트 렌더러. `lib/games/dynamic-artwork.ts`가 게임 id로 잇는다. */
export function renderBaseballArtwork(
  partId: string,
  customization: GameCustomization,
): string | null {
  if (partId !== FIELD_PART_ID) return null;
  return renderField(fieldSpecOf(customization, ABILITY_BUDGET_MM));
}

/**
 * 기본값으로 그린 한 벌 — 저장소에 커밋되는 `public/games/baseball/field.svg`다.
 *
 * 카탈로그 썸네일과 소개 페이지가 이 파일을 본다. 기본 규칙이므로 IDE-014가
 * 그린 판과 **바이트까지 같아야 한다** — 아트워크 시험이 그것을 지킨다.
 */
export const renderFieldDefault = (): string => renderField(defaultFieldSpec());
