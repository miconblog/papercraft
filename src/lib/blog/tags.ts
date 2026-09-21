/**
 * 글 태그 (사용자 요청 2026-09-22)
 *
 * 관리자 화면에서는 **쉼표로 나눈 한 줄**로 받는다 — 폰에서도 칸 하나에 쳐
 * 넣으면 되고, 자바스크립트가 안 떠도 저장된다. 여기서 그 한 줄을 다듬는다.
 *
 * - 앞뒤 공백과 맨 앞의 `#` 을 뗀다(`#윷놀이` 로 쳐도 `윷놀이`).
 * - 안쪽 공백은 하나로 줄인다.
 * - 겹치면 처음 것만 남긴다. 영문 대소문자는 같은 태그로 본다.
 * - 너무 길거나 많으면 자른다 — 글 화면 머리에 서는 줄이라 한 줄을 넘기지
 *   않아야 한다.
 */

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 20;

const clean = (raw: string): string =>
  raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TAG_LENGTH)
    .trim();

function dedupe(tags: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    kept.push(tag);
  }
  return kept.slice(0, MAX_TAGS);
}

/** 관리자가 친 한 줄(`윷놀이, 나무, #만들기`)을 태그 목록으로. */
export const parseTags = (input: string): string[] =>
  dedupe(input.split(/[,，、]/).map(clean));

/** 저장소에서 읽은 값. 배열이 아니거나 글자가 아닌 것은 버린다. */
export const toTags = (value: unknown): string[] =>
  Array.isArray(value)
    ? dedupe(
        value
          .filter((one): one is string => typeof one === 'string')
          .map(clean),
      )
    : [];

/**
 * 그 태그를 단 글만 모아 보는 목록.
 *
 * `/blog/tag/…` 같은 경로가 아니라 검색 인자다 — `/blog/<조각>` 은 전부 글
 * 주소라, 문지기(`proxy.ts`)가 "안 낸 글"로 보고 404 를 내고 `tag` 라는 슬러그의
 * 글도 쓸 수 없게 된다.
 */
export const tagHref = (tag: string): string =>
  `/blog?tag=${encodeURIComponent(tag)}`;

/** 주소의 `?tag=` 를 읽는다. 다듬어서 하나만 — 없거나 비면 `null`. */
export const readTagParam = (
  value: string | string[] | undefined,
): string | null => {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? (parseTags(raw)[0] ?? null) : null;
};

/** 이 글이 그 태그를 달았나. 영문 대소문자는 가리지 않는다 — 다듬을 때와 같다. */
export const hasTag = (tags: string[], tag: string): boolean =>
  tags.some((one) => one.toLowerCase() === tag.toLowerCase());

/** 입력칸에 도로 채울 한 줄. */
export const formatTags = (tags: string[]): string => tags.join(', ');
