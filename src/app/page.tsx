import Image from 'next/image';
import Link from 'next/link';
import {
  BabyIcon,
  HandshakeIcon,
  HeartIcon,
  PaletteIcon,
  PrinterIcon,
  ScissorsIcon,
} from 'lucide-react';
import { GameCard } from '@/components/GameCard';
import { GAMES } from '@/lib/games';
import { boardOf } from '@/lib/games/format';
import { formatPlayers, SUPPORTED_PAPER_SIZE } from '@/lib/games/format';

/**
 * 랜딩 — 처음 온 사람에게 이게 무엇이고 왜 만드는지를 먼저 말한다 (IDE-005).
 *
 * 히어로 → 왜 하는지 → 만드는 순서 → 게임 목록. 목록은 여전히 `GAMES`(등록소)만
 * 읽으므로 게임이 늘어도 이 파일은 손대지 않는다. 히어로에 세우는 그림도
 * 등록소의 첫 게임을 그대로 쓴다 — 여기에 게임 이름을 적어 두지 않는다.
 */

/** 부모에게 하는 약속. 문구는 사용자가 직접 정했다(2026-09-07). */
const VALUES = [
  {
    icon: HeartIcon,
    title: '추억을 쌓아요',
    body: '아빠가 공책 뒤에 그려 놀던 그 게임 그대로다. 아이와 함께 놀면서 추억을 쌓을 수 있어요.',
  },
  {
    icon: BabyIcon,
    title: '글자를 몰라도 괜찮아요',
    body: '아직 한글과 숫자를 익히지 못한 아이들에게 자연스레 숫자를 쓰고, 글자를 그려 볼 기회를 주세요.',
  },
  {
    icon: HandshakeIcon,
    title: '규칙을 배울 수 있어요',
    body: '놀면서 게임 규칙을 익히고 받아들이는 능력을 키울 수 있어요.',
  },
] as const;

/** 실제 화면 흐름과 같은 순서다 — 상세 → 만들기 → 출력. */
const STEPS = [
  {
    icon: PaletteIcon,
    title: '고르고 꾸미기',
    body: '게임을 고르고 팀 색·이름·선수 자리를 아이와 함께 정한다.',
  },
  {
    icon: PrinterIcon,
    title: `${SUPPORTED_PAPER_SIZE}에 뽑기`,
    body: '집 프린터로 배율 100%에 맞춰 뽑는다. 크게 뽑으면 여러 장에 나눠 나온다.',
  },
  {
    icon: ScissorsIcon,
    title: '오리고 놀기',
    body: '오림선을 따라 자르고 접어 세우면 오늘 저녁 놀이가 된다.',
  },
] as const;

export default function Home() {
  // 히어로에 세울 그림. 등록소가 비어 있어도 페이지는 서야 한다.
  const featured = GAMES[0];

  return (
    <div className="w-full">
      <section className="border-b border-border">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-retro-teal/40 bg-popover px-3 py-1 text-xs font-medium text-retro-teal">
              <ScissorsIcon className="size-3.5" aria-hidden />집 프린터로 뽑아
              만드는 종이 보드게임
            </p>
            <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
              아들! 축구 한판 할까?
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              어릴쩍 연필로 공을 튕겨 골을 넣던 바로 그 놀이. 팀 색과 선수
              자리를 아이와 함께 고르고, 원하는 크기에 맞춰 뽑으면 종이 한 장이
              게임판이 됩니다.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#games"
                className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors outline-none hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
              >
                게임 고르기
              </a>
              {featured && (
                <Link
                  href={`/games/${featured.id}/edit`}
                  className="inline-flex items-center justify-center rounded-full border border-border-strong bg-popover px-6 py-3 text-sm font-medium transition-colors outline-none hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  바로 만들어 보기
                </Link>
              )}
            </div>

            {featured && (
              <dl className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <div className="flex gap-1.5">
                  <dt className="font-medium text-foreground">인원</dt>
                  <dd>{formatPlayers(featured.players)}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="font-medium text-foreground">용지</dt>
                  <dd>{SUPPORTED_PAPER_SIZE} · 배율 100%가 원본 크기</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="font-medium text-foreground">준비물</dt>
                  <dd>{featured.supplies.join(' · ')}</dd>
                </div>
              </dl>
            )}
          </div>

          {/* 도안 한 장을 종이처럼 세워 둔다. 장식이라 링크도 대체 텍스트도 없다
              — 같은 그림이 아래 목록 카드에 이름과 함께 다시 나온다. */}
          {featured && (
            <div
              aria-hidden
              className="relative mx-auto w-full max-w-md rotate-1 rounded-lg border border-border-strong bg-paper p-2 shadow-[10px_10px_0_var(--retro-brick)] lg:max-w-none"
            >
              <Image
                src={featured.thumbnail}
                alt=""
                width={boardOf(featured).widthMm}
                height={boardOf(featured).heightMm}
                priority
                className="h-auto w-full rounded-sm"
              />
            </div>
          )}
        </div>
      </section>

      <section className="border-b border-border bg-secondary/50">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            아이와 함께
          </h2>
          <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="rounded-lg border border-border-strong bg-popover p-5 shadow-[5px_5px_0_var(--border-strong)]"
              >
                <span className="inline-flex size-9 items-center justify-center rounded-full border border-retro-brick/25 bg-accent text-retro-brick">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-14">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            만드는 순서
          </h2>
          <ol className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className="flex gap-3 rounded-lg border border-border-strong bg-popover p-5 shadow-[5px_5px_0_var(--border-strong)]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground tabular-nums">
                  {i + 1}
                </span>
                <div>
                  <h3 className="flex items-center gap-1.5 font-semibold">
                    <Icon className="size-4 text-retro-teal" aria-hidden />
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="games"
        className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-14"
      >
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
          종이 보드게임 고르기
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          마음에 드는 게임을 골라 팀 색과 선수 배치를 원하는 대로 바꾸고, 집
          프린터로 원하는 크기에 맞춰 뽑는다.
        </p>

        {GAMES.length === 0 ? (
          <p className="mt-8 text-muted-foreground">아직 등록된 게임이 없다.</p>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {GAMES.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
