'use client';

/**
 * SNS 로 내보내기 (IDE-034)
 *
 * 낸 글의 편집 화면 아래에 붙는다. 플랫폼마다 문구 · utm 링크 · 대표 사진 ·
 * 글쓰기 창을 한 자리에 모은다 — 문구와 링크를 만드는 일은 전부
 * `lib/share/exportTargets.ts` 가 하고, 여기는 **누를 때 무슨 일이 일어나는가**만
 * 안다.
 *
 * 문구는 **고칠 수 있다.** 조립한 것은 출발점이고, 플랫폼마다 한마디 더 적고
 * 싶은 것이 보통이다. 고친 문구는 저장하지 않는다 — 올리고 나면 쓸 데가 없다.
 *
 * 주소는 서버가 준 `origin` 으로 조립한다(`ShareBar` 와 같은 이유). 관리자가
 * 미리보기 도메인에서 이 화면을 열어도 운영 주소가 나간다.
 */
import { useId, useRef, useState } from 'react';
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  LinkIcon,
} from 'lucide-react';
import {
  EXPORT_TARGETS,
  charCount,
  composeExport,
  exportUrl,
  type ExportInput,
  type ExportTarget,
} from '@/lib/share/exportTargets';

export type SnsExportProps = ExportInput & {
  /** 대표 사진의 절대 주소. 없으면 인스타그램 칸이 막힌다. */
  coverUrl: string | null;
};

const BUTTON =
  'inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm transition-colors outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50 disabled:hover:bg-transparent';

export function SnsExport({ coverUrl, ...input }: SnsExportProps) {
  return (
    <div className="mt-4 grid gap-4">
      {EXPORT_TARGETS.map((target) => (
        <ExportCard
          key={target.id}
          target={target}
          input={input}
          coverUrl={coverUrl}
        />
      ))}
    </div>
  );
}

type CardProps = {
  target: ExportTarget;
  input: ExportInput;
  coverUrl: string | null;
};

/** 사진 파일 이름의 확장자. 모르는 형식이면 jpg 로 둔다 — 앱들이 가장 잘 받는다. */
const extensionOf = (type: string): string =>
  ({
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
  })[type] ?? 'jpg';

function ExportCard({ target, input, coverUrl }: CardProps) {
  const [text, setText] = useState(() => composeExport(target, input));
  /** 눌린 뒤 한 줄 알림. `copied` 가 있어야 복사 버튼에 체크가 선다. */
  const [notice, setNotice] = useState<{
    text: string;
    copied: 'text' | 'link' | null;
  } | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const textId = useId();

  const url = exportUrl(target, input);
  const count = charCount(text);
  const over = count > target.limit;
  // 사진이 없으면 인스타그램은 올릴 수가 없다 — 눌러 봐야 헛걸음이다.
  const blocked = target.needsImage && !coverUrl;

  /**
   * 복사. 막히면(https 아님) 조용히 실패하지 않고 그 칸을 골라 둔다 —
   * `ShareBar` 가 정한 방식이다.
   */
  const copy = async (
    value: string,
    what: 'text' | 'link',
  ): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({
        text: what === 'text' ? '문구를 복사했습니다.' : '링크를 복사했습니다.',
        copied: what,
      });
      return true;
    } catch {
      (what === 'text' ? textRef : linkRef).current?.select();
      setNotice({
        text: '복사가 막혀 있습니다. 골라 둔 칸을 직접 복사해 주세요.',
        copied: null,
      });
      return false;
    }
  };

  const openCompose = async (): Promise<void> => {
    if (!target.compose) return;
    // 창이 문구를 못 받는 곳은 **먼저 복사해 둔다.** 창을 먼저 열면 이 화면이
    // 포커스를 잃어 복사가 막힌다.
    if (!target.composeTakesText) await copy(text, 'text');
    window.open(
      target.compose(url, text, input.title),
      '_blank',
      'noopener,noreferrer',
    );
  };

  const downloadCover = async (): Promise<void> => {
    if (!coverUrl) return;
    try {
      // 다른 도메인의 그림은 `<a download>` 가 무시된다 — 받아서 넘긴다.
      const response = await fetch(coverUrl);
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `${input.slug}.${extensionOf(blob.type)}`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch {
      // 보관소가 CORS 를 안 열어 두었으면 여기로 온다. 새 창에서 길게 눌러 저장한다.
      window.open(coverUrl, '_blank', 'noopener,noreferrer');
      setNotice({
        text: '사진을 새 창으로 열었습니다. 거기서 저장해 주세요.',
        copied: null,
      });
    }
  };

  return (
    <section
      aria-labelledby={`${textId}-title`}
      className="rounded-lg border border-border p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={`${textId}-title`} className="text-sm font-medium">
          {target.label}
        </h3>
        <span
          className={`text-xs tabular-nums ${over ? 'font-medium text-destructive' : 'text-muted-foreground'}`}
        >
          {count.toLocaleString()} / {target.limit.toLocaleString()}자
        </span>
      </div>

      {blocked && (
        <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
          {target.label}은 사진 없이 올릴 수 없습니다. 위에서 대표 사진을 먼저
          세워 주세요.
        </p>
      )}

      <label htmlFor={textId} className="sr-only">
        {target.label}에 올릴 문구
      </label>
      <textarea
        id={textId}
        ref={textRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        className="mt-2 w-full rounded-md border border-border-strong bg-popover px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      />

      <label className="mt-2 block text-xs text-muted-foreground">
        {target.linkInText
          ? '링크'
          : '프로필 링크에 걸 주소 — 본문의 주소는 눌리지 않습니다'}
        <input
          ref={linkRef}
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => copy(text, 'text')}
          disabled={blocked}
          className={BUTTON}
        >
          {notice?.copied === 'text' ? (
            <CheckIcon className="size-4" aria-hidden />
          ) : (
            <CopyIcon className="size-4" aria-hidden />
          )}
          문구 복사
        </button>

        <button
          type="button"
          onClick={() => copy(url, 'link')}
          className={BUTTON}
        >
          {notice?.copied === 'link' ? (
            <CheckIcon className="size-4" aria-hidden />
          ) : (
            <LinkIcon className="size-4" aria-hidden />
          )}
          링크 복사
        </button>

        {coverUrl && (
          <button type="button" onClick={downloadCover} className={BUTTON}>
            <DownloadIcon className="size-4" aria-hidden />
            대표 사진 받기
          </button>
        )}

        {target.compose && (
          <button
            type="button"
            onClick={openCompose}
            disabled={blocked}
            className={BUTTON}
          >
            <ExternalLinkIcon className="size-4" aria-hidden />
            {target.composeTakesText ? '글쓰기 창 열기' : '복사하고 창 열기'}
          </button>
        )}
      </div>

      {!target.compose && (
        <p className="mt-2 text-xs text-muted-foreground">
          웹에서 열 글쓰기 창이 없습니다 — 사진을 받아 폰 앱에서 올리고, 문구를
          붙여 넣어 주세요.
        </p>
      )}

      <p aria-live="polite" className="mt-2 text-xs text-muted-foreground">
        {notice?.text}
      </p>
    </section>
  );
}
