/**
 * 저장 안 한 글을 두고 떠나기 전에 묻는다 (IDE-036)
 *
 * 지키는 것이 셋이다. **안 고친 글은 묻지 않는다**(편집기가 뜨는 것만으로 바뀜이
 * 되면 매번 묻게 되어 결국 무시하게 된다) · **고친 글은 어느 길로 떠나도 묻는다**
 * · **저장은 떠나는 것이 아니다**.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { Editor } from '../Editor';
import { UnsavedGuard } from '../UnsavedGuard';
import type { Doc } from '@/lib/blog/doc';

const DOC = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: '첫 문단' }] },
    {
      type: 'image',
      src: 'https://example.com/a.jpg',
      alt: '',
      width: null,
      align: null,
    },
  ],
} as unknown as Doc;

const upload = async () => ({ ok: false as const, message: '' });

const screenWith = (version: string | null = 'v1') => (
  <>
    <form id="post-form" onSubmit={(e) => e.preventDefault()}>
      <input name="title" defaultValue="제목" />
      <Editor name="doc" initial={DOC} upload={upload} />
      <button type="submit">저장</button>
    </form>
    {/* 맨 `<a>` 로 둔다 — 가드는 문서의 잡기 단계에서 누름을 받으므로 `next/link`
        여부와 상관없고, 시험에서 라우터를 띄우지 않아도 된다. */}
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
    <a href="/admin/posts">목록으로</a>
    <a href="/admin/posts/x/preview" target="_blank">
      미리보기
    </a>
    <UnsavedGuard formId="post-form" version={version} />
  </>
);

/** 떠나려 할 때 브라우저가 물었겠는가. */
const unloadBlocked = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

/** 링크를 눌렀을 때 옮겨 가지 않고 머물렀는가. */
const clickStays = (link: HTMLElement) => {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  link.dispatchEvent(event);
  return event.defaultPrevented;
};

const settle = () => act(async () => new Promise((r) => setTimeout(r, 50)));

const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

afterEach(() => vi.restoreAllMocks());

describe('UnsavedGuard', () => {
  it('안 고친 글은 묻지 않는다 — 편집기가 뜨는 것만으로 바뀜이 되면 안 된다', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { getByText } = render(screenWith());
    await settle();

    expect(unloadBlocked()).toBe(false);
    // 옮겨 가는 것까지 막지는 않는다(jsdom 은 옮겨 가지 않지만 막았는지는 본다).
    expect(clickStays(getByText('목록으로'))).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('고친 글은 새로고침·창 닫기 전에 묻는다', async () => {
    const { container } = render(screenWith());
    await settle();

    type(container.querySelector('input[name="title"]')!, '고친 제목');
    expect(unloadBlocked()).toBe(true);
  });

  it('본문만 바뀌어도 묻는다 — 도구 막대처럼 입력 이벤트가 없는 변경도', async () => {
    const { container } = render(screenWith());
    await settle();

    // 편집기가 숨은 칸에 적는 값만 바뀐 상태.
    const doc = container.querySelector<HTMLInputElement>('input[name="doc"]')!;
    doc.value = '{"type":"doc","content":[]}';
    expect(unloadBlocked()).toBe(true);
  });

  it('고친 채 링크를 누르면 묻고, 머물기로 하면 옮겨 가지 않는다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { container, getByText } = render(screenWith());
    await settle();

    type(container.querySelector('input[name="title"]')!, '고친 제목');
    expect(clickStays(getByText('목록으로'))).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('떠나기로 하면 막지 않는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container, getByText } = render(screenWith());
    await settle();

    type(container.querySelector('input[name="title"]')!, '고친 제목');
    expect(clickStays(getByText('목록으로'))).toBe(false);
  });

  it('새 창으로 여는 링크(미리보기)는 이 화면을 안 떠나서 묻지 않는다', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { container, getByText } = render(screenWith());
    await settle();

    type(container.querySelector('input[name="title"]')!, '고친 제목');
    clickStays(getByText('미리보기'));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('저장 버튼으로 보내는 것은 묻지 않는다', async () => {
    const { container, getByText } = render(screenWith());
    await settle();

    type(container.querySelector('input[name="title"]')!, '고친 제목');
    act(() => getByText('저장').click());
    expect(unloadBlocked()).toBe(false);
  });

  it('저장에 성공해 다시 그려지면 그 값이 새 기준이다', async () => {
    const { container, getByText, rerender } = render(screenWith('v1'));
    await settle();

    type(container.querySelector('input[name="title"]')!, '고친 제목');
    act(() => getByText('저장').click());
    rerender(screenWith('v2'));
    await settle();

    expect(unloadBlocked()).toBe(false);
  });

  it('저장이 실패해 다시 그려지면 여전히 묻는다 — 저장 안 된 글이다', async () => {
    const { container, getByText, rerender } = render(screenWith('v1'));
    await settle();

    type(container.querySelector('input[name="title"]')!, '고친 제목');
    act(() => getByText('저장').click());
    rerender(screenWith(null));
    await settle();

    expect(unloadBlocked()).toBe(true);
  });
});
