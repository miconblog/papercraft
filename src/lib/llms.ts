/**
 * AI 에게 주는 사이트 안내서 — `/llms.txt` · `/llms-full.txt` (IDE-041)
 *
 * AI 검색 최적화의 셋째 단계(사용자 결정 2026-09-19, 가 → 나 → 다). AI 가 이
 * 사이트를 읽을 때 화면(자바스크립트 · 편집기 · 인쇄 모달)을 헤치지 않고 **무엇이
 * 있는지를 한 번에** 알게 한다. 형식은 llmstxt.org 의 제안(마크다운 — 제목, 인용
 * 한 줄 요약, `##` 절마다 링크 목록)을 따른다.
 *
 * **아직 표준이 아니다.** 어느 AI 가 이 파일을 읽는지 공식으로 밝힌 곳은 드물다.
 * 만드는 값이 작아서 두지만, 효과는 `IDE-040` 의 크롤러 표에서 이 경로가 읽히는지로
 * 본다.
 *
 * 내용은 **게임 정의와 공개된 글에서만** 만든다 — 사이트맵과 같은 공개 필터
 * (`openGames` · `publishedPosts`)를 부르는 쪽이 거친다. 오픈 전 게임 · 안 낸 글이
 * 여기로 새면 문지기가 막아 둔 것을 AI 에게 알려 주는 셈이다.
 *
 * 순수 함수만 둔다 — 경로와 시험이 같은 것을 본다.
 */
import type { Doc } from '@/lib/blog/doc';
import { docText } from '@/lib/blog/doc';
import { groupRuleSections, type GameDefinition } from '@/lib/schema';
import {
  BLOG_DESCRIPTION,
  BLOG_TITLE,
  SITE_DESCRIPTION,
  SITE_TITLE,
} from '@/lib/site';

export type LlmsPost = {
  slug: string;
  title: string;
  summary: string;
  doc: Doc;
};

export type LlmsInput = {
  origin: string;
  games: readonly GameDefinition[];
  posts: readonly LlmsPost[];
};

const clean = (origin: string): string => origin.replace(/\/+$/, '');

/** 줄바꿈 · 대괄호가 링크 문법을 깨지 않게. */
const oneLine = (text: string): string =>
  text.replace(/\s+/g, ' ').replace(/[[\]]/g, '').trim();

const players = (game: GameDefinition): string =>
  game.players.min === game.players.max
    ? `${game.players.min}명`
    : `${game.players.min}~${game.players.max}명`;

/** 사이트가 무엇인지 — 두 파일의 머리가 같다. */
const header = (): string[] => [
  `# ${SITE_TITLE}`,
  '',
  `> ${SITE_DESCRIPTION}`,
  '',
  '- 모든 도안은 무료이고 회원 가입 없이 쓴다.',
  '- 배율 100% 에서 게임판이 A4 한 장이다. 크게 키우면 A4 여러 장으로 나눠 뽑아 이어 붙인다.',
  '- 팀 색 · 이름 · 배치를 화면에서 바꾼 뒤 PDF 로 내려받아 집 프린터로 뽑는다.',
  '- 한국어 사이트다. 아이와 함께 만들고 노는 부모가 주로 쓴다.',
];

/** `/llms.txt` — 목차. 짧게 둔다. */
export function renderLlms({ origin, games, posts }: LlmsInput): string {
  const base = clean(origin);
  const lines = [...header(), '', '## 게임', ''];
  for (const game of games) {
    lines.push(
      `- [${oneLine(game.title)}](${base}/games/${game.id}): ${oneLine(game.tagline)} (${players(game)})`,
    );
  }

  lines.push('', '## 게임 방법', '');
  for (const game of games) {
    lines.push(
      `- [${oneLine(game.title)} 게임 방법](${base}/games/${game.id}/rules): 준비물과 규칙`,
    );
  }

  if (posts.length > 0) {
    lines.push('', `## ${BLOG_TITLE}`, '', `> ${BLOG_DESCRIPTION}`, '');
    for (const post of posts) {
      const summary = oneLine(post.summary || docText(post.doc));
      lines.push(
        `- [${oneLine(post.title)}](${base}/blog/${post.slug})${summary ? `: ${summary}` : ''}`,
      );
    }
  }

  lines.push(
    '',
    '## Optional',
    '',
    `- [전체 내용](${base}/llms-full.txt): 게임마다 소개 · 인원 · 준비물 · 규칙 전문`,
    `- [사이트맵](${base}/sitemap.xml)`,
    `- [${BLOG_TITLE} RSS](${base}/feed.xml)`,
  );
  return `${lines.join('\n')}\n`;
}

/** `/llms-full.txt` — 게임마다 규칙 전문까지. AI 가 화면을 돌리지 않고 답할 수 있게. */
export function renderLlmsFull({ origin, games, posts }: LlmsInput): string {
  const base = clean(origin);
  const lines = [...header()];

  for (const game of games) {
    lines.push(
      '',
      `## ${oneLine(game.title)}`,
      '',
      `- 만들기: ${base}/games/${game.id}`,
      `- 게임 방법: ${base}/games/${game.id}/rules`,
      `- 인원: ${players(game)}`,
      `- 준비물: 인쇄한 도안, ${game.supplies.map(oneLine).join(', ')}`,
      '',
      game.description.trim(),
    );

    for (const section of groupRuleSections(game.rules)) {
      lines.push('', `### ${section.heading ?? '규칙'}`, '');
      let step = 0;
      for (const block of section.blocks) {
        lines.push(
          block.kind === 'step'
            ? `${(step += 1)}. ${oneLine(block.text)}`
            : `- ${oneLine(block.text)}`,
        );
      }
    }
  }

  if (posts.length > 0) {
    lines.push('', `## ${BLOG_TITLE}`);
    for (const post of posts) {
      const summary = oneLine(post.summary || docText(post.doc, 400));
      lines.push(
        '',
        `### ${oneLine(post.title)}`,
        '',
        `${base}/blog/${post.slug}`,
        ...(summary ? ['', summary] : []),
      );
    }
  }

  return `${lines.join('\n')}\n`;
}
