import { GameCard } from '@/components/GameCard';
import { GAMES } from '@/lib/games';

/**
 * 게임 목록 — 방문자가 어떤 종이 게임이 있는지 보고 고르는 입구다 (IDE-005).
 *
 * `GAMES`(등록소)만 읽는다. 새 게임은 도안을 등록소에 더하면 여기 자동으로
 * 나타난다 — 이 파일은 게임이 늘어도 손대지 않는다.
 */
export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        종이 보드게임 고르기
      </h1>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">
        마음에 드는 게임을 골라 등번호·팀 이름·색을 원하는 대로 바꾸고, 집
        프린터로 원하는 크기에 맞춰 뽑는다.
      </p>

      {GAMES.length === 0 ? (
        <p className="mt-8 text-zinc-500">아직 등록된 게임이 없다.</p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </ul>
      )}
    </div>
  );
}
