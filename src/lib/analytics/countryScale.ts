/**
 * 나라별 방문 지도의 색 구간 (방문 통계 지도)
 *
 * **연속 색이 아니라 다섯 칸 이하로 끊는다.** 이 사이트의 방문은 거의 전부
 * 한국이다 — 방문 수를 그대로 색 농도로 옮기면 한국만 진하고 나머지 나라는
 * 1이든 30이든 똑같이 옅어서, "해외에서도 오나?"라는 질문에 지도가 답하지
 * 못한다. 그래서 구간 경계를 **곱절로 늘어나는 깔끔한 수**(1·2·5·10…)로 잡고,
 * 칸 수가 다섯을 넘지 않는 가장 촘촘한 수열을 고른다. 경계가 깔끔한 수라야
 * 범례를 읽고 "10명대"처럼 바로 말할 수 있다.
 */

/**
 * 구간 경계로 쓸 수열들. 앞의 것일수록 촘촘하다.
 *
 * `[1, 3]` 과 `[1, 5]` 는 둘 다 한 자릿수에 두 칸이지만 끊기는 자리가 달라서,
 * 한쪽이 여섯 칸으로 넘칠 때 다른 쪽은 다섯 칸에 들어오기도 한다(최댓값
 * 412 → 1·5·10·50·100). 이게 없으면 곧장 1·10·100 세 칸으로 떨어져 해외
 * 1과 9가 한 색이 된다.
 */
const PROGRESSIONS: readonly (readonly number[])[] = [
  [1, 2, 5],
  [1, 3],
  [1, 5],
  [1],
];

/** 칸 수의 상한. 이보다 많으면 이웃 칸의 색이 섞여 읽힌다. */
export const MAX_BINS = 5;

/** `steps` 를 10배씩 늘려 가며 `max` 이하의 값을 모은다. */
function ladder(steps: readonly number[], max: number): number[] {
  const out: number[] = [];
  for (let scale = 1; scale <= max; scale *= 10) {
    for (const step of steps) {
      const value = step * scale;
      if (value <= max) out.push(value);
    }
  }
  return out;
}

/**
 * 구간의 아랫값들. `[1, 2, 5, 10]` 이면 1 · 2–4 · 5–9 · 10 이상의 네 칸이다.
 * 방문이 하나도 없으면 빈 배열이다.
 */
export function binBreaks(max: number): number[] {
  if (!(max >= 1)) return [];
  for (const steps of PROGRESSIONS) {
    const breaks = ladder(steps, max);
    if (breaks.length <= MAX_BINS) return breaks;
  }
  // 1·10·100… 으로도 넘치면(10만 넘는 방문) 100배씩 건넌다.
  return ladder([1], max)
    .filter((_, i) => i % 2 === 0)
    .slice(0, MAX_BINS);
}

/** 값이 들어가는 칸. 0 이하는 `-1`(방문 없음)이다. */
export function binOf(value: number, breaks: readonly number[]): number {
  let bin = -1;
  for (const [i, lower] of breaks.entries()) if (value >= lower) bin = i;
  return bin;
}

/** 범례에 적는 이름 — `1` · `2–4` · `20 이상`. */
export function binLabel(bin: number, breaks: readonly number[]): string {
  const lower = breaks[bin];
  const next = breaks[bin + 1];
  const fmt = (n: number) => n.toLocaleString('ko-KR');
  if (next === undefined) return `${fmt(lower)} 이상`;
  return next - 1 === lower ? fmt(lower) : `${fmt(lower)}–${fmt(next - 1)}`;
}

/**
 * 칸 수가 다섯보다 적을 때 램프의 어느 단계를 쓸지.
 *
 * 칸이 둘이면 1·2단계가 아니라 양 끝에 가깝게 벌린다 — 그래야 두 칸이 서로
 * 달라 보이고, 가장 많은 칸이 늘 진한 쪽이다.
 */
const STEPS_FOR: Record<number, readonly number[]> = {
  1: [2],
  2: [1, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
};

export const rampStep = (bin: number, binCount: number): number =>
  STEPS_FOR[binCount]?.[bin] ?? bin;

const regionNames = new Intl.DisplayNames(['ko'], { type: 'region' });

/** `KR` → `대한민국`. 모르는 코드는 코드 그대로 둔다. 빈 코드는 알 수 없음. */
export function countryName(code: string): string {
  if (!code) return '알 수 없음';
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}
