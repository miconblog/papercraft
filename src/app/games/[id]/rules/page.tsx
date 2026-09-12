import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/BackLink';
import { gameIds, getGame } from '@/lib/games';
import { groupRuleSections, type RuleBody } from '@/lib/schema';
import {
  ORIENTATION_LABEL,
  PART_KIND_LABEL,
  SUPPORTED_PAPER_SIZE,
  boardOf,
  formatPlayers,
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
    title: `${game.title} 게임 방법`,
    description: game.tagline,
    openGraph: {
      title: game.title,
      description: game.tagline,
    },
  };
}

/**
 * 게임 소개와 게임 방법 (IDE-005)
 *
 * 2026-09-12까지 이 화면이 `/games/<id>`였다. 카탈로그에서 게임을 누르면
 * 여기로 왔고 "만들기"를 한 번 더 눌러야 편집으로 갔는데, 고르고 나서 하고
 * 싶은 일이 늘 만들기라 두 번 누르는 것이 불편하다는 사용자 지적이 있었다.
 * 그래서 `/games/<id>`는 만들기 화면이 되고 소개·규칙은 이 주소로 옮겼다.
 */
export default async function GameRulesPage({ params }: Props) {
  const { id } = await params;
  const game = getGame(id);
  if (!game) notFound();

  const board = boardOf(game);
  const accessories = game.parts.filter((p) => p.kind !== 'board');
  const sections = groupRuleSections(game.rules);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      {/* 좌상단은 **왔던 곳으로** 돌아간다(2026-09-12 사용자 요청). 이 화면에
          오는 길이 카탈로그 하나가 아니라 만들기 화면에서도 생겼으므로
          "목록으로"는 거짓이 됐다.

          만들기 버튼과 히어로 도안 그림은 뺐다(같은 날). 여기는 읽는 자리고,
          만들기로 가는 문은 왔던 화면이 이미 쥐고 있다. */}
      <BackLink fallbackHref="/" />

      <h1 className="mt-6 text-3xl font-bold tracking-tight">{game.title}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{game.tagline}</p>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex gap-1">
          <dt className="font-medium">인원</dt>
          <dd className="text-muted-foreground">
            {formatPlayers(game.players)}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">지원 용지</dt>
          <dd className="text-muted-foreground">{SUPPORTED_PAPER_SIZE}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="font-medium">준비물</dt>
          <dd className="text-muted-foreground">{game.supplies.join(' · ')}</dd>
        </div>
      </dl>

      <p className="mt-6 leading-7 text-foreground/85">{game.description}</p>

      {/* 규칙은 인쇄물이 아니라 여기서 읽는다 — 게임 방법 카드를 출력물에서
          뺐다(2026-09-05). 무엇을 뽑을지(구성)보다 어떻게 노는지가 먼저 궁금한
          정보라 위에 둔다. */}
      {sections.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">게임 방법</h2>
          <div className="mt-3 space-y-5 rounded-lg border border-border p-4">
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
                      className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-foreground/85"
                    >
                      {run.texts.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ol>
                  ) : (
                    <ul
                      key={j}
                      className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-foreground/85"
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
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {[board, ...accessories].map((part) => (
            <li key={part.id} className="p-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{part.title}</span>
                <span className="text-muted-foreground">
                  {PART_KIND_LABEL[part.kind]}
                </span>
              </div>
              <div className="mt-1 text-muted-foreground">
                배율 100%에서 {part.widthMm}×{part.heightMm}mm ·{' '}
                {ORIENTATION_LABEL[part.orientation]}
                {/* 변형이 있는 파트(세계일주 게임판의 도시 수)는 고르는 값에
                    따라 크기가 달라진다 — 기본값만 적으면 거짓말이 된다. */}
                {part.variants && (
                  <>
                    {' '}
                    · 만들기에서 고르는 값에 따라{' '}
                    {[
                      ...new Set(
                        part.variants.options.map(
                          (o) => `${o.widthMm}×${o.heightMm}mm`,
                        ),
                      ),
                    ].join(' / ')}
                  </>
                )}
              </div>
              {part.description && (
                <p className="mt-1 text-muted-foreground">{part.description}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
