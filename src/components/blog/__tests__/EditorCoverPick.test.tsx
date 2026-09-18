/**
 * 본문 사진을 대표 사진으로 — 폼에 실려 가는가 (2026-09-19 사용자 신고)
 *
 * 처음엔 고른 주소를 숨은 제출 단추의 `name`·`value` 로 실었다. 서버 액션을
 * `formAction` 으로 단 단추는 React 가 `name` 을 액션 식별자로 덮어써서 **주소가
 * 서버에 안 갔고**, 서버 HTML 과 이름이 달라 하이드레이션 경고가 났다. 단추만
 * 떼어 시험하면(`CoverButton.test.tsx`) 이것이 안 보인다 — 편집기를 통째로
 * 그리고 액션이 받는 폼 값을 본다.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { Editor } from '../Editor';
import type { Doc } from '@/lib/blog/doc';

const SRC = 'https://example.com/a.jpg';

const DOC = {
  type: 'doc',
  content: [{ type: 'image', src: SRC, alt: '', width: null, align: null }],
} as unknown as Doc;

const upload = async () => ({ ok: false as const, message: '' });

describe('편집기의 대표 사진 고르기', () => {
  it('고른 주소가 `coverPick` 으로 액션에 실리고, 쓰던 글도 함께 간다', async () => {
    const pickCover = vi.fn<(form: FormData) => Promise<void>>(async () => {});
    render(
      <form>
        <Editor
          name="doc"
          initial={DOC}
          upload={upload}
          coverUrl={null}
          pickCover={pickCover}
        />
      </form>,
    );

    const button = await screen.findByRole('button', {
      name: '대표 사진으로 지정',
    });
    await act(async () => button.click());

    await waitFor(() => expect(pickCover).toHaveBeenCalledTimes(1));
    const form = pickCover.mock.calls[0][0];
    expect(form.get('coverPick')).toBe(SRC);
    expect(String(form.get('doc'))).toContain(SRC);
  });

  it('보낸 뒤에는 칸을 비운다 — 다른 버튼으로 저장할 때 따라가지 않는다', async () => {
    const { container } = render(
      <form>
        <Editor
          name="doc"
          initial={DOC}
          upload={upload}
          pickCover={async () => {}}
        />
      </form>,
    );
    const button = await screen.findByRole('button', {
      name: '대표 사진으로 지정',
    });
    await act(async () => button.click());

    const field = container.querySelector<HTMLInputElement>(
      'input[name="coverPick"]',
    );
    expect(field?.value).toBe('');
  });

  it('서버가 그린 제출 단추에 우리가 붙인 이름이 없다 — React 가 액션 식별자를 쓴다', () => {
    const html = renderToString(
      <form>
        <Editor
          name="doc"
          initial={DOC}
          upload={upload}
          pickCover={async () => {}}
        />
      </form>,
    );
    expect(html).toContain('name="coverPick"'); // 숨은 칸
    expect(html).not.toMatch(/<button[^>]*name="coverPick"/);
  });
});
