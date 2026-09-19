import { SITE_TITLE } from '@/lib/site';

/**
 * 개인정보처리방침 본문 (IDE-038)
 *
 * 페이지(`app/privacy/page.tsx`)는 지금 닫혀 있다 — 본문은 여기 두어 시험이
 * 내용을 볼 수 있게 한다. 페이지 파일은 Next 가 정한 이름만 내보낼 수 있다.
 */

/**
 * 이 페이지를 여나. 닫혀 있으면 404 이고 검색에도 안 실린다.
 *
 * 2026-09-19 사용자 결정으로 닫았다 — "아직은 개인정보를 받는 경로가 없어서 잠시
 * 숨겨줘. 나중에 로그인 기반으로 뭔가를 할 때 추가할께." 열 때는 이 값을 켜고,
 * 하단 줄(`SiteFooter`)에 링크를 되살리고, 본문이 그때의 수집 방식과 맞는지 다시
 * 본다.
 */
export const PRIVACY_PAGE_OPEN = false;

/** 고친 날. 내용을 바꾸면 함께 바꾼다. */
const UPDATED = '2026년 9월 19일';
const CONTACT = 'miconblog@gmail.com';

const H2 = 'mt-10 text-xl font-bold tracking-tight';
const LINK = 'underline underline-offset-4 hover:text-primary';

export function PrivacyContent() {
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-10 leading-7 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">개인정보처리방침</h1>
      <p className="mt-2 text-sm text-muted-foreground">고친 날 · {UPDATED}</p>

      <p className="mt-6">
        {SITE_TITLE}은 회원 가입이 없고, 이름 · 연락처 같은 정보를 받지
        않습니다. 어떤 게임이 쓰이는지 알기 위해 방문 통계를 모으고, 댓글을 쓰면
        그 내용을 담습니다. 아래가 전부입니다.
      </p>

      <h2 className={H2}>1. 사이트가 직접 모으는 방문 통계</h2>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li>
          본 화면의 주소, 들어온 곳(앞 사이트의 도메인 · 링크에 붙은 캠페인
          표시)
        </li>
        <li>
          브라우저 · 운영체제 · 기기 종류(PC · 폰 · 태블릿), 접속 위치로 추정한
          나라
        </li>
        <li>PDF 를 내려받았는지, 편집을 시작했는지 같은 사용 흐름</li>
        <li>
          <strong>그날만 쓰는 방문자 표시</strong> — IP 주소와 브라우저 정보를
          섞어 되돌릴 수 없게 만든 값입니다. IP 주소 원본은 저장하지 않고, 이
          값은 날마다 바뀌어 다른 날의 방문과 이어지지 않습니다.
        </li>
      </ul>
      <p className="mt-3">
        이 통계는 <strong>쿠키를 쓰지 않으며</strong>, 사이트 밖으로 보내지 않고
        사이트가 쓰는 저장소(Supabase)에만 둡니다.
      </p>

      <h2 className={H2}>2. Google Analytics</h2>
      <p className="mt-3">
        검색 유입을 보기 위해 Google Analytics 4 를 함께 씁니다. Google
        Analytics 는 <strong>쿠키</strong>(<code>_ga</code> 등)를 브라우저에
        두고, 방문 기록을 Google 로 보냅니다. Google 이 이 정보를 다루는 방식은{' '}
        <a
          href="https://policies.google.com/technologies/partner-sites?hl=ko"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK}
        >
          Google 의 안내
        </a>
        에 있습니다.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li>
          광고에 쓰이는 기능(Google 신호 · 광고 개인화)은{' '}
          <strong>껐습니다</strong>. 이 사이트는 광고를 싣지 않습니다.
        </li>
        <li>
          거부하는 법 — 브라우저 설정에서 쿠키를 막거나,{' '}
          <a
            href="https://tools.google.com/dlpage/gaoptout?hl=ko"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK}
          >
            Google Analytics 차단 부가기능
          </a>
          을 설치하면 됩니다. 막아도 사이트는 똑같이 쓸 수 있습니다.
        </li>
      </ul>

      <h2 className={H2}>3. 댓글</h2>
      <p className="mt-3">
        게임과 공방 일지 아래에 댓글을 쓰면{' '}
        <strong>적은 이름(비워도 됩니다)과 본문</strong>을 담고, 확인한 뒤에
        공개합니다. 같은 사람이 짧은 시간에 여러 번 쓰는 것을 막으려고 1번의
        &quot;그날만 쓰는 방문자 표시&quot;를 함께 담습니다. 올린 댓글을 지우고
        싶으면 아래로 알려 주세요.
      </p>

      <h2 className={H2}>4. 이 브라우저에만 남는 것</h2>
      <p className="mt-3">
        꾸민 도안과 화면 테마(밝게 · 어둡게)는 이 브라우저의 저장소에 남깁니다.
        사이트가 모아 가는 정보가 아니며, 브라우저의 사이트 데이터를 지우면
        사라집니다.
      </p>

      <h2 className={H2}>5. 묻거나 지우기를 청하는 곳</h2>
      <p className="mt-3">
        <a href={`mailto:${CONTACT}`} className={LINK}>
          {CONTACT}
        </a>
      </p>
    </article>
  );
}
