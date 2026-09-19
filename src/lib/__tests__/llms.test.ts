/**
 * AI 에게 주는 사이트 안내서 (IDE-041)
 *
 * 받은 게임 · 글만 싣는다(공개 필터는 부르는 쪽이 거친다) · 링크 문법이 깨지지
 * 않는다 · 규칙 전문이 순서대로 실린다.
 */
import { describe, expect, it } from 'vitest';
import { renderLlms, renderLlmsFull, type LlmsPost } from '../llms';
import { GAMES } from '../games/registry';

const ORIGIN = 'https://www.daddyscraft.com/';
const soccer = GAMES.find((game) => game.id === 'soccer')!;

const post: LlmsPost = {
  slug: 'play-paper-soccer',
  title: '종이 축구 [첫 판]',
  summary: '아이와 처음\\n뽑아 본 날',
  doc: { type: 'doc', content: [] } as unknown as LlmsPost['doc'],
};

describe('renderLlms', () => {
  const text = renderLlms({ origin: ORIGIN, games: [soccer], posts: [post] });

  it('제목 · 한 줄 요약 · 게임 · 게임 방법 · 글 절이 있다', () => {
    expect(text.startsWith('# 아빠 뭐해?, 아빠 공방\n\n> ')).toBe(true);
    expect(text).toContain('## 게임\n\n- [');
    expect(text).toContain(
      `- [${soccer.title}](https://www.daddyscraft.com/games/soccer): ${soccer.tagline}`,
    );
    expect(text).toContain('https://www.daddyscraft.com/games/soccer/rules');
    expect(text).toContain('## 공방 일지');
    expect(text).toContain('https://www.daddyscraft.com/llms-full.txt');
  });

  it('제목의 대괄호와 줄바꿈이 링크 문법을 깨지 않는다', () => {
    expect(text).toContain(
      '- [종이 축구 첫 판](https://www.daddyscraft.com/blog/play-paper-soccer)',
    );
    expect(text).not.toMatch(/\[[^\]]*\n/);
  });

  it('받은 것만 싣는다 — 넘기지 않은 게임은 없다', () => {
    const others = GAMES.filter((game) => game.id !== 'soccer');
    for (const game of others) {
      expect(text).not.toContain(`/games/${game.id})`);
    }
  });

  it('글이 없으면 글 절도 없다', () => {
    expect(
      renderLlms({ origin: ORIGIN, games: [soccer], posts: [] }),
    ).not.toContain('## 공방 일지');
  });
});

describe('renderLlmsFull', () => {
  const text = renderLlmsFull({
    origin: ORIGIN,
    games: [soccer],
    posts: [post],
  });

  it('게임마다 인원 · 준비물 · 소개 · 규칙을 싣는다', () => {
    expect(text).toContain(`## ${soccer.title}`);
    expect(text).toMatch(/- 인원: \d/);
    expect(text).toContain(`- 준비물: 인쇄한 도안, ${soccer.supplies[0]}`);
    expect(text).toContain(soccer.description.trim().split('\n')[0]);
  });

  it('규칙의 순서 있는 항목은 절마다 1 부터 번호를 매긴다', () => {
    const steps = soccer.rules.filter((block) => block.kind === 'step');
    if (steps.length > 0) expect(text).toMatch(/\n1\. /);
  });
});
