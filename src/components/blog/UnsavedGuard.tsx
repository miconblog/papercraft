'use client';

/**
 * 저장 안 한 글을 두고 떠나기 전에 묻는다 (IDE-036)
 *
 * `IDE-028` 에 "남은 구멍"으로 적어 둔 것이다. 편집기는 쓰던 글을 브라우저에만
 * 들고 있어서, 「목록으로」 · 사이드 메뉴 · 새로고침 · 창 닫기 어느 쪽으로 떠나도
 * **말없이 날아간다.**
 *
 * ## 무엇을 "바뀜"으로 보나
 *
 * 폼이 **지금 보낼 값**을 처음 값과 견준다(`formSnapshot`). 칸마다 입력 이벤트를
 * 세면 편집기의 도구 막대(굵게 · 사진 정렬 · 너비)처럼 입력 이벤트 없이 바뀌는
 * 것을 놓친다. 폼 값은 편집기가 숨은 칸(`doc`)에 늘 최신으로 적어 두므로 한
 * 곳만 보면 된다.
 *
 * ## 두 갈래로 떠난다
 *
 * - **문서를 떠나는 것**(새로고침 · 창 닫기 · 주소창) — `beforeunload`. 문구는
 *   브라우저가 정한다(요즘 브라우저는 사이트 문구를 보여 주지 않는다).
 * - **앱 안에서 옮겨 가는 것**(`next/link`) — 문서가 안 바뀌어서 `beforeunload`
 *   가 안 뜬다. 문서의 **잡기 단계**에서 링크 누름을 먼저 받아 묻고, 머물기로
 *   하면 `preventDefault` 한다. `next/link` 는 이미 막힌 누름이면 옮기지 않는다.
 *
 * 저장 버튼으로 보내는 것은 묻지 않는다 — 떠나는 것이 아니라 담는 것이다.
 */
import { useEffect, useRef } from 'react';

/** 견주지 않는 칸. 대표 사진 고르기의 일회용 값과, 저장 뒤 청소용 목록이다. */
const IGNORED = new Set(['coverPick', 'uploadedImages']);

/**
 * 폼이 지금 보낼 값을 한 줄로.
 *
 * 파일은 내용을 읽지 않고 이름과 크기로 본다 — 고르기만 해도 "바뀜"이면 된다.
 */
export function formSnapshot(form: HTMLFormElement): string {
  const entries: [string, string][] = [];
  for (const [key, value] of new FormData(form)) {
    if (IGNORED.has(key)) continue;
    const text =
      typeof value === 'string'
        ? value
        : value.size === 0
          ? ''
          : `file:${value.name}:${value.size}`;
    entries.push([key, text]);
  }
  return JSON.stringify(entries);
}

export const LEAVE_MESSAGE =
  '저장하지 않은 내용이 있습니다. 이 화면을 떠나면 쓰던 글이 사라집니다. 떠날까요?';

/** 이 누름이 **같은 창에서** 다른 화면으로 옮겨 가는가. */
function leavingLink(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  // 새 탭·새 창으로 여는 누름은 이 화면을 안 떠난다.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }
  const anchor = (event.target as Element | null)?.closest?.('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  if (anchor.hasAttribute('download')) return null;

  const to = new URL(anchor.href, window.location.href);
  const here = new URL(window.location.href);
  // 같은 화면의 책갈피(`#…`)는 떠나는 것이 아니다.
  if (
    to.origin === here.origin &&
    to.pathname === here.pathname &&
    to.search === here.search
  ) {
    return null;
  }
  return anchor;
}

export function UnsavedGuard({
  formId,
  version,
}: {
  /** 지킬 폼의 `id`. */
  formId: string;
  /**
   * **저장에 성공할 때마다** 달라지는 값. 저장하면 편집 화면이 같은 주소로
   * 다시 그려지는데, 이 컴포넌트는 그대로 살아 있어서 처음 값을 새로 찍어야
   * 한다 — 안 그러면 방금 저장한 글을 두고도 떠날 때 묻는다.
   *
   * 저장이 **실패했으면 `null`** 을 준다. 그때 새로 찍으면 저장 안 된 글이
   * "바뀌지 않음"이 되어 보호가 풀린다.
   */
  version: string | null;
}) {
  const initial = useRef<string | null>(null);
  /** 저장 버튼을 누른 뒤 — 결과로 화면이 바뀌는 동안에는 묻지 않는다. */
  const submitting = useRef(false);

  const formOf = () => {
    const form = document.getElementById(formId);
    return form instanceof HTMLFormElement ? form : null;
  };

  // 서버가 결과를 들고 다시 그리면 보내기는 끝난 것이다. 실패했을 때는 처음 값을
  // 새로 찍지 않으므로(아래) 이것만 풀면 다시 묻는다.
  useEffect(() => {
    submitting.current = false;
  });

  // 처음 값. 처음 뜰 때는 늘 찍고, 그 뒤로는 저장에 성공했을 때만 새로 찍는다.
  useEffect(() => {
    const form = formOf();
    if (!form) return;
    if (initial.current === null || version !== null) {
      initial.current = formSnapshot(form);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, version]);

  useEffect(() => {
    const form = formOf();
    if (!form) return;

    const dirty = () =>
      !submitting.current &&
      initial.current !== null &&
      formSnapshot(form) !== initial.current;

    const onSubmit = () => {
      submitting.current = true;
    };

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty()) return;
      event.preventDefault();
      // 옛 브라우저는 이 값이 있어야 묻는다.
      event.returnValue = '';
    };

    const onClick = (event: MouseEvent) => {
      if (!leavingLink(event) || !dirty()) return;
      if (window.confirm(LEAVE_MESSAGE)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    form.addEventListener('submit', onSubmit);
    window.addEventListener('beforeunload', onBeforeUnload);
    // 잡기 단계 — `next/link` 의 누름 처리보다 먼저 받는다.
    document.addEventListener('click', onClick, true);
    return () => {
      form.removeEventListener('submit', onSubmit);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  return null;
}
