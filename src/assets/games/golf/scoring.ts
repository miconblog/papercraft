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

/**
 * 땅에 붙는 벌타 표시 (IDE-032)
 *
 * 사용자가 한 라운드 쳐 보고 청했다(2026-09-15) — "땅에 따라서 벌타와 이전자리로
 * 되돌아가는 표시가 땅모양에 같이 표기되면 설명서를 왔다갔다 하지 않아도 될것
 * 같거든."
 *
 * 그래서 **처분을 땅 위에 적는다.** 모래에 `+1타`, 물에 `+1타 / 앞자리에서 다시`,
 * O.B. 선에 `+1타 · 친 자리에서 다시`다. 규칙문과 판이 **같은 표를 읽으므로**
 * 한쪽만 고쳐 종이와 설명이 어긋나는 일이 없다.
 *
 * 말이 짧은 것은 자리가 좁아서이기도 하지만, 치는 도중에 읽는 글이라서다 —
 * 한 번에 눈에 들어오지 않으면 결국 설명서를 편다.
 */
export const PENALTY = {
  bunker: { mark: '+1타', note: null },
  water: { mark: '+1타', note: '앞자리에서 다시' },
  ob: { mark: 'O.B. +1타', note: '친 자리에서 다시' },
} as const;

/** 규칙문이 쓰는 한 줄. 판의 표시와 같은 처분을 말한다. */
export const penaltyLine = (
  where: string,
  penalty: { mark: string; note: string | null },
): string =>
  penalty.note === null
    ? `${where} — ${penalty.mark}`
    : `${where} — ${penalty.mark}, ${penalty.note}`;
