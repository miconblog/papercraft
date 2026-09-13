/**
 * 마크다운 읽기 (IDE-023 · IDE-028 이후로는 수입기의 앞단이다)
 *
 * 그리는 몫이 `DocView` 로 넘어가서, 여기 남은 것은 **주소 허용 목록**과
 * **블록 나누기**다. 그리는 결과는 `doc.test.tsx` 와 `fromMarkdown.test.ts` 가 본다.
 */
import { describe, expect, it } from 'vitest';
import { parseMarkdown, safeUrl } from '../markdown';

describe('safeUrl', () => {
  it('http · https · mailto 와 사이트 안 주소를 통과시킨다', () => {
    expect(safeUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeUrl('http://example.com')).toBe('http://example.com');
    expect(safeUrl('mailto:a@b.kr')).toBe('mailto:a@b.kr');
    expect(safeUrl('/games/soccer')).toBe('/games/soccer');
    expect(safeUrl('#어디')).toBe('#어디');
  });

  it('스킴이 다른 주소는 막는다', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('  JavaScript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeUrl('vbscript:msgbox(1)')).toBeNull();
  });

  it('`//` 로 시작하는 것은 상대 주소가 아니다 — 스킴만 생략한 남의 사이트다', () => {
    expect(safeUrl('//evil.example/x')).toBeNull();
  });
});

describe('parseMarkdown', () => {
  it('빈 줄로 문단을 나눈다', () => {
    const blocks = parseMarkdown('첫 문단\n\n둘째 문단');
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.kind === 'paragraph')).toBe(true);
  });

  it('문단 안의 줄바꿈은 남긴다 — 옮길 때 줄이 사라지면 안 된다', () => {
    const [block] = parseMarkdown('물어본다.\n"아빠 일해!"');
    expect(block.kind).toBe('paragraph');
    expect(block.kind === 'paragraph' && block.text).toContain('\n');
  });

  it('제목·목록·인용·코드·가로줄을 가른다', () => {
    const kinds = parseMarkdown(
      '# 제목\n\n- 하나\n- 둘\n\n1. 첫째\n\n> 인용\n\n```\ncode\n```\n\n---',
    ).map((b) => b.kind);
    expect(kinds).toEqual(['heading', 'list', 'list', 'quote', 'code', 'rule']);
  });

  it('닫지 않은 코드 울타리가 있어도 던지지 않는다', () => {
    expect(() => parseMarkdown('앞\n\n```\nconst a = 1;')).not.toThrow();
  });

  it('폰에서 붙여 넣은 `\\r\\n` 도 읽는다', () => {
    expect(parseMarkdown('- 하나\r\n- 둘')[0].kind).toBe('list');
  });

  it('빈 본문도 던지지 않는다', () => {
    expect(parseMarkdown('')).toEqual([]);
  });
});
