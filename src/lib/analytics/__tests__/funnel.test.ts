/**
 * 퍼널 접기 (IDE-035)
 *
 * 지키는 것은 하나다. **사이트 줄과 게임 줄을 섞어 더하지 않는다** — 섞으면
 * 게임 화면에 들어온 세션이 두 번 센다.
 */
import { describe, expect, it } from 'vitest';
import { foldFunnel, groupFunnel, rateOf } from '../funnel';

const row = (
  game_id: string,
  device: string,
  channel: string,
  counts: Partial<Record<string, number>> = {},
  day = '2026-09-19',
) => ({
  day,
  game_id,
  device,
  channel,
  sessions: 0,
  game_views: 0,
  edits: 0,
  print_opens: 0,
  export_fails: 0,
  downloads: 0,
  ...counts,
});

const DAILY = [
  // 사이트 전체 — 모바일 셋(게임 화면 둘), 데스크톱 하나(PDF 까지).
  row('', 'mobile', 'social', { sessions: 2, game_views: 1 }),
  row('', 'mobile', 'direct', { sessions: 1, game_views: 1, print_opens: 1 }),
  row('', 'desktop', 'direct', {
    sessions: 1,
    game_views: 1,
    edits: 1,
    print_opens: 1,
    downloads: 1,
  }),
  // 게임 줄 — 위 세션들이 닿은 게임.
  row('soccer', 'mobile', 'social', { sessions: 1, game_views: 1 }),
  row('soccer', 'desktop', 'direct', {
    sessions: 1,
    game_views: 1,
    edits: 1,
    print_opens: 1,
    downloads: 1,
  }),
  row('baseball', 'mobile', 'direct', {
    sessions: 1,
    game_views: 1,
    print_opens: 1,
    export_fails: 1,
  }),
];

describe('foldFunnel', () => {
  it('날짜를 떼고 같은 칸끼리 더한다', () => {
    const folded = foldFunnel([
      row('', 'mobile', 'direct', { sessions: 2 }, '2026-09-18'),
      row('', 'mobile', 'direct', { sessions: 3, downloads: 1 }, '2026-09-19'),
    ]);
    expect(folded).toHaveLength(1);
    expect(folded[0]).toMatchObject({ sessions: 5, downloads: 1 });
  });
});

describe('groupFunnel', () => {
  const rows = foldFunnel(DAILY);

  it('전체는 사이트 줄만 더한다', () => {
    expect(groupFunnel(rows, 'total')).toEqual([
      {
        key: '',
        sessions: 4,
        game_views: 3,
        edits: 1,
        print_opens: 2,
        export_fails: 0,
        downloads: 1,
      },
    ]);
  });

  it('기기별로 가른다', () => {
    const byDevice = groupFunnel(rows, 'device');
    expect(byDevice.map((g) => [g.key, g.sessions, g.downloads])).toEqual([
      ['mobile', 3, 0],
      ['desktop', 1, 1],
    ]);
  });

  it('게임별은 게임 줄만 더한다', () => {
    const byGame = groupFunnel(rows, 'game');
    expect(byGame.map((g) => [g.key, g.game_views, g.export_fails])).toEqual([
      ['soccer', 2, 0],
      ['baseball', 1, 1],
    ]);
  });
});

describe('rateOf', () => {
  it('첫 단계가 0 이면 비율이 없다', () => {
    expect(rateOf(0, 0)).toBeNull();
    expect(rateOf(1, 3)).toBe(33.3);
  });
});
