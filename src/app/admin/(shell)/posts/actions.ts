'use server';

/**
 * 공방 일지 — 저장·게시·사진 (IDE-023)
 *
 * 문지기(`proxy.ts`)를 이미 지나온 요청이지만 여기서도 세션을 본다 —
 * `admin/games/actions.ts` 와 같은 이유다. 서버 액션은 URL 만 알면 밖에서
 * 그대로 부를 수 있고, matcher 한 줄이 바뀌면 문지기는 조용히 사라진다.
 *
 * ## 버튼이 여럿이고 폼은 하나다
 *
 * 편집 화면의 「저장」·「발행하기」·「사진 넣기」·「대표 사진으로」가 모두
 * **같은 폼을 통째로** 받는다. HTML 은 폼을 겹칠 수 없는데, 사진만 따로 올리는
 * 작은 폼을 옆에 두면 **누르는 순간 쓰던 본문이 날아간다.** 폰에서 사진을
 * 넣다가 글을 잃는 것이 이 화면에서 가장 아픈 실수라, 어느 버튼을 눌러도 먼저
 * 저장되게 했다.
 */
import { revalidatePath, updateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { ADMIN_COOKIE, hasAdminSession } from '@/lib/analytics/session';
import { removeUnusedImages } from '@/lib/blog/cleanup';
import { listViewParams, readListView } from '@/lib/blog/adminListView';
import { docImageUrls, parseDoc } from '@/lib/blog/doc';
import { parseTags } from '@/lib/blog/tags';
import { uploadImage } from '@/lib/blog/images';
import {
  POSTS_TAG,
  createPost,
  deletePost,
  postById,
  setPostHidden,
  updatePost,
  type PostDraft,
  type WriteResult,
} from '@/lib/blog/posts';
import { toSlug } from '@/lib/blog/slug';
import { kstDay, kstLocalToInstant } from '@/lib/kst';

const LIST = '/admin/posts';

async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!hasAdminSession(token)) notFound();
}

/**
 * 바뀐 글을 곧바로 보이게 한다.
 *
 * `updateTag` 는 서버 액션 전용이고 stale 을 내주지 않는다 — 다음 요청이 새
 * 값을 기다린다. 홈의 최근 글과 목록도 함께 깨운다.
 */
function refreshLists(): void {
  updateTag(POSTS_TAG);
  revalidatePath('/');
  revalidatePath('/blog');
}

const str = (form: FormData, name: string): string =>
  String(form.get(name) ?? '').trim();

/**
 * 주소를 정한다.
 *
 * 비워 두면 제목에서 뽑는다. 제목이 한글뿐이면 뽑을 것이 없어서 — 사용자가
 * 한국어로 쓰므로 흔한 경우다 — **날짜와 임의 네 자로 만든다.** 여기서
 * 막으면 폰으로 쓰다가 영문 주소를 짜내야 하고, 만들어 둔 값은 화면에 그대로
 * 보이니 내기 전에 고칠 수 있다.
 */
function resolveSlug(form: FormData): string {
  const typed = toSlug(str(form, 'slug'));
  if (typed) return typed;

  const fromTitle = toSlug(str(form, 'title'));
  if (fromTitle) return fromTitle;

  return `post-${kstDay().replace(/-/g, '')}-${crypto
    .randomUUID()
    .slice(0, 4)}`;
}

/**
 * 폼 한 장 → 저장할 값. 게시 시각은 KST 벽시계로 들어온다(IDE-022 와 같다).
 *
 * 본문은 **브라우저가 만든 JSON** 이다(IDE-028). `parseDoc` 이 아는 마디·아는
 * 서식만 남기고 나머지를 버린다 — 여기가 그 문이고, 지나온 값을 그리는
 * `DocView` 는 HTML 문자열을 만들지 않으니 두 겹이다.
 */
function readDraft(form: FormData, publishNow: boolean): PostDraft {
  const typed = str(form, 'publishAt');
  return {
    slug: resolveSlug(form),
    title: str(form, 'title') || '(제목 없음)',
    summary: str(form, 'summary'),
    doc: parseDoc(String(form.get('doc') ?? '')),
    coverUrl: str(form, 'coverUrl') || null,
    tags: parseTags(str(form, 'tags')),
    publishAt: publishNow ? Date.now() : kstLocalToInstant(typed),
    hidden: form.get('hidden') === '1',
  };
}

