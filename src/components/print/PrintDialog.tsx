'use client';

import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import type { GameCustomization, GameDefinition } from '@/lib/schema';
import { ExportClient } from './ExportClient';

/**
 * 에디터 안의 인쇄 설정 모달 (2026-09-06)
 *
 * 인쇄는 별도 페이지(`/games/<id>/print`)였다. 사용자 요청으로 에디터 도구
 * 막대의 "출력하기" 버튼이 **모달**로 같은 설정을 띄운다 — "인쇄하기 버튼은
 * 만들기 페이지 안쪽에 있어야 자연스럽다". 페이지를 옮기면 방금 만지던 판이
 * 사라지고, 돌아오면 어디까지 했는지 다시 찾아야 한다.
 *
 * 설정 화면 자체는 `ExportClient` 그대로다 — 인쇄 페이지와 같은 코드라 두
 * 곳이 다른 장수를 말할 일이 없다. 다른 점은 값의 출처뿐이다: 페이지는
 * 브라우저 저장값을 읽지만, 여기서는 에디터가 지금 들고 있는 값을 그대로
 * 받는다. 저장은 값이 바뀔 때마다 이미 되고 있어(`EditorClient`) 둘은 같지만,
 * "보이는 그대로 뽑힌다"는 것을 코드로도 못 박는 편이 낫다.
 */
export function PrintDialog({
  game,
  customization,
}: {
  game: GameDefinition;
  customization: GameCustomization;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
        출력하기
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-primary/45 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        {/* 설정이 길어 모달 안에서 스크롤한다 — 화면 높이의 90%를 넘지 않는다.
            바깥 페이지는 base-ui가 스크롤을 잠근다. */}
        <Dialog.Popup className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[90vh] w-auto max-w-6xl -translate-y-1/2 overflow-y-auto rounded-xl bg-background p-5 text-foreground shadow-2xl ring-1 ring-border transition-all data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-bold tracking-tight">
                {game.title} 출력하기
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                배율 100%가 원본 크기다. 크게 뽑으면 A4 여러 장에 나눠 나오고,
                장마다 찍힌 번호와 귀퉁이 눈금을 맞춰 붙이면 이어진다.
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="닫기"
              className="rounded-full border border-border px-3 py-1 text-xs font-medium outline-none transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
            >
              닫기
            </Dialog.Close>
          </div>
          <ExportClient game={game} customization={customization} embedded />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
