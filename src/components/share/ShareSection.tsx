/**
 * 공유하기 줄을 세우는 서버 쪽 (IDE-029)
 *
 * 버튼은 브라우저의 일이라 `ShareBar` 가 클라이언트 컴포넌트지만, **사이트
 * 주소와 카카오 키는 서버가 정한다.** 그 둘을 클라이언트에서 읽으면 환경변수를
 * 읽는 곳이 또 하나 늘고(`analytics/config.ts` 의 규칙), 주소는 브라우저에서
 * 읽는 순간 utm 이 따라 나가는 사고가 된다 — 그 이유는 `ShareBar` 에 적었다.
 *
 * 화면 둘이 이것을 쓴다(게임 · 공방 일지 글). 둘이 각자 키와 주소를 챙기면
 * 한쪽만 빠뜨렸을 때 그 화면에서만 카카오톡 버튼이 사라지고, 그 사실은 눈으로
 * 보이지 않는다.
 */
import { kakaoJsKey } from '@/lib/share/kakao';
import { siteUrl } from '@/lib/site';
import { ShareBar } from './ShareBar';

export type ShareSectionProps = {
  /** 공유할 경로 — `/games/soccer` · `/blog/어떤-글` */
  path: string;
  title: string;
  description: string;
  /**
   * 카카오톡 카드에 세울 그림. **사이트 안의 경로**로 준다 — 여기서 절대 주소로
   * 바꿔 넘긴다(카카오 서버가 가져가야 하므로 상대 경로로는 안 된다).
   *
   * 이미 절대 주소인 값(이미지 보관소에 올린 대표 사진)은 그대로 지나간다.
   */
  imagePath?: string | null;
};

const absolute = (
  origin: string,
  value: string | null | undefined,
): string | null => {
  if (!value) return null;
  return /^https?:\/\//.test(value) ? value : `${origin}${value}`;
};

export function ShareSection({
  path,
  title,
  description,
  imagePath,
}: ShareSectionProps) {
  const origin = siteUrl();

  return (
    <ShareBar
      origin={origin}
      path={path}
      title={title}
      description={description}
      imageUrl={absolute(origin, imagePath)}
      kakaoJsKey={kakaoJsKey()}
    />
  );
}
