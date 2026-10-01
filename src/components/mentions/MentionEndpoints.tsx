import { PINGBACK_PATH, WEBMENTION_PATH } from '@/lib/mentions/endpoints';
import { siteUrl } from '@/lib/site';

/**
 * 멘션을 받는 주소를 화면에 적는다 (IDE-046)
 *
 * 남의 블로그가 이 글을 가리키면 그쪽 소프트웨어가 이 글에 와서 **어디로
 * 알려야 하는지**를 찾는다. 찾는 순서는 응답 헤더, 그다음 문서의 `<link>` 다.
 * 헤더는 `next.config.ts` 가 붙이고 여기가 `<link>` 를 맡는다 — 헤더만 보는
 * 구현도, 문서만 보는 구현도 있어서 둘 다 적는다.
 *
 * `<link>` 는 React 가 어디서 그렸든 `<head>` 로 올려 준다. 그래서 메타데이터
 * (`generateMetadata`)가 아니라 컴포넌트다 — Next 의 메타데이터에는 이 `rel` 을
 * 적을 칸이 없다.
 *
 * 멘션을 받는 화면(글 하나 · 게임 하나)에만 둔다. 받지 않는 화면에 적어 두면
 * 보낸 쪽이 헛걸음을 한다.
 */
export function MentionEndpoints() {
  return (
    <>
      <link rel="webmention" href={WEBMENTION_PATH} />
      {/* 핑백 규약은 절대 주소를 요구한다. */}
      <link rel="pingback" href={`${siteUrl()}${PINGBACK_PATH}`} />
    </>
  );
}
