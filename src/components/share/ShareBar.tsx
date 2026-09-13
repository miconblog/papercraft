'use client';

/**
 * 공유하기 줄 (IDE-029)
 *
 * 게임 화면과 공방 일지 글 아래에 같은 것이 붙는다. 다섯 수단이고, 링크를
 * 만드는 일은 전부 `lib/share/targets.ts` 가 한다 — 여기는 **누를 때 무슨 일이
 * 일어나는가**만 안다.
 *
 * ## 주소를 `window.location` 에서 읽지 않는다
 *
 * 서버가 준 `origin` 과 `path` 로 조립한다(`ShareSection`). 브라우저의 주소창을
 * 읽으면 **지금 보고 있는 사람에게 붙은 utm 이 그대로 따라 나간다** — 카카오톡으로
 * 받은 링크를 열어 다시 공유하면 `utm_source=kakao` 가 남고, 그 방문은 영원히
 * 카카오에서 온 것으로 센다. 미리보기 도메인에서 공유했을 때 미리보기 주소가
 * 나가는 것도 같은 사고다.
 *
 * ## 두 버튼은 조건부로 나타난다
 *
 * - **시스템 공유** — `navigator.share` 가 있는 브라우저만(대부분 폰이다).
 *   데스크톱에 눌러도 아무 일 없는 버튼을 남기지 않는다.
 * - **카카오톡** — JS 키가 있을 때만(`lib/share/kakao.ts`).
 *
 * 시스템 공유는 **서버에서 늘 없는 것으로** 그린다(`useSyncExternalStore` 의
 * 서버 스냅샷). 서버는 방문자의 브라우저가 무엇을 할 수 있는지 알 방법이 없고,
 * 여기서 `true` 를 내면 하이드레이션이 어긋난다 — `AdminLink` 가 쿠키를 같은
 * 방식으로 다룬다. 버튼이 첫 프레임 뒤에 나타나는 편이, 못 쓰는 버튼이 보였다
 * 사라지는 것보다 낫다.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import Script from 'next/script';
import {
  CheckIcon,
  LinkIcon,
  MessageCircleIcon,
  Share2Icon,
} from 'lucide-react';
import { KAKAO_SDK_SRC } from '@/lib/share/kakao';
import {
  SHARE_TARGETS,
  facebookShareUrl,
  shareUrl,
  xIntentUrl,
  type ShareTargetId,
} from '@/lib/share/targets';

/** SDK 가 실리면 이 이름으로 들어온다. 쓰는 것만 적는다. */
type KakaoSdk = {
  isInitialized: () => boolean;
  init: (jsKey: string) => void;
  Share: { sendDefault: (settings: KakaoFeed) => void };
};

