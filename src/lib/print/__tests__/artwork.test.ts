/**
 * 도안 SVG 파서.
 *
 * 여기서 조용히 빠뜨린 요소는 화면 미리보기에는 남고 **인쇄물에서만 사라진다**.
 * 실제로 `<line x1=…>`의 속성 이름이 숫자를 포함한다는 이유로 좌표가 전부 0이
 * 되어 골대 전개도의 접는선·풀칠면이 통째로 빠진 적이 있다. 그래서 파서는
 * 모르는 것을 만나면 예외를 던지고, 아래 테스트가 실제 도안을 전부 읽는다.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARK_STYLES } from '@/lib/schema';
import { parseArtwork } from '../artwork';
import type { PathDraw, TextDraw } from '../draw';

const dir = join(process.cwd(), 'public/games/soccer');
const read = (name: string) => readFileSync(join(dir, name), 'utf8');

const paths = (items: readonly unknown[]) =>
  items.filter((i): i is PathDraw => (i as PathDraw).kind === 'path');
const texts = (items: readonly unknown[]) =>
  items.filter((i): i is TextDraw => (i as TextDraw).kind === 'text');

describe('parseArtwork', () => {
  it('viewBox에서 도안 크기를 mm로 읽는다', () => {
    const art = parseArtwork(read('field.svg'));
    expect(art.widthMm).toBe(297);
    expect(art.heightMm).toBe(210);
  });

  it('숫자가 든 속성 이름(x1·y2)을 읽는다', () => {
    const art = parseArtwork(
      '<svg viewBox="0 0 10 10"><line x1="1" y1="2" x2="3" y2="4" stroke="#000000" /></svg>',
    );
    expect(paths(art.items)[0].commands).toEqual([
      { c: 'M', x: 1, y: 2 },
      { c: 'L', x: 3, y: 4 },
    ]);
  });

  it('실제 도안의 좌표를 그대로 읽는다 — 하프라인은 보드 한가운데다', () => {
    const art = parseArtwork(read('field.svg'));
    const midXMm = art.widthMm / 2;
    const halfway = paths(art.items).find(
      (p) =>
        p.commands.length === 2 &&
        p.commands[0].c === 'M' &&
        p.commands[0].x === midXMm,
    );
    expect(halfway).toBeDefined();
    // 골라인에서 골라인까지 — 세로로 필드를 가로지른다.
    const [start, end] = halfway!.commands;
    expect(start).toMatchObject({ c: 'M', x: midXMm });
    expect(end).toMatchObject({ c: 'L', x: midXMm });
    expect((end as { y: number }).y - (start as { y: number }).y).toBeCloseTo(
      art.heightMm - 2 * (start as { y: number }).y,
      6,
    );
  });

  it('표시 레이어는 도안이 적은 굵기 대신 규약 값을 쓰고 배율을 먹지 않는다', () => {
    const art = parseArtwork(read('goals.svg'));
    // 골대는 접는선이 전부 골접기다(2026-09-06) — 인쇄면이 쟁반 안쪽을 향한다.
    const folds = paths(art.items).filter((p) => p.mark === 'fold-valley');
    expect(folds.length).toBeGreaterThan(0);
    for (const fold of folds) {
      expect(fold.strokeMm).toBe(MARK_STYLES['fold-valley'].strokeMm);
      expect(fold.dashMm).toEqual(MARK_STYLES['fold-valley'].dashMm);
      expect(fold.fixedStroke).toBe(true);
    }
    // 표시선이 통째로 빠졌던 회귀를 여기서 잡는다 — 전개도 2벌의 바깥 윤곽과
    // 골접기 열여섯, 산접기 넷(뚜껑 귀)이 전부 읽혀야 한다.
    const cuts = paths(art.items).filter((p) => p.mark === 'cut');
    const mountains = paths(art.items).filter(
      (p) => p.mark === 'fold-mountain',
    );
    // 풀칠면도 칼집도 없다(2026-09-06) — 겹으로 탭을 물어 잠근다.
    const glues = paths(art.items).filter((p) => p.mark === 'glue');
    expect(cuts.length).toBe(2);
    expect(folds.length).toBe(16);
    expect(mountains.length).toBe(4);
    expect(glues.length).toBe(0);
    for (const mark of [...cuts, ...folds, ...mountains]) {
      expect(
        mark.commands.some((c) => c.c !== 'Z' && 'x' in c && c.x !== 0),
      ).toBe(true);
    }
  });

  it('색 레이어를 커스터마이즈 값으로 갈아 끼운다', () => {
    // 팀 색 레이어는 점수 기록칸에 있다 — 운동장에서는 뺐다(IDE-010).
    const art = parseArtwork(read('score-sheet.svg'), {
      paint: { 'pc-team-home': { fill: '#123456' } },
    });
    expect(paths(art.items).some((p) => p.fill === '#123456')).toBe(true);
    expect(paths(art.items).some((p) => p.fill === '#1d4ed8')).toBe(false);
  });

  it('글자의 크기·정렬을 그대로 옮긴다', () => {
    const art = parseArtwork(read('goals.svg'));
    const title = texts(art.items).find((t) => t.text.includes('골대 전개도'));
    expect(title).toMatchObject({
      sizeMm: 5,
      baseline: 'central',
      anchor: 'middle',
    });
  });

  it('font-weight를 굵기로 읽는다', () => {
    // 지금 축구 도안에는 굵은 글자가 없다 — 굵은 제목을 쓰던 게임 방법 카드를
    // 출력물에서 뺐다(2026-09-05). 파서 쪽 규약이라 도안과 별개로 지킨다.
    const art = parseArtwork(
      '<svg viewBox="0 0 10 10">' +
        '<text x="1" y="2" font-size="5" font-weight="700">굵게</text>' +
        '<text x="1" y="8" font-size="5">보통</text>' +
        '</svg>',
    );
    expect(texts(art.items).map((t) => t.bold)).toEqual([true, false]);
  });

  it('`fill="none"`은 칠하지 않는다', () => {
    const art = parseArtwork(
      '<svg viewBox="0 0 10 10"><g fill="none" stroke="#000000" stroke-width="0.3"><rect x="1" y="1" width="4" height="4" /></g></svg>',
    );
    expect(paths(art.items)[0].fill).toBeNull();
    expect(paths(art.items)[0].stroke).toBe('#000000');
  });

  it('열린 path는 칠하지 않는다 — 페널티 에어리어가 초록으로 메워지면 안 된다', () => {
    const art = parseArtwork(
      '<svg viewBox="0 0 10 10"><path d="M 1 1 H 5 V 5 H 1" fill="#2f7d32" /></svg>',
    );
    expect(paths(art.items)[0].fill).toBeNull();
  });

  it('변환은 좌표에 구워 넣는다 — 클립과 얽혀 도안이 밀려나지 않게', () => {
    const art = parseArtwork(
      '<svg viewBox="0 0 10 10"><g transform="translate(2,3) scale(2)"><rect x="1" y="1" width="2" height="2" fill="#000000" /></g></svg>',
    );
    expect(paths(art.items)[0].commands[0]).toEqual({ c: 'M', x: 4, y: 5 });
  });

  it('모르는 요소·색·변환은 조용히 넘기지 않고 알린다', () => {
    expect(() =>
      parseArtwork('<svg viewBox="0 0 10 10"><image href="a.png" /></svg>'),
    ).toThrow(/지원하지 않는 요소/);
    expect(() =>
      parseArtwork('<svg viewBox="0 0 10 10"><rect fill="red" /></svg>'),
    ).toThrow(/#RRGGBB/);
    expect(() =>
      parseArtwork(
        '<svg viewBox="0 0 10 10"><g transform="skewX(10)"><rect fill="#000000" /></g></svg>',
      ),
    ).toThrow(/지원하지 않는 변환/);
    expect(() =>
      parseArtwork(
        '<svg viewBox="0 0 10 10"><g transform="scale(2,3)"><rect fill="#000000" /></g></svg>',
      ),
    ).toThrow(/축마다 다른 배율/);
  });

  it('viewBox가 없거나 원점이 0이 아니면 알린다', () => {
    expect(() => parseArtwork('<svg><rect /></svg>')).toThrow(/viewBox/);
    expect(() => parseArtwork('<svg viewBox="1 0 10 10"></svg>')).toThrow(
      /viewBox/,
    );
  });

  it('배포된 도안 전부를 읽을 수 있다', () => {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.svg'))) {
      const art = parseArtwork(read(file));
      expect(art.widthMm, file).toBeGreaterThan(0);
      expect(art.items.length, file).toBeGreaterThan(0);
      // 좌표가 전부 0이면 속성을 못 읽은 것이다.
      const nonZero = paths(art.items).some((p) =>
        p.commands.some((c) => c.c !== 'Z' && 'x' in c && c.x !== 0),
      );
      expect(nonZero, file).toBe(true);
    }
  });
});
