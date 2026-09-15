/**
 * 골프 셈 — 파와 타수의 이름 (IDE-030)
 *
 * 규칙문·홀 판 바닥 줄·기록표가 같은 표를 읽는다. 세 곳에 따로 적으면 파5의
 * 이름 하나를 고쳤을 때 종이마다 다른 말이 인쇄된다.
 *
 * 이름은 정식 골프 용어 그대로다(2026-09-15 사용자 요청 — "파와 버디, 이글
 * 같은 규칙은 골프 규칙과 동일"). 아이가 이 판에서 배운 말이 텔레비전에
 * 나오는 말과 같아야 한다.
 */

/** 파 대비 몇 타인가 → 이름. */
export const SCORE_TERMS: readonly { relative: number; label: string }[] = [
  { relative: -3, label: '알바트로스' },
  { relative: -2, label: '이글' },
  { relative: -1, label: '버디' },
  { relative: 0, label: '파' },
  { relative: 1, label: '보기' },
  { relative: 2, label: '더블보기' },
];

export interface HoleTerm {
  readonly strokes: number;
  readonly label: string;
}

/**
 * 이 파에서 타수마다 붙는 이름. **한 타에 넣으면 무엇이든 홀인원**이다 —
 * 파4를 한 번에 넣는 일은 잔디에서는 없지만 종이 위에서는 일어난다.
 */
export function termsForPar(par: number): HoleTerm[] {
  return SCORE_TERMS.map(({ relative, label }) => ({
    strokes: par + relative,
    label,
  }))
    .filter((term) => term.strokes >= 1)
    .map((term) => (term.strokes === 1 ? { ...term, label: '홀인원' } : term));
}

/** 홀 판 바닥에 한 줄로 앉는 안내. "2타 이글 · 3타 버디 · …" */
export const termsLine = (par: number): string =>
  termsForPar(par)
    .map((term) => `${term.strokes}타 ${term.label}`)
    .join(' · ');
