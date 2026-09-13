import type { Post } from './posts';
import { docText } from './doc';

/**
 * 목록·검색 결과·공유 카드에 쓰는 한 줄 (IDE-023)
 *
 * 요약을 안 적은 글이 대부분일 것이다 — 쓰는 사람이 한 명이고 폰으로도 쓴다.
 * 그때 비워 두면 검색 결과에 설명이 없는 글이 되므로 본문 앞머리로 대신한다.
 *
 * 목록 화면과 `generateMetadata`, `sitemap` 이 같은 문구를 써야 해서 한 곳에
 * 둔다 — 갈라 두면 검색 결과와 화면의 소개가 서로 다른 글이 된다.
 *
 * `limit` 은 **본문으로 대신할 때의 길이**다. 기본값은 검색 결과 한 줄에 맞춘
 * 160자이고, 목록 화면은 더 길게 가져간다(`PostListItem`) — 읽고 고르는 자리라
 * 한 줄로는 모자란다. 적어 둔 요약이 있으면 그것을 그대로 쓰므로 자르지 않는다.
 */
export const postSummary = (post: Post, limit?: number): string =>
  post.summary.trim() || docText(post.doc, limit);
