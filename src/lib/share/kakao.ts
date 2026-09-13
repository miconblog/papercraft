/**
 * 카카오톡 공유에 필요한 것 (IDE-029)
 *
 * 다섯 수단 가운데 **이것만 남의 스크립트를 부른다.** 카카오톡으로 보내는
 * 공개된 주소 규약이 없어서, 웹에서 대화방에 카드를 띄우려면 카카오의 JS SDK 를
 * 실어야 한다(X·페이스북은 주소만 열면 되고, 링크 복사·시스템 공유는 브라우저가
 * 다 해 준다).
 *
 * 그래서 **키가 없으면 그 버튼만 없다.** 스크립트도 안 싣는다 — 키 없이 실어
 * 놓으면 누를 때마다 조용히 실패하고, 무엇보다 아무 값도 못 하는 외부 스크립트가
 * 모든 방문자에게 내려간다.
 *
 * ## 미리 해 둘 일 (키를 넣기 전에)
 *
 * 1. [카카오 개발자](https://developers.kakao.com) 애플리케이션 등록
 * 2. **플랫폼 > Web > 사이트 도메인**에 배포 도메인을 등록한다. 등록하지 않은
 *    도메인에서는 SDK 가 거절한다 — 키가 맞아도 안 된다.
 * 3. **JavaScript 키**를 `NEXT_PUBLIC_KAKAO_JS_KEY` 에 넣는다. 이 값은 브라우저에
 *    그대로 나가는 공개 키다(그래서 `NEXT_PUBLIC_` 이다). 도메인 등록이 이 키의
 *    울타리라, 키가 새는 것 자체가 사고는 아니다.
 */

type Env = Record<string, string | undefined>;

/**
 * SDK 주소. 버전을 박아 둔다 — `latest` 로 두면 남이 올리는 코드가 예고 없이
 * 우리 페이지에서 돈다.
 *
 * `integrity` 를 달지 않는다. 이 버전의 해시를 이 저장소에서 확인할 방법이 없고,
 * 틀린 해시를 적으면 **버튼이 조용히 죽는다** — 확인하지 않은 값을 적어 두는
 * 것보다 안 적는 편이 정직하다. 대신 버전을 고정하고 `crossOrigin` 을 준다.
 * 실제 해시는 카카오 문서의 해당 버전 항목에 있으니, 확인하고 나서 붙이면 된다.
 */
export const KAKAO_SDK_VERSION = '2.7.6';

export const KAKAO_SDK_SRC = `https://t1.kakaocdn.net/kakao_js_sdk/${KAKAO_SDK_VERSION}/kakao.min.js`;

/**
 * JavaScript 키. 없으면 `null` 이고, 그때 카카오톡 버튼은 아예 그려지지 않는다.
 *
 * `analytics/config.ts` 가 "환경변수를 읽는 곳은 한 곳"으로 둔 것과 같은 규칙이다.
 */
export const kakaoJsKey = (env: Env = process.env): string | null =>
  env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim() || null;
