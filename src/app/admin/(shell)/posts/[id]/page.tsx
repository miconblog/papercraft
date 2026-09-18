import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { EyeIcon } from 'lucide-react';
import { adminPassword } from '@/lib/analytics/config';
import { ADMIN_COOKIE, isValidSession } from '@/lib/analytics/session';
import { Editor } from '@/components/blog/Editor';
import { PhotoField } from '@/components/blog/PhotoField';
import { SnsExport } from '@/components/blog/SnsExport';
import { UnsavedGuard } from '@/components/blog/UnsavedGuard';
import { EMPTY_DOC } from '@/lib/blog/doc';
import { isPublished, postById, type Post } from '@/lib/blog/posts';
import { postSummary } from '@/lib/blog/summary';
import { instantToKstLocal } from '@/lib/kst';
import { siteUrl } from '@/lib/site';
import {
  clearCoverImage,
  publishNow,
  savePost,
  setCoverFromBody,
  setCoverImage,
  uploadPhoto,
} from '../actions';

export const metadata: Metadata = {
  title: '글 쓰기',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const FIELD =
  'mt-1 w-full rounded-md border border-border-strong bg-popover px-3 py-2 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current';

const PRIMARY =
  'rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current';

const SECONDARY =
  'rounded-full border border-border px-4 py-2.5 text-sm transition-colors outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current';

/** 새 글은 아직 줄이 없다 — 빈 값으로 같은 폼을 그린다. */
const BLANK: Post = {
  id: '',
  slug: '',
  title: '',
  summary: '',
  doc: EMPTY_DOC,
  body: '',
  coverUrl: null,
  publishAt: null,
  hidden: false,
  createdAt: 0,
  updatedAt: 0,
};

/**
 * 글 쓰기·고치기 (IDE-023)
 *
 * **폰에서 쓸 수 있어야 한다** — 이 이슈가 "저장소에 마크다운을 커밋"이 아니라
 * 관리자 화면을 고른 이유가 그것이다. 그래서 여기에는 클라이언트 자바스크립트가
 * 한 줄도 없다. 폼 하나에 `textarea` 와 버튼 몇 개뿐이라, 느린 회선에서도
 * 화면이 뜨는 즉시 쓸 수 있고 실수로 새로고침해도 저장된 것은 남는다.
 *
 * 버튼이 여럿이지만 폼은 하나다(`formAction`). 왜 그렇게 했는지는
 * `actions.ts` 에 적었다 — 요약하면 **사진을 넣다가 쓰던 본문을 잃지 않기
 * 위해서**다.
 */
export default async function AdminPostEditorPage({
  params,
  searchParams,
}: Props) {
  const password = adminPassword();
  if (!password) notFound();
  if (!isValidSession((await cookies()).get(ADMIN_COOKIE)?.value, password)) {
    notFound();
  }

  const { id } = await params;
  const { saved, error } = await searchParams;

  const isNew = id === 'new';
  const post = isNew ? BLANK : await postById(id);
  // 지운 글의 주소를 다시 열면 여기로 온다. 빈 폼을 주면 새 글인 줄 안다.
  if (!post) notFound();

  return (
    <div className="w-full max-w-2xl">
      <Link
        href="/admin/posts"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← 공방 일지 목록으로
      </Link>

      <h1 className="mt-3 text-3xl font-bold tracking-tight">
        {isNew ? '새 글' : '글 고치기'}
      </h1>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
          {saved}
        </p>
      )}

      <form
        id="post-form"
        // `formAction` 이 붙지 않은 곳(모바일 키보드의 「이동」 등)에서 눌러도
        // 저장으로 떨어지게 폼 자신의 기본 동작을 저장으로 둔다.
        action={savePost}
        className="mt-6 space-y-5"
      >
        <input type="hidden" name="id" value={post.id} />
        <input type="hidden" name="hidden" value={post.hidden ? '1' : '0'} />
        <input type="hidden" name="coverUrl" value={post.coverUrl ?? ''} />

        <label className="block text-sm">
          <span className="font-medium">제목</span>
          <input
            name="title"
            defaultValue={post.title}
            required
            className={FIELD}
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">주소</span>
          <span className="ml-2 text-xs text-muted-foreground">
            /blog/… · 비우면 제목에서 만듭니다
          </span>
          <input
            name="slug"
            defaultValue={post.slug}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="yut-stick-balance"
            className={`${FIELD} font-mono`}
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            영문 소문자·숫자·붙임표만 쓴다. 제목이 한글뿐이면 날짜로 만들어
            두니, 내기 전에 고치면 된다.
          </span>
        </label>

        <label className="block text-sm">
          <span className="font-medium">요약</span>
          <span className="ml-2 text-xs text-muted-foreground">
            목록과 검색 결과에 뜬다 · 비우면 본문 앞머리를 쓴다
          </span>
          <input name="summary" defaultValue={post.summary} className={FIELD} />
        </label>

        {/* 본문만 클라이언트 컴포넌트다(IDE-028). 나머지 칸은 그대로 평범한
            폼이라, 편집기가 안 떠도 제목·주소·게시 시각은 고칠 수 있다. */}
        <div className="text-sm">
          <span className="font-medium">본문</span>
          <span className="ml-2 text-xs text-muted-foreground">
            보이는 대로 씁니다 · 엔터를 누른 자리에서 줄이 바뀝니다
          </span>
          <Editor
            name="doc"
            initial={post.doc}
            upload={uploadPhoto}
            coverUrl={post.coverUrl}
            pickCover={setCoverFromBody}
          />
        </div>

        {/* 본문 사진은 편집기가 맡는다(끌어다 놓기·붙여넣기). 여기 남은 것은
            **대표 사진**뿐이다 — 목록 카드와 공유 카드에 서는 한 장이라 본문의
            사진들과 하는 일이 다르다. */}
        <fieldset className="rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">대표 사진</legend>
          <p className="text-xs text-muted-foreground">
            목록 카드와 공유 카드(카톡·트위터)에 서는 한 장입니다. 없으면 사이트
            기본 이미지가 나갑니다. 본문 사진 위의 ☆ 단추로도 고를 수 있습니다.
          </p>

          {post.coverUrl && (
            <div className="mt-3 flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.coverUrl}
                alt="대표 사진"
                className="h-20 w-28 rounded-md border border-border object-cover"
              />
              <button
                type="submit"
                formAction={clearCoverImage}
                className={SECONDARY}
              >
                떼기
              </button>
            </div>
          )}

          <div className="mt-3">
            {/* 폰에서는 `accept` 한 줄로 카메라도 함께 뜬다. 고른 사진은 올리기
                전에 브라우저에서 줄인다(IDE-028). */}
            <PhotoField
              name="image"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            />
          </div>

          <button
            type="submit"
            formAction={setCoverImage}
            className={`mt-3 ${SECONDARY}`}
          >
            대표 사진으로 세우기
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            누르면 <strong>쓰던 글이 먼저 저장</strong>됩니다. 사진 주소에는
            추측할 수 없는 이름이 붙습니다.
          </p>
        </fieldset>

        <label className="block text-sm">
          <span className="font-medium">게시 시각 (KST)</span>
          <span className="ml-2 text-xs text-muted-foreground">
            비우면 초안 — 아무에게도 안 보인다
          </span>
          <input
            type="datetime-local"
            name="publishAt"
            defaultValue={
              post.publishAt === null ? '' : instantToKstLocal(post.publishAt)
            }
            className={FIELD}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button type="submit" className={PRIMARY}>
            저장
          </button>
          <button type="submit" formAction={publishNow} className={SECONDARY}>
            지금 내기
          </button>
          {!isNew && (
            // **새 창으로 연다**(2026-09-10 사용자 신고). 같은 창에서 열면
            // 저장하지 않은 글이 날아간다 — 편집기는 쓰던 글을 브라우저에만
            // 들고 있다. 새 창에는 마지막으로 저장한 글이 보인다.
            <Link
              href={`/admin/posts/${post.id}/preview`}
              target="_blank"
              rel="noopener noreferrer"
              title="새 창에서 마지막으로 저장한 글을 봅니다"
              className={`inline-flex items-center gap-1.5 ${SECONDARY}`}
            >
              <EyeIcon className="size-4" aria-hidden />
              미리보기
            </Link>
          )}
        </div>
      </form>

      {/* 저장 안 한 글을 두고 떠나기 전에 묻는다(IDE-036). **저장에 성공했을
          때만** 처음 값을 새로 찍는다 — 실패(`error`)에 찍으면 저장 안 된 글이
          "바뀌지 않음"이 되어 보호가 풀린다. */}
      <UnsavedGuard
        formId="post-form"
        version={error ? null : `${post.updatedAt}:${saved ?? ''}`}
      />

      {!isNew && <ExportSection post={post} />}
    </div>
  );
}

