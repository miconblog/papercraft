/**
 * 한글 윤곽선.
 *
 * `IDE-002` §8.5의 결론이 근거다 — 폰트를 PDF에 임베딩하면 뷰어마다 다르게
 * 깨졌고, 더 나쁘게는 문서에 따라 깨지기도 하고 아니기도 했다. 그래서 글자를
 * 패스로 그린다. 여기서는 그 패스가 도안 좌표계와 맞는지 본다.
 */
import { describe, expect, it } from 'vitest';
import { fontFor, layoutText, loadFont } from '../font';

const regular = loadFont('regular');
const bold = loadFont('bold');

const boundsOf = (commands: ReturnType<typeof regular.outline>) => {
  const xs = commands.flatMap((c) => ('x' in c ? [c.x] : []));
  const ys = commands.flatMap((c) => ('y' in c ? [c.y] : []));
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
};

describe('윤곽선 만들기', () => {
  it('한글·숫자·기호를 모두 그린다', () => {
    for (const value of ['파랑 팀', '77', '▶ 3번 오른쪽', '겹침 10mm', '·']) {
      expect(regular.outline(value, 3).length, value).toBeGreaterThan(0);
    }
  });

  it('굵기마다 다른 글리프를 쓴다 — 합성 볼드가 아니다', () => {
    expect(JSON.stringify(bold.outline('가A', 3))).not.toBe(
      JSON.stringify(regular.outline('가A', 3)),
    );
    expect(fontFor(true)).toBe(bold);
    expect(fontFor(false)).toBe(regular);
  });

  it('글자 크기에 정비례한다 — 배율이 글자에도 그대로 먹는다', () => {
    expect(regular.widthMm('축구 게임판', 6)).toBeCloseTo(
      regular.widthMm('축구 게임판', 3) * 2,
      9,
    );
  });

  it('베이스라인이 y=0이고 y는 아래로 증가한다 — 도안 좌표계와 같다', () => {
    const bounds = boundsOf(regular.outline('한', 10));
    // 글자 몸통은 베이스라인 **위**(y 음수)에 있고, 아래로는 descent(0.288em)
    // 안에서만 내려간다. 뒤집는 방향이 틀리면 이 관계가 통째로 반대가 된다.
    expect(bounds.minY).toBeLessThan(-5);
    expect(bounds.maxY).toBeLessThanOrEqual(2.88);
    expect(bounds.minX).toBeGreaterThanOrEqual(-0.5);
  });

  it('`dominant-baseline: central`은 글자 상자의 세로 중심이다', () => {
    // (ascent + descent) / 2 / upem. Noto Sans KR은 1160·-288·1000이다.
    expect(regular.centralShiftEm).toBeCloseTo((1160 - 288) / 2 / 1000, 6);
    expect(bold.centralShiftEm).toBeCloseTo(regular.centralShiftEm, 6);
  });
});

describe('layoutText', () => {
  it('정렬에 따라 왼쪽 시작점을 옮긴다', () => {
    const common = {
      text: '파랑 팀',
      sizeMm: 5,
      bold: false,
      baseline: 'central' as const,
      maxWidthMm: null,
    };
    const start = layoutText({ ...common, anchor: 'start' });
    const middle = layoutText({ ...common, anchor: 'middle' });
    const end = layoutText({ ...common, anchor: 'end' });
    expect(start.dxMm).toBe(0);
    expect(middle.dxMm).toBeCloseTo(-start.widthMm / 2, 9);
    expect(end.dxMm).toBeCloseTo(-start.widthMm, 9);
  });

  it('칸을 넘치면 글자를 줄여 맞춘다 — 긴 팀 이름이 옆 칸을 침범하지 않게', () => {
    const laid = layoutText({
      text: '아주아주 긴 팀 이름입니다',
      sizeMm: 5,
      anchor: 'middle',
      baseline: 'central',
      bold: false,
      maxWidthMm: 20,
    });
    expect(laid.sizeMm).toBeLessThan(5);
    expect(laid.widthMm).toBeCloseTo(20, 6);
    expect(
      regular.widthMm('아주아주 긴 팀 이름입니다', laid.sizeMm),
    ).toBeCloseTo(20, 6);
  });

  it('칸에 들어가면 그대로 둔다', () => {
    const laid = layoutText({
      text: '팀',
      sizeMm: 5,
      anchor: 'start',
      baseline: 'central',
      bold: false,
      maxWidthMm: 100,
    });
    expect(laid.sizeMm).toBe(5);
  });

  it('central 베이스라인은 아래로 내려간다', () => {
    const central = layoutText({
      text: '가',
      sizeMm: 4,
      anchor: 'start',
      baseline: 'central',
      bold: false,
      maxWidthMm: null,
    });
    const alphabetic = layoutText({
      text: '가',
      sizeMm: 4,
      anchor: 'start',
      baseline: 'alphabetic',
      bold: false,
      maxWidthMm: null,
    });
    expect(alphabetic.dyMm).toBe(0);
    expect(central.dyMm).toBeCloseTo(regular.centralShiftEm * 4, 9);
  });
});
