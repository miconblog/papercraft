import 'server-only';

/**
 * 멘션이 가리키는 곳 — 주소에서 대상으로 (IDE-046)
 *
 * 밖에서 오는 멘션은 대상을 **주소**로 댄다(`https://…/blog/yut-sticks`). 우리가
 * 담는 것은 댓글과 같은 두 칸이다 — 종류와 `id`(009 · 017). 그 사이를 여기서
 * 잇는다.
 *
 * 주소 읽기가 하는 일이 하나 더 있다. **보낸 쪽 글의 링크가 정말 그 대상을
 * 가리키는지**도 같은 함수로 본다(`receive.ts`). 글자를 그대로 견주면
 * `http` 와 `https`, `www` 가 붙고 안 붙고, 끝의 `/`, `?utm_source=…` 하나에
 * 멀쩡한 멘션이 떨어진다 — 사람이 손으로 건 링크는 그렇게 조금씩 다르다.
 * 그래서 **둘 다 대상으로 읽은 뒤에** 견준다.
 */
import { isPublished, postBySlug } from '@/lib/blog/posts';
import { getGame } from '@/lib/games';
import { isOpen, releasesForRequest } from '@/lib/games/release';
import { siteUrl } from '@/lib/site';

/** 멘션이 붙는 곳. 댓글의 `CommentKind` 와 같은 값이다(009 · 017). */
export type MentionKind = 'game' | 'post';

/** 주소가 말하는 대상. 아직 **있는지는 모른다** — 글은 슬러그일 뿐이다. */
export type TargetRef =
  { kind: 'post'; slug: string } | { kind: 'game'; id: string };

/** 실제로 있고 열려 있는 대상. */
export type MentionTarget = {
  kind: MentionKind;
  /** 게임은 등록소의 id, 글은 `posts.id`. */
  targetId: string;
};

const bare = (host: string): string => host.toLowerCase().replace(/^www\./, '');

/**
 * 우리 사이트의 주소인가.
 *
 * `www` 는 있든 없든 같은 곳으로 본다 — `daddyscraft.com` 은 `www` 로 넘어온다
 * (`lib/site.ts`). 스킴도 가리지 않는다. 포트는 맞아야 한다(로컬은 `:3000`).
 */
export function isOwnUrl(url: URL, site: string = siteUrl()): boolean {
  const own = new URL(site);
  return bare(url.hostname) === bare(own.hostname) && url.port === own.port;
}

/**
 * 주소 → 대상. 멘션을 받는 화면이 아니면 `null`.
 *
 * 받는 화면은 둘이다(`endpoints.ts` 의 `MENTIONABLE_SOURCES`) — 글 하나와 게임
 * 하나. 조각이 정확히 둘이어야 해서 목록(`/blog`)도, 게임 방법
 * (`/games/<id>/rules`)도 대상이 아니다. 질의와 `#` 뒤는 보지 않는다.
 */
export function targetRef(
  raw: string,
  site: string = siteUrl(),
): TargetRef | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!isOwnUrl(url, site)) return null;

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length !== 2) return null;

  let name: string;
  try {
    name = decodeURIComponent(parts[1]);
  } catch {
    return null;
  }

  if (parts[0] === 'blog') return { kind: 'post', slug: name };
  if (parts[0] === 'games') return { kind: 'game', id: name };
  return null;
}

export const sameRef = (a: TargetRef, b: TargetRef): boolean =>
  a.kind === 'post'
    ? b.kind === 'post' && a.slug === b.slug
    : b.kind === 'game' && a.id === b.id;

/**
 * 대상이 **지금 세상에 열려 있으면** 돌려준다.
 *
 * 댓글(`comments/actions.ts` 의 `targetIsOpen`)과 같은 문지기다 — 오픈 전 게임과
 * 안 낸 글에는 멘션이 붙지 않는다. 판정은 각자의 주인 모듈에게 묻는다.
 *
 * 닫힌 대상과 없는 대상을 **같은 답으로** 돌려준다. 다르게 답하면 받는 주소가
 * "여기 안 낸 글이 있다"를 알려 주는 창구가 된다 — 문지기(`proxy.ts`)가 404
 * 화면을 똑같이 맞춘 것과 같은 이유다.
 */
export async function resolveTarget(
  ref: TargetRef,
): Promise<MentionTarget | null> {
  if (ref.kind === 'game') {
    if (!getGame(ref.id)) return null;
    return isOpen(await releasesForRequest(), ref.id)
      ? { kind: 'game', targetId: ref.id }
      : null;
  }

  const post = await postBySlug(ref.slug);
  return post && isPublished(post) ? { kind: 'post', targetId: post.id } : null;
}