type KakaoFeed = {
  objectType: 'feed';
  content: {
    title: string;
    description: string;
    imageUrl: string;
    link: { mobileWebUrl: string; webUrl: string };
  };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

export type ShareBarProps = {
  /** 사이트 주소. 서버가 `siteUrl()` 로 준다. */
  origin: string;
  /** 공유할 경로 — `/games/soccer` · `/blog/어떤-글` */
  path: string;
  /** 공유 카드의 제목 */
  title: string;
  /** 공유 카드의 설명. 카카오톡 카드에만 쓰인다(나머지는 대상 페이지의 OG 를 읽는다). */
  description: string;
  /**
   * 카카오톡 카드에 세울 그림의 **절대 주소**.
   *
   * 카카오는 이 값을 서버에서 가져가므로 상대 경로로는 안 된다. 없으면 카카오톡
   * 버튼을 그리지 않는다 — 카카오의 피드 카드는 그림을 필수로 받는다.
   */
  imageUrl: string | null;
  /** 없으면 카카오톡 버튼이 없다. */
  kakaoJsKey: string | null;
};

/** 브라우저의 능력은 바뀌지 않는다. 구독할 것이 없어 해지도 빈 함수다. */
const subscribe = () => () => {};

const readCanShare = () => typeof navigator.share === 'function';

/** 서버는 방문자의 브라우저를 모른다 — 늘 없는 것으로 그린다. */
const onServer = () => false;

const BUTTON =
  'inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current';

export function ShareBar({
  origin,
  path,
  title,
  description,
  imageUrl,
  kakaoJsKey,
}: ShareBarProps) {
  /**
   * 눌린 뒤 한 줄 알림. 링크 복사와 실패를 같은 자리에서 말한다.
   *
   * `copied` 를 문구와 **함께** 들고 있는다. 처음에는 "알림이 있으면 복사된
   * 것"으로 읽었는데, 카카오톡이 실패해서 알림을 채우면 그 순간 복사 버튼에
   * 체크 표시가 떴다 — 아무것도 복사하지 않았는데.
   */
  const [notice, setNotice] = useState<{
    text: string;
    copied: boolean;
  } | null>(null);
  /** 복사가 안 되는 브라우저를 위해 주소를 꺼내 보여 줄 때. */
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [kakaoReady, setKakaoReady] = useState(false);
  const labelId = useId();
  const fallbackRef = useRef<HTMLInputElement>(null);
  const canSystemShare = useSyncExternalStore(
    subscribe,
    readCanShare,
    onServer,
  );

  // 꺼내 보여 준 주소는 곧바로 고른 상태로 둔다 — 폰에서 길게 눌러 고르는 것이
  // 이 상황에서 가장 번거로운 단계다.
  useEffect(() => {
    if (fallbackUrl) fallbackRef.current?.select();
  }, [fallbackUrl]);

  const urlFor = (id: ShareTargetId): string => {
    const target = SHARE_TARGETS.find((one) => one.id === id);
    return shareUrl({ origin, path, source: target?.source ?? id });
  };

  const openWindow = (href: string): void => {
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const copyLink = async (): Promise<void> => {
    const url = urlFor('copy');
    try {
      // `clipboard` 는 https(와 localhost)에서만 있다. 없으면 아래로 떨어진다.
      await navigator.clipboard.writeText(url);
      setFallbackUrl(null);
      setNotice({ text: '링크를 복사했습니다.', copied: true });
    } catch {
      // 막혔을 때 조용히 실패하지 않는다 — 주소를 꺼내 놓고 직접 복사하게 한다.
      setFallbackUrl(url);
      setNotice({
        text: '복사가 막혀 있습니다. 아래 주소를 복사해 주세요.',
        copied: false,
      });
    }
  };

  const systemShare = async (): Promise<void> => {
    try {
      await navigator.share({
        title,
        text: description,
        url: urlFor('system'),
      });
    } catch {
      // 사용자가 시트를 닫은 것도 여기로 온다. 취소를 오류로 알리지 않는다.
    }
  };

  const kakaoShare = (): void => {
    const kakao = window.Kakao;
    if (!kakao || !imageUrl) return;
    const url = urlFor('kakao');
    try {
      kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title,
          description,
          imageUrl,
          // 폰과 데스크톱에 같은 주소를 준다 — 우리는 앱이 없어서 갈릴 것이 없다.
          link: { mobileWebUrl: url, webUrl: url },
        },
      });
    } catch {
      setNotice({
        text: '카카오톡 공유를 열지 못했습니다. 링크 복사를 써 주세요.',
        copied: false,
      });
    }
  };

  const showKakao = Boolean(kakaoJsKey && imageUrl);

  return (
    <div className="flex flex-col gap-2">
      {showKakao && (
        <Script
          src={KAKAO_SDK_SRC}
          // 붙은 뒤에 실어도 되는 것이라 페이지가 이것을 기다리지 않는다.
          strategy="lazyOnload"
          crossOrigin="anonymous"
          onLoad={() => {
            const kakao = window.Kakao;
            if (!kakao || !kakaoJsKey) return;
            // 한 번만 부른다. 되돌아오는 탐색에서 스크립트가 다시 평가되면
            // 두 번 불릴 수 있고, SDK 는 그때 예외를 던진다.
            if (!kakao.isInitialized()) kakao.init(kakaoJsKey);
            setKakaoReady(true);
          }}
        />
      )}

      {/* 제목(`h3`)이 아니라 **이름 붙은 묶음**이다.
          이 줄은 글의 한 절이 아니라 단추 모음이라, 제목으로 적으면 공방 일지
          글의 목차 사이에 «공유하기»가 끼어든다(본문의 `##` 이 `h3` 이다).
          `role="group"` 에 이름을 달면 스크린리더에는 "공유하기 묶음"으로
          읽히고 목차에는 안 들어간다. */}
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex flex-wrap items-center gap-2"
      >
        <span id={labelId} className="mr-1 text-sm font-medium">
          공유하기
        </span>

        {showKakao && (
          <button
            type="button"
            onClick={kakaoShare}
            // 실리기 전에 눌러도 아무 일이 없으므로, 그동안은 못 누르게 둔다.
            disabled={!kakaoReady}
            className={`${BUTTON} disabled:opacity-50`}
          >
            <MessageCircleIcon className="size-4" aria-hidden />
            카카오톡
          </button>
        )}

        {canSystemShare && (
          <button type="button" onClick={systemShare} className={BUTTON}>
            <Share2Icon className="size-4" aria-hidden />
            공유
          </button>
        )}

        <button
          type="button"
          onClick={() => openWindow(xIntentUrl(urlFor('x'), title))}
          className={BUTTON}
        >
          <span aria-hidden className="font-semibold">
            𝕏
          </span>
          X
        </button>

        <button
          type="button"
          onClick={() => openWindow(facebookShareUrl(urlFor('facebook')))}
          className={BUTTON}
        >
          페이스북
        </button>

        <button type="button" onClick={copyLink} className={BUTTON}>
          {notice?.copied ? (
            <CheckIcon className="size-4" aria-hidden />
          ) : (
            <LinkIcon className="size-4" aria-hidden />
          )}
          링크 복사
        </button>
      </div>

      {/* 눌린 결과를 스크린리더에도 알린다 — 아이콘이 바뀌는 것만으로는 안 보인다. */}
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {notice?.text}
      </p>

      {fallbackUrl && (
        <input
          ref={fallbackRef}
          readOnly
          value={fallbackUrl}
          aria-label="공유 주소"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
        />
      )}
    </div>
  );
}
