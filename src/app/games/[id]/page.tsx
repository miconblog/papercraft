import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { gameIds, getGame } from '@/lib/games';
import { groupRuleSections, type RuleBody } from '@/lib/schema';
import {
  formatPlayers,
  ORIENTATION_LABEL,
  PART_KIND_LABEL,
  SUPPORTED_PAPER_SIZE,
} from '@/lib/games/format';

type Params = { id: string };
type Props = { params: Promise<Params> };

/**
 * 같은 종류가 잇달아 오는 만큼씩 끊는다.
 *
 * 한 절에 번호 있는 항목(`step`)과 없는 항목(`bullet`)이 섞이는데 — 축구
 * 게임판의 "차리기"가 그렇다 — 하나의 `ol`에 몰아넣으면 점 항목까지 번호를
 * 먹거나 번호가 건너뛴다.
 */
function groupRuns(
  blocks: readonly RuleBody[],
): { kind: RuleBody['kind']; texts: string[] }[] {
  const runs: { kind: RuleBody['kind']; texts: string[] }[] = [];
  for (const block of blocks) {
    const last = runs.at(-1);
    if (last?.kind === block.kind) last.texts.push(block.text);
    else runs.push({ kind: block.kind, texts: [block.text] });
  }
  return runs;
}

/** 게임마다 하나씩 빌드 시점에 정적 생성한다 — 등록소에 게임을 더하면 이
 * 목록도 같이 늘어난다(IDE-005 수용 기준: 페이지가 자동으로 생긴다). */
export function generateStaticParams(): Params[] {
  return gameIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = getGame(id);
  if (!game) return {};

  return {
    title: game.title,
    description: game.tagline,
    openGraph: {
      title: game.title,
      description: game.tagline,
    },
  };
}

export default async function GamePage({ params }: Props) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  const board = game.parts.find((p) => p.kind === 'board')!;
  const accessories = game.parts.filter((p) => p.kind !== 'board');
  const sections = groupRuleSections(game.rules);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
      >
        ← 목록으로
      </Link>

      <div className="mt-4 overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/15">
        <Image
          src={game.thumbnail}
          alt={`${game.title} 도안 미리보기`}
          width={board.widthMm}
          height={board.heightMm}
          className="h-auto w-full"
        />
      </div>

      <h1 className="mt-6 text-3xl font-bold tracking-tight">{game.title}</h1>
      <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
        {game.tagline}
      </p>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex gap-1">
          <dt className="font-medium">인원</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {formatPlayers(game.players)}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">지원 용지</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {SUPPORTED_PAPER_SIZE}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">준비물</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {game.supplies.join(' · ')}
          </dd>
        </div>
      </dl>

      <p className="mt-6 leading-7 text-zinc-700 dark:text-zinc-300">
        {game.description}
      </p>

      {/* 규칙은 인쇄물이 아니라 여기서 읽는다 — 게임 방법 카드를 출력물에서
          뺐다(2026-09-05). 무엇을 뽑을지(구성)보다 어떻게 노는지가 먼저 궁금한
          정보라 위에 둔다. */}
      {sections.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">게임 방법</h2>
          <div className="mt-3 space-y-5 rounded-lg border border-black/10 p-4 dark:border-white/15">
            {sections.map((section, i) => (
              <div key={section.heading ?? `intro-${i}`}>
                {section.heading && (
                  <h3 className="text-sm font-semibold">{section.heading}</h3>
                )}
                {/* 번호 있는 항목과 없는 항목이 한 절에 섞일 수 있어 목록을
                    나눠 그린다 — `ol`에 점 항목을 넣으면 번호가 건너뛴다. */}
                {groupRuns(section.blocks).map((run, j) =>
                  run.kind === 'step' ? (
                    <ol
                      key={j}
                      className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
                    >
                      {run.texts.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ol>
                  ) : (
                    <ul
                      key={j}
                      className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
                    >
                      {run.texts.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">구성</h2>
        <ul className="mt-3 divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/15">
          {[board, ...accessories].map((part) => (
            <li key={part.id} className="p-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{part.title}</span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {PART_KIND_LABEL[part.kind]}
                </span>
              </div>
              <div className="mt-1 text-zinc-500 dark:text-zinc-400">
                배율 100%에서 {part.widthMm}×{part.heightMm}mm ·{' '}
                {ORIENTATION_LABEL[part.orientation]}
              </div>
              {part.description && (
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {part.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/games/${game.id}/edit`}
          className="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          만들기 시작
        </Link>
        {/* 바꿀 것이 없어도 바로 뽑을 수 있어야 한다 — 기본값으로도 쓸 만한 도안이다. */}
        <Link
          href={`/games/${game.id}/print`}
          className="inline-flex items-center justify-center rounded-full border border-black/15 px-6 py-3 font-medium transition-colors hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
        >
          바로 인쇄하기
        </Link>
      </div>
    </div>
  );
}