/**
 * SNS 로 내보내기 (IDE-034)
 *
 * **열린 글에서만** 칸을 연다. 안 낸 글의 링크는 404 라, 올려 두면 누른 사람이
 * 전부 빈 화면을 본다. 판정은 공개 화면과 같은 `isPublished` 에게 묻는다.
 *
 * 문구는 **마지막으로 저장한 글**로 만든다 — 편집기에서 고치는 중인 제목은
 * 아직 이 서버에 없다.
 */
function ExportSection({ post }: { post: Post }) {
  const closed = post.hidden
    ? '내려 둔 글입니다. 다시 올린 뒤에 내보낼 수 있습니다.'
    : post.publishAt === null
      ? '아직 안 낸 글입니다. 낸 뒤에 열립니다.'
      : !isPublished(post)
        ? `${instantToKstLocal(post.publishAt).replace('T', ' ')}(KST)에 공개된 뒤에 열립니다.`
        : null;

  return (
    <section aria-labelledby="sns-export" className="mt-10 border-t pt-6">
      <h2 id="sns-export" className="text-xl font-bold tracking-tight">
        SNS 로 내보내기
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        플랫폼마다 문구와 링크를 맞춰 두었습니다. 링크에는 출처가 붙어 방문
        통계의
        <strong> 소셜</strong> 칸에 플랫폼별로 잡힙니다. 마지막으로 저장한 글
        기준입니다.
      </p>

      {closed ? (
        <p className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
          {closed}
        </p>
      ) : (
        <SnsExport
          origin={siteUrl()}
          slug={post.slug}
          title={post.title}
          summary={postSummary(post)}
          coverUrl={post.coverUrl}
        />
      )}
    </section>
  );
}
