/**
 * 글 태그 (사용자 요청 2026-09-22)
 *
 * 관리자는 쉼표로 나눈 한 줄을 친다. 폰에서 대충 쳐도 깔끔한 태그가 되어야
 * 한다.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_TAGS,
  MAX_TAG_LENGTH,
  formatTags,
  parseTags,
  toTags,
} from '../tags';

describe('parseTags', () => {
  it('쉼표로 나누고 앞뒤 공백·맨 앞 # 을 뗀다', () => {
    expect(parseTags(' 윷놀이,#나무 ,  ##만들기  ')).toEqual([
      '윷놀이',
      '나무',
      '만들기',
    ]);
  });

  it('한글 쉼표·모점으로 쳐도 나뉜다', () => {
    expect(parseTags('윷놀이，나무、만들기')).toEqual([
      '윷놀이',
      '나무',
      '만들기',
    ]);
  });

  it('빈 칸은 버리고 안쪽 공백은 하나로 줄인다', () => {
    expect(parseTags(',, 보드   게임 ,,')).toEqual(['보드 게임']);
    expect(parseTags('')).toEqual([]);
  });

  it('겹치면 처음 것만 남긴다 — 영문 대소문자는 같다', () => {
    expect(parseTags('DIY, 나무, diy, 나무')).toEqual(['DIY', '나무']);
  });

  it('너무 길거나 많으면 자른다', () => {
    expect(parseTags('가'.repeat(30))[0]).toHaveLength(MAX_TAG_LENGTH);
    const many = Array.from({ length: 15 }, (_, i) => `태그${i}`).join(',');
    expect(parseTags(many)).toHaveLength(MAX_TAGS);
  });
});

describe('toTags', () => {
  it('저장소 값이 배열이 아니거나 글자가 아니면 버린다', () => {
    expect(toTags(null)).toEqual([]);
    expect(toTags('윷놀이')).toEqual([]);
    expect(toTags(['윷놀이', 3, null, ' 나무 '])).toEqual(['윷놀이', '나무']);
  });
});

it('입력칸에는 쉼표로 이어 도로 채운다 — 다시 읽으면 같은 태그다', () => {
  const tags = ['윷놀이', '보드 게임'];
  expect(formatTags(tags)).toBe('윷놀이, 보드 게임');
  expect(parseTags(formatTags(tags))).toEqual(tags);
});