/** 목록에서 온 폼이 싣고 온 보던 쪽. 모르는 값은 버린다. */
const viewOf = (form: FormData): Record<string, string> =>
  listViewParams(readListView((key) => str(form, key)));

/**
 * 결과를 화면에 남기려고 쿼리로 돌아간다 — 새로고침해도 폼이 다시 안 날아간다.
 * 목록에서 누른 액션은 보던 쪽(`adminListView`)도 함께 싣고 돌아간다.
 */
const back = (path: string, params: Record<string, string>): never =>
  redirect(`${path}?${new URLSearchParams(params)}`);

/**
 * 이 화면에서 올린 사진 주소들 — 편집기가 숨은 칸(`uploadedImages`)에 적는다.
 *
 * 올렸다가 저장 전에 지운 사진은 글 어디에도 흔적이 없어서 이것으로만 찾는다.
 * 믿고 지우지는 않는다 — 후보로만 넘기고 `removeUnusedImages` 가 다시 가린다.
 */
function uploadedImages(form: FormData): string[] {
  try {
    const value: unknown = JSON.parse(
      String(form.get('uploadedImages') ?? '[]'),
    );
    return Array.isArray(value)
      ? value.filter((one): one is string => typeof one === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * 저장하고 편집 화면으로 돌아온다.
 *
 * 새 글이면 방금 만든 `id` 로 간다 — 목록으로 보내면 사진을 넣거나 한 줄 더
 * 고치려고 다시 들어와야 한다.
 */
async function saveAndReturn(
  form: FormData,
  publishNow: boolean,
  note: string,
): Promise<never> {
  const id = str(form, 'id');
  const draft = readDraft(form, publishNow);

  // 저장 **전에** 지금 담긴 사진들을 적어 둔다. 저장 뒤에 글에서 빠진 것을
  // 가려 스토리지에서 치운다(2026-09-10 사용자 요청).
  const before = id ? await postById(id) : null;

  let result: WriteResult;
  let targetId = id;

  if (id) {
    result = await updatePost(id, draft);
  } else {
    targetId = crypto.randomUUID();
    result = await createPost(draft, targetId);
  }

  refreshLists();
  revalidatePath(`/blog/${draft.slug}`);

  if (!result.ok) {
    // 새 글이 실패했으면 `new` 로 돌아간다 — 없는 id 로 보내면 편집 화면이
    // 404 를 내고 **쓰던 글이 화면에서 사라진다.**
    return back(`${LIST}/${id || 'new'}`, { error: result.message });
  }
  // **저장이 성공한 뒤에만** 치운다. 후보는 저장 전 글의 사진·대표 사진과 이
  // 화면에서 올린 사진이고, 실제로 지울지는 `removeUnusedImages` 가 다시 가린다
  // — 우리 파일인지, 어느 글도 안 쓰는지. 정리가 실패해도 저장은 끝났다.
  await removeUnusedImages([
    ...(before ? docImageUrls(before.doc) : []),
    ...(before?.coverUrl ? [before.coverUrl] : []),
    ...uploadedImages(form),
  ]);

  return back(`${LIST}/${targetId}`, { saved: note });
}

export async function savePost(form: FormData): Promise<void> {
  await requireAdmin();
  return saveAndReturn(form, false, '저장했습니다');
}

/** 게시 시각을 지금으로 잡고 저장한다. 날짜 칸을 만지지 않고 바로 내는 길이다. */
export async function publishNow(form: FormData): Promise<void> {
  await requireAdmin();
  return saveAndReturn(form, true, '발행했습니다');
}

/**
 * 사진 한 장만 올리고 주소를 돌려준다 (IDE-028)
 *
 * 편집기가 **글 안에 끌어다 놓거나 붙여 넣을 때** 부른다. 다른 액션들과 달리
 * 저장도 리다이렉트도 하지 않는다 — 글은 편집기가 들고 있고, 여기서 돌려준
 * 주소로 사진 마디를 그 자리에 꽂는다.
 *
 * 서버 액션이라 문지기와 세션 검사를 그대로 쓴다. 이것 하나 때문에 API 라우트를
 * 새로 내지 않는다 — 라우트를 내면 인증을 한 번 더 짜야 한다.
 */
export async function uploadPhoto(
  form: FormData,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  await requireAdmin();

  const file = form.get('image');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: '올릴 사진을 고르세요.' };
  }
  return uploadImage(file);
}

/**
 * 사진을 올려 대표 사진으로 세운다.
 *
 * 폼 전체를 먼저 저장한다(위 주석 참고). 올리기가 실패하면 저장도 하지 않는다
 * — 반만 된 상태로 돌아가면 무엇이 반영됐는지 알 수 없다.
 *
 * **본문 사진은 여기로 오지 않는다.** 편집기가 `uploadPhoto` 로 직접 올려 그
 * 자리에 꽂는다(2026-09-09 사용자 요청) — 폼을 한 바퀴 도는 방식은 넣은 사진이
 * 글의 어디에 붙었는지 안 보여서 "올라간 건지 모르겠다"가 됐다.
 */
async function attach(form: FormData): Promise<never> {
  await requireAdmin();

  const id = str(form, 'id');
  const file = form.get('image');
  if (!(file instanceof File) || file.size === 0) {
    return back(`${LIST}/${id || 'new'}`, { error: '올릴 사진을 고르세요.' });
  }

  const uploaded = await uploadImage(file);
  if (!uploaded.ok) {
    return back(`${LIST}/${id || 'new'}`, { error: uploaded.message });
  }

  form.set('coverUrl', uploaded.url);
  return saveAndReturn(form, false, '대표 사진을 바꿨습니다');
}

export async function setCoverImage(form: FormData): Promise<void> {
  return attach(form);
}

/**
 * 본문의 사진 한 장을 대표 사진으로 세운다 (2026-09-19 사용자 요청)
 *
 * 편집기의 사진 위 단추가 부른다(`coverPick`). 새로 올리지 않는다 — 이미 본문에
 * 있는 파일을 그대로 가리킨다. 폼 전체를 먼저 저장하는 것은 `attach` 와 같다.
 *
 * **본문에 있는 사진만 받는다.** 버튼이 보내는 값이지만 서버 액션은 밖에서도
 * 부를 수 있다 — 아무 주소나 받으면 공유 카드에 남의 그림이 걸린다.
 */
export async function setCoverFromBody(form: FormData): Promise<void> {
  await requireAdmin();

  const id = str(form, 'id');
  const pick = str(form, 'coverPick');
  const doc = parseDoc(String(form.get('doc') ?? ''));
  if (!pick || !docImageUrls(doc).includes(pick)) {
    return back(`${LIST}/${id || 'new'}`, {
      error: '본문에 있는 사진만 대표 사진으로 세울 수 있습니다.',
    });
  }

  form.set('coverUrl', pick);
  return saveAndReturn(form, false, '대표 사진을 바꿨습니다');
}

/** 대표 사진을 뗀다. 보관소의 파일은 그대로 둔다 — 본문에 쓰고 있을 수 있다. */
export async function clearCoverImage(form: FormData): Promise<void> {
  await requireAdmin();
  form.set('coverUrl', '');
  return saveAndReturn(form, false, '대표 사진을 뗐습니다');
}

/**
 * 지금 당장 내리거나 다시 올린다.
 *
 * 잡아 둔 게시 시각은 그대로 둔다 — `IDE-022` 가 게임에서 정한 그대로다.
 * 목록에서 누르므로 폼 전체가 아니라 `id` 한 칸만 온다.
 */
export async function togglePostHidden(form: FormData): Promise<void> {
  await requireAdmin();

  const id = str(form, 'id');
  const view = viewOf(form);
  const post = await postById(id);
  if (!post) return back(LIST, { ...view, error: '없는 글입니다.' });

  const result = await setPostHidden(id, form.get('hide') === '1');
  refreshLists();
  revalidatePath(`/blog/${post.slug}`);

  return result.ok
    ? back(LIST, {
        ...view,
        saved: form.get('hide') === '1' ? '내렸습니다' : '올렸습니다',
      })
    : back(LIST, { ...view, error: result.message });
}

/**
 * 지운다.
 *
 * 목록에서 **두 번 눌러야** 지워진다(`?confirm=<id>` 를 거친다). 되돌릴 수 없는
 * 조작이라, 좁은 화면에서 옆 버튼을 잘못 누른 것이 글을 지우는 일이 되면 안 된다.
 */
export async function removePost(form: FormData): Promise<void> {
  await requireAdmin();

  const id = str(form, 'id');
  const view = viewOf(form);
  const post = await postById(id);
  if (!post) return back(LIST, { ...view, error: '없는 글입니다.' });

  const result = await deletePost(id);
  refreshLists();
  revalidatePath(`/blog/${post.slug}`);

  return result.ok
    ? back(LIST, {
        ...view,
        saved: `지웠습니다 — ${post.title}`,
      })
    : back(LIST, { ...view, error: result.message });
}
