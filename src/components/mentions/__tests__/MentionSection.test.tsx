/**
 * 이 글 · 게임을 이야기한 곳 (IDE-046)
 *
 * 세우는 것이 **남의 서버가 준 값**이다. 그래서 지키는 것이 댓글 칸과 같다 —
 * 글자로만 그린다. 여기에 링크가 하나 더 있어서, 그 링크가 검색 순위를 얻는
 * 길이 되지 않게 하는 표시까지 본다.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mention } from '@/lib/mentions/mentions';

const approvedMentions = vi.fn();
vi.mock('@/lib/mentions/mentions', () => ({ approvedMentions }));

const { MentionSection } = await import('../MentionSection');
const { MentionEndpoints } = await import('../MentionEndpoints');

const mention = (over: Partial<Mention> = {}): Mention => ({
  id: 'm-1',
  kind: 'post',
  targetId: 'p-1',
  sourceUrl: 'https://blog.example/paper-toys',
  sourceHost: 'blog.example',
  title: '종이 장난감 모음',
  excerpt: '윷가락이 제일 잘 굴렀다.',
  via: 'webmention',
  approvedAt: Date.UTC(2026, 9, 1),
  createdAt: Date.UTC(2026, 8, 30),
  ...over,
});

const draw = async (kind: 'post' | 'game' = 'post') =>
  render(await MentionSection({ kind, targetId: 'p-1' }));

afterEach(() => {
  vi.clearAllMocks();
});

describe('MentionSection', () => {
  it('승인된 멘션이 없으면 칸도 없다', async () => {
    approvedMentions.mockResolvedValue([]);

    const { container } = await draw();

    expect(container).toBeEmptyDOMElement();
  });

  it('제목 · 호스트 · 발췌를 세우고 출처로 잇는다', async () => {
    approvedMentions.mockResolvedValue([mention()]);

    await draw();

    expect(
      screen.getByRole('heading', { name: /이 글을 이야기한 곳/ }),
    ).toHaveTextContent('1');
    const link = screen.getByRole('link', { name: '종이 장난감 모음' });
    expect(link).toHaveAttribute('href', 'https://blog.example/paper-toys');
    expect(screen.getByText('blog.example')).toBeInTheDocument();
    expect(screen.getByText('윷가락이 제일 잘 굴렀다.')).toBeInTheDocument();
  });

  it('링크에 nofollow ugc 를 붙인다 — 멘션이 검색 순위를 얻는 길이 되지 않게', async () => {
    approvedMentions.mockResolvedValue([mention()]);

    await draw();

    const rel = screen.getByRole('link').getAttribute('rel') ?? '';
    for (const word of ['nofollow', 'ugc', 'noopener', 'noreferrer']) {
      expect(rel.split(' '), word).toContain(word);
    }
  });

  it('제목이 없으면 호스트 이름으로 대신한다', async () => {
    approvedMentions.mockResolvedValue([mention({ title: '' })]);

    await draw();

    expect(screen.getByRole('link')).toHaveTextContent('blog.example');
  });

  it('제목과 발췌 속의 마크업은 글자로 나온다', async () => {
    approvedMentions.mockResolvedValue([
      mention({
        title: '<img src=x onerror=alert(1)>',
        excerpt: '<script>alert(1)</script>',
      }),
    ]);

    const { container } = await draw();

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  });

  it('게임 화면에서는 게임이라고 적는다', async () => {
    approvedMentions.mockResolvedValue([mention({ kind: 'game' })]);

    await draw('game');

    expect(
      screen.getByRole('heading', { name: /이 게임을 이야기한 곳/ }),
    ).toBeInTheDocument();
  });
});

describe('MentionEndpoints', () => {
  it('웹멘션과 핑백을 받는 주소를 <link> 로 적는다', () => {
    render(<MentionEndpoints />);

    // React 가 `<link>` 를 `<head>` 로 올린다.
    const webmention = document.querySelector('link[rel="webmention"]');
    const pingback = document.querySelector('link[rel="pingback"]');
    expect(webmention?.getAttribute('href')).toBe('/api/webmention');
    // 핑백 규약은 절대 주소를 요구한다.
    expect(pingback?.getAttribute('href')).toMatch(
      /^https?:\/\/.+\/api\/pingback$/,
    );
  });
});
