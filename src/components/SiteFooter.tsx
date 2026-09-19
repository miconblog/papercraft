import Link from 'next/link';

/** 모든 라우트 하단에 붙는 푸터. 왼쪽은 저작권, 오른쪽은 만든 도구 표기다.
 *
 * 만든 사람에게 닿는 메일 링크("게임 후기를 들려주세요")가 있던 자리를
 * `Built with Lylo` 가 대신한다(2026-09-13 사용자 요청). 바깥으로 나가는
 * 링크라 새 탭에서 열고 `noopener` 를 붙인다 — 없으면 열린 쪽이
 * `window.opener` 로 이 창을 건드릴 수 있다.
 *
 * **`noreferrer` 는 일부러 뺐다.** Lylo 가 유입 채널별로 통계를 잡고 있는데
 * (2026-09-13 사용자), `noreferrer` 는 리퍼러 헤더를 통째로 지워서 그쪽 표에
 * 이 사이트가 **직접 유입**으로 쌓인다. 아래 utm 이 주된 표식이고 리퍼러는
 * 그것이 유실됐을 때(주소를 복사해 옮겨 붙이는 등) 남는 두 번째 단서다.
 *
 * 문구는 `Powered by` · `Vibe coded with` 를 놓고 보다가 정했다. `Powered by`
 * 는 런타임에 계속 도는 것(호스팅·검색·결제)에 쓰는 말이라 만드는 데 쓴 도구와
 * 어긋나고, `Vibe coded with` 는 여기 오는 사람이 아이와 놀 게임판을 뽑으러 온
 * 부모지 개발자가 아니라서 뺐다.
 *
 * **`Made by` 만은 안 된다.** 왼쪽 저작권이 `Daddy's Craft` 라 그 옆에서
 * "Lylo 가 만들었다"고 하면 두 줄이 서로 다른 사람을 만든이로 가리킨다.
 * `with` 라야 도구를 쓴 쪽이 사람임이 남는다.
 *
 * `Lylo` 만 본문 색에 굵게 세운다. 푸터 글자가 통째로 `muted-foreground` 라
 * 그대로 두면 이름이 앞 문구에 묻힌다 — 여기서 읽히라고 넣은 것은 이름 쪽이다. */

/**
 * Lylo 로 보내는 링크. utm 은 **받는 쪽(Lylo) 통계**를 위한 것이다.
 *
 * 우리 `buildShareUrl` 을 안 쓴다 — 그쪽은 `origin` + `path` 로 **이 사이트의**
 * 주소를 만드는 함수라 남의 도메인을 넣을 자리가 없다.
 *
 * - `utm_source` 는 **보내는 사이트**다. Lylo 표에서 한 줄을 차지할 이름이라
 *   저작권 줄과 같은 `daddys-craft` 로 고정한다 — 어느 날 `papercraft` 로 적으면
 *   한 사이트가 표에서 둘로 쪼개진다.
 * - `utm_medium=referral` 은 남의 사이트에 걸린 링크를 가리키는 표준값이다.
 *   GA 를 비롯한 분석 도구가 이 값을 알아듣고 **추천 유입** 칸에 넣는다.
 * - `utm_campaign` 은 사이트 안 어느 자리인지다. 나중에 소개 문단이나 글 본문에
 *   링크를 하나 더 걸면 그때 `footer` 와 갈려서 어느 쪽이 눌리는지 보인다.
 */
const LYLO_URL =
  'https://lylo-ai.vercel.app/?utm_source=daddys-craft&utm_medium=referral&utm_campaign=footer';
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © 2026 Daddy&apos;s Craft. All rights reserved
          {/* 처리방침은 모든 화면에서 한 번에 닿아야 한다(IDE-038). */}
          <span aria-hidden> · </span>
          <Link
            href="/privacy"
            className="rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            개인정보처리방침
          </Link>
        </p>
        <p>
          Built with{' '}
          <a
            href={LYLO_URL}
            target="_blank"
            rel="noopener"
            className="rounded-sm font-semibold text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            Lylo
          </a>
        </p>
      </div>
    </footer>
  );
}
