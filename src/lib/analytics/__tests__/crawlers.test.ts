/**
 * 누가 읽어 가나 — 크롤러 판정 (IDE-040)
 *
 * 실제 UA 문자열로 본다. 비슷한 이름끼리 섞이지 않는 것이 핵심이다 —
 * `Claude-SearchBot`(인용될 색인)과 `ClaudeBot`(학습)은 뜻이 전혀 다르다.
 */
import { describe, expect, it } from 'vitest';
import { CRAWLERS, crawlPath, crawlerOf } from '../crawlers';

const UA = {
  gptbot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
  oaiSearch:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  chatgptUser:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  claudeBot:
    'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
  claudeSearch:
    'Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)',
  perplexity:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  perplexityUser:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
  googlebot:
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  yeti: 'Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)',
  applebot:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
  chrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
};

describe('crawlerOf', () => {
  it('OpenAI 셋을 가른다 — 학습 · 검색 색인 · 사용자 대신', () => {
    expect(crawlerOf(UA.gptbot)?.id).toBe('gptbot');
    expect(crawlerOf(UA.gptbot)?.kind).toBe('ai-training');
    expect(crawlerOf(UA.oaiSearch)?.kind).toBe('ai-search');
    expect(crawlerOf(UA.chatgptUser)?.kind).toBe('ai-user');
  });

  it('Claude 와 Perplexity 도 색인 · 학습 · 사용자를 가른다', () => {
    expect(crawlerOf(UA.claudeBot)?.id).toBe('claudebot');
    expect(crawlerOf(UA.claudeSearch)?.id).toBe('claude-searchbot');
    expect(crawlerOf(UA.perplexity)?.id).toBe('perplexitybot');
    expect(crawlerOf(UA.perplexityUser)?.id).toBe('perplexity-user');
  });

  it('일반 검색 크롤러도 센다 — 견줄 기준이다', () => {
    expect(crawlerOf(UA.googlebot)?.kind).toBe('search');
    expect(crawlerOf(UA.yeti)?.vendor).toBe('Naver');
    expect(crawlerOf(UA.applebot)?.id).toBe('applebot');
  });

  it('사람의 브라우저와 빈 UA 는 크롤러가 아니다', () => {
    expect(crawlerOf(UA.chrome)).toBeNull();
    expect(crawlerOf('')).toBeNull();
    expect(crawlerOf(null)).toBeNull();
  });

  it('이름이 품은 다른 낱말에 걸리지 않는다', () => {
    expect(crawlerOf('Mozilla/5.0 Yetisports/2.0')).toBeNull();
    expect(
      crawlerOf('Mozilla/5.0 (compatible; Applebot-Extended/1.0)')?.id,
    ).toBe('applebot-extended');
  });

  it('저장하는 이름이 겹치지 않는다', () => {
    const ids = CRAWLERS.map((crawler) => crawler.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('crawlPath', () => {
  it('빈 경로는 / 이고 긴 경로는 자른다', () => {
    expect(crawlPath('')).toBe('/');
    expect(crawlPath(`/${'a'.repeat(300)}`)).toHaveLength(200);
  });
});
