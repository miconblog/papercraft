import { describe, expect, it } from 'vitest';
import {
  extractSvgInner,
  paintLayer,
  readableTextColor,
  stripOuterSvgSize,
} from '../svgOverlay';

describe('stripOuterSvgSize', () => {
  it('바깥 svg 태그의 width·height만 지운다', () => {
    const svg =
      '<svg width="297mm" height="210mm" viewBox="0 0 297 210">' +
      '<rect width="10" height="20" />' +
      '</svg>';
    const stripped = stripOuterSvgSize(svg);
    expect(stripped).not.toContain('width="297mm"');
    expect(stripped).not.toContain('height="210mm"');
    expect(stripped).toContain('viewBox="0 0 297 210"');
    // 안쪽 도형의 width·height는 그대로 남는다.
    expect(stripped).toContain('<rect width="10" height="20" />');
  });
});

describe('paintLayer', () => {
  it('레이어 id가 일치하는 그룹의 fill만 바꾼다', () => {
    const svg =
      '<g id="pc-team-home" fill="#111111"><rect /></g>' +
      '<g id="pc-team-away" fill="#222222"><rect /></g>';
    const painted = paintLayer(svg, 'pc-team-home', '#ff0000');
    expect(painted).toContain('<g id="pc-team-home" fill="#ff0000">');
    expect(painted).toContain('<g id="pc-team-away" fill="#222222">');
  });

  it('없는 레이어 id면 그대로 둔다', () => {
    const svg = '<g id="pc-team-home" fill="#111111"><rect /></g>';
    expect(paintLayer(svg, 'pc-team-away', '#ff0000')).toBe(svg);
  });
});

describe('extractSvgInner', () => {
  it('바깥 svg 태그를 벗기고 안쪽 내용만 돌려준다', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12">' +
      '<title>제목</title><g id="pc-art"><circle r="4" /></g>' +
      '</svg>';
    expect(extractSvgInner(svg)).toBe(
      '<title>제목</title><g id="pc-art"><circle r="4" /></g>',
    );
  });

  it('svg 태그가 없으면 원문을 그대로 돌려준다', () => {
    const markup = '<g><circle r="4" /></g>';
    expect(extractSvgInner(markup)).toBe(markup);
  });
});

describe('readableTextColor', () => {
  it('밝은 배경엔 어두운 글자를 준다', () => {
    expect(readableTextColor('#ffffff')).toBe('#1a1a1a');
  });

  it('어두운 배경엔 밝은 글자를 준다', () => {
    expect(readableTextColor('#111111')).toBe('#ffffff');
  });
});
