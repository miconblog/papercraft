'use client';

/**
 * 링크드인 칸의 "바로 올리기" (IDE-037)
 *
 * 내보내기 칸(`SnsExport`)의 링크드인 카드 아래에 붙는다. 연결 상태에 따라
 * 넷 중 하나가 선다 — 앱 키 없음 · 연결 전 · 만료 · 연결됨.
 *
 * 올리는 문구는 **카드에서 고친 그 문구**다. 올린 뒤 화면을 다시 그리지 않는다
 * (액션이 결과를 돌려준다) — 무엇을 올렸는지가 화면에 그대로 남는다.
 */
import { useState, useTransition } from 'react';
import { ExternalLinkIcon, SendIcon, UnlinkIcon } from 'lucide-react';
import type { LinkedInStatus } from '@/lib/share/linkedin';
import type { LinkedInPostResult } from '@/app/admin/(shell)/posts/linkedinActions';

export type LinkedInPanelData = {
  postId: string;
  /** 연결을 마치고 돌아올 곳 — 이 편집 화면. */
  backPath: string;
  status: LinkedInStatus;
  /** 만료일. 서버가 KST 로 적어 준다(브라우저 시간대로 그리면 하이드레이션이 어긋난다). */
  expiresLabel: string | null;
  /** 이 글을 올린 기록. 최근 것이 앞이다. 날짜는 서버가 적었다. */
  posted: { url: string; label: string }[];
  publish: (postId: string, text: string) => Promise<LinkedInPostResult>;
  disconnect: (form: FormData) => Promise<void>;
};

const BUTTON =
  'inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition-colors outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50 disabled:hover:bg-transparent';

const PRIMARY =
  'inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50';

export function LinkedInPublish({
  data,
  text,
  over,
}: {
  data: LinkedInPanelData;
  /** 카드에서 지금 고쳐 둔 문구. */
  text: string;
  /** 한도를 넘었나 — 넘으면 링크드인이 거절하므로 누르기 전에 막는다. */
  over: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<LinkedInPostResult | null>(null);
  const { status } = data;

  const connectHref = `/admin/linkedin/connect?${new URLSearchParams({ back: data.backPath })}`;

  if (status.kind === 'unconfigured') {
    return (
      <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
        링크드인 앱 키(<code>LINKEDIN_CLIENT_ID</code> ·{' '}
        <code>LINKEDIN_CLIENT_SECRET</code>)를 넣으면 여기서 바로 올릴 수
        있습니다.
      </p>
    );
  }

  if (status.kind !== 'connected') {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>
          {status.kind === 'expired'
            ? `${status.name || '링크드인'} 연결이 만료됐습니다(60일마다 다시 연결).`
            : '링크드인을 연결하면 여기서 바로 올릴 수 있습니다.'}
        </span>
        {/* 라우트 핸들러로 가는 길이라 `next/link` 가 아니다 — 문서가 바뀐다. */}
        <a href={connectHref} className={BUTTON}>
          링크드인 연결하기
        </a>
      </div>
    );
  }

  const publish = () => {
    // 이미 올린 글이면 한 번 더 묻는다 — 막지는 않는다(고쳐서 다시 올릴 수 있다).
    if (
      data.posted.length > 0 &&
      !window.confirm('이 글은 이미 링크드인에 올렸습니다. 한 번 더 올릴까요?')
    ) {
      return;
    }
    start(async () => {
      setResult(await data.publish(data.postId, text));
    });
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">
        <strong className="font-medium text-foreground">
          {status.name || '링크드인'}
        </strong>{' '}
        계정으로 연결됨
        {data.expiresLabel && ` · ${data.expiresLabel}까지`}
      </p>

      {data.posted.length > 0 && (
        <ul className="mt-1 text-xs text-muted-foreground">
          {data.posted.map((one) => (
            <li key={one.url}>
              {one.label}에 올림 ·{' '}
              <a
                href={one.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                보기
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={publish}
          disabled={pending || over || !text.trim()}
          className={PRIMARY}
        >
          <SendIcon className="size-4" aria-hidden />
          {pending ? '올리는 중…' : '링크드인에 바로 올리기'}
        </button>

        <form action={data.disconnect}>
          <input type="hidden" name="back" value={data.backPath} />
          <button type="submit" className={BUTTON}>
            <UnlinkIcon className="size-4" aria-hidden />
            연결 끊기
          </button>
        </form>
      </div>

      <p aria-live="polite" className="mt-2 text-xs">
        {result?.ok === false && (
          <span className="text-destructive">{result.message}</span>
        )}
        {result?.ok && (
          <span className="text-muted-foreground">
            올렸습니다 ·{' '}
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              링크드인에서 보기
              <ExternalLinkIcon className="size-3" aria-hidden />
            </a>
            {!result.thumbnail &&
              ' · 대표 사진 없이 올라갔습니다(JPG·PNG·GIF 만 썸네일로 올릴 수 있습니다)'}
            {!result.recorded && ' · 올린 기록을 남기지 못했습니다'}
          </span>
        )}
      </p>
    </div>
  );
}
