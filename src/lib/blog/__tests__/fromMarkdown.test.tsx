/**
 * 마크다운으로 쓴 글 옮기기 (IDE-028)
 *
 * `IDE-023` 때 쓴 글이 편집기에서 그대로 열려야 한다. 여기서 지키는 것은
 * **옮기고 나서 글의 모양이 바뀌지 않는다**는 것이다 — 특히 줄바꿈. 그리고
 * 옮기는 길로도 스크립트가 들어오지 않아야 한다.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderDoc } from '../DocView';
import { markdownToDoc } from '../fromMarkdown';

const draw = (markdown: string) => {
  const view = render(
    <div data-testid="body">{renderDoc(markdownToDoc(markdown))}</div>,
  );
  return { ...view, text: () => screen.getByTestId('body').textContent ?? '' };
};

describe('옮겨도 모양이 같다', () => {
  it('엔터 한 번이 줄바꿈 한 번으로 간다', () => {
    // 사용자가 실제로 쓴 초안의 모양이다.
    const { container } = draw('물어본다.\r\n"아빠 일해!"');
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.querySelectorAll('p br')).toHaveLength(1);
  });

  it('빈 줄은 문단을 나눈다', () => {
    const { container } = draw('첫 문단\n\n둘째 문단');
    expect(container.querySelectorAll('p')).toHaveLength(2);
    expect(container.querySelectorAll('br')).toHaveLength(0);
  });

  it('제목은 그리는 쪽에서 한 단 내려간다', () => {
    draw('# 배경\n\n## 안쪽');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('배경');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('안쪽');
  });

  it('굵게·기울임·코드를 옮긴다', () => {
    const { container } = draw('**굵게** 와 *기울임* 과 `코드`');
    expect(container.querySelector('strong')).toHaveTextContent('굵게');
    expect(container.querySelector('em')).toHaveTextContent('기울임');
    expect(container.querySelector('code')).toHaveTextContent('코드');
  });

  it('목록과 인용과 코드 블록을 옮긴다', () => {
    const { container } = draw(
      '- 하나\n- 둘\n\n1. 첫째\n\n> 인용\n\n```\ncode\n```\n\n---',
    );
    expect(container.querySelectorAll('ul > li')).toHaveLength(2);
    expect(container.querySelectorAll('ol > li')).toHaveLength(1);
    expect(container.querySelector('blockquote')).toHaveTextContent('인용');
    expect(container.querySelector('pre')).toHaveTextContent('code');
    expect(container.querySelector('hr')).not.toBeNull();
  });

  it('사진은 문단이 아니라 마디로 선다 — 편집기에서 끌어 옮길 수 있어야 한다', () => {
    const { container } = draw(
      '앞 문단\n\n![접은 윷](https://x.co/a.jpg)\n\n뒤 문단',
    );
    expect(screen.getByAltText('접은 윷')).toHaveAttribute(
      'src',
      'https://x.co/a.jpg',
    );
    // 사진이 문단 안에 갇혀 있지 않다.
    expect(container.querySelectorAll('p img')).toHaveLength(0);
    expect(container.querySelectorAll('p')).toHaveLength(2);
  });

  it('링크 글자는 남기고 못 쓰는 주소는 링크로 만들지 않는다', () => {
    const { container, text } = draw(
      '[밖](https://example.com) 과 [나쁨](javascript:alert(1))',
    );
    expect(screen.getByRole('link', { name: '밖' })).toBeInTheDocument();
    expect(container.querySelectorAll('a')).toHaveLength(1);
    expect(text()).toContain('나쁨');
  });
});

describe('옮기는 길로도 스크립트가 안 들어온다', () => {
  it('`<script>` 는 글자로 남는다', () => {
    const { container, text } = draw('앞 <script>alert(1)</script> 뒤');
    expect(container.querySelector('script')).toBeNull();
    expect(text()).toContain('<script>alert(1)</script>');
  });

  it('`onerror` 가 담긴 img 태그도 글자다', () => {
    const { container, text } = draw('<img src=x onerror="alert(1)">');
    expect(container.querySelector('img')).toBeNull();
    expect(text()).toContain('onerror');
  });

  it('빈 본문도 던지지 않는다', () => {
    expect(() => draw('')).not.toThrow();
  });
});
