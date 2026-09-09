import { redirect } from 'next/navigation';

/**
 * `/admin` 은 통계로 보낸다 (IDE-027)
 *
 * 이 파일이 없어서 **로그인한 뒤 `/admin` 을 치면 404** 였다(2026-09-09 사용자
 * 보고). 로그인 전에는 `proxy.ts` 가 로그인 화면으로 돌려보내니 404 가 안
 * 보이고, 통과한 뒤에야 "그런 페이지가 없다"가 드러난다.
 *
 * 문지기는 `proxy.ts` 가 이미 지나갔다. 여기서 다시 볼 것이 없다.
 */
export default function AdminIndexPage(): never {
  redirect('/admin/analytics');
}
