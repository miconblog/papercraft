'use client';

/**
 * 사진 고르는 칸 (IDE-028)
 *
 * 고르는 즉시 **브라우저에서 줄여 폼에 도로 넣는다**(`lib/blog/photo.ts`).
 * 폰 사진 한 장이 3~8MB 라 그대로 보내면 서버 액션 본문 한도에 걸리고, 넘어가도
 * 글을 읽는 사람이 그 크기를 그대로 내려받는다.
 *
 * **줄이기가 실패해도 사진은 올라간다.** 원본을 그대로 두고 서버 쪽 한도가
 * 받아 준다 — 캔버스를 못 쓰는 브라우저에서 사진을 아예 못 넣게 되는 편이
 * 더 나쁘다.
 *
 * `input.files` 를 바꿔치는 데 `DataTransfer` 를 쓴다. 폼이 평소처럼 파일을
 * 실어 보내므로 **버튼 넷이 전부 그대로 동작한다**(`IDE-023` 이 정한 구조).
 */
import { useRef, useState } from 'react';
import { ImageIcon, LoaderCircleIcon } from 'lucide-react';
import { formatBytes, shrinkPhoto } from '@/lib/blog/photo';

type State =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'ready'; from: number; to: number };

export function PhotoField({ name, accept }: { name: string; accept: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: 'idle' });

  async function onPick() {
    const file = input.current?.files?.[0];
    if (!file) return setState({ kind: 'idle' });

    setState({ kind: 'working' });
    const shrunk = await shrinkPhoto(file);

    // 줄인 것이 있으면 폼에 도로 넣는다. `DataTransfer` 를 못 쓰는 브라우저면
    // 원본이 그대로 남는다 — 그래도 올라간다.
    if (shrunk !== file && input.current) {
      try {
        const box = new DataTransfer();
        box.items.add(shrunk);
        input.current.files = box.files;
      } catch {
        setState({ kind: 'ready', from: file.size, to: file.size });
        return;
      }
    }
    setState({ kind: 'ready', from: file.size, to: shrunk.size });
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        name={name}
        accept={accept}
        onChange={onPick}
        className="block w-full text-sm file:mr-3 file:rounded-full file:border file:border-border file:bg-secondary file:px-4 file:py-2 file:text-sm"
      />

      <p
        // 줄이는 동안 버튼을 누르면 원본이 갈 수 있다. 그 사이를 말로 알린다.
        aria-live="polite"
        className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        {state.kind === 'working' && (
          <>
            <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
            사진을 줄이는 중…
          </>
        )}
        {state.kind === 'ready' && (
          <>
            <ImageIcon className="size-3.5" aria-hidden />
            {state.from === state.to ? (
              <>{formatBytes(state.to)} — 그대로 올립니다</>
            ) : (
              <>
                {formatBytes(state.from)} →{' '}
                <strong>{formatBytes(state.to)}</strong> 로 줄여서 올립니다
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}
