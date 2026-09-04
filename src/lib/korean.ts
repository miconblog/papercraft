/**
 * 한글 조사 선택 — 게임 제목처럼 화면에 그대로 꽂아 넣는 문자열 뒤에 조사를
 * 정확히 붙이기 위한 유틸이다. 게임이 늘어도 제목마다 문구를 손으로 고치지
 * 않으려면 받침 유무를 코드로 판정해야 한다.
 */

/**
 * 마지막 글자의 받침 유무로 '로'/'으로'를 고른다. ㄹ받침과 받침 없음은
 * '로', 그 외 받침은 '으로'다 (예: "학교로" · "서울로" · "게임판으로").
 */
export function roParticle(word: string): '로' | '으로' {
  const last = word.at(-1) ?? '';
  const code = last.codePointAt(0) ?? 0;
  // 한글 완성형 음절 범위(가~힣) 밖이면 조사를 판정할 수 없으니 기본값을 쓴다.
  if (code < 0xac00 || code > 0xd7a3) return '로';
  const finalConsonantIndex = (code - 0xac00) % 28;
  const noBatchim = 0;
  const rieulBatchim = 8;
  return finalConsonantIndex === noBatchim ||
    finalConsonantIndex === rieulBatchim
    ? '로'
    : '으로';
}
