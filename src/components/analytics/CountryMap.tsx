import world from '@/assets/shared/world-countries.json' with { type: 'json' };
import type { CountryTotal } from '@/lib/analytics/report';
import {
  binBreaks,
  binLabel,
  binOf,
  countryName,
  rampStep,
} from '@/lib/analytics/countryScale';
import { MapHover } from './MapHover';

/**
 * 나라별 방문 지도 (방문 통계 지도)
 *
 * 나라를 **세션 수**로 칠한다. "어디서 접근하나"는 몇 번 들어왔냐는 질문이라
 * 페이지뷰(한 번 와서 많이 본 사람이 부풀린다)보다 세션이 맞다.
 *
 * 색은 한 색상(사이트 주색인 벽돌색)의 명도 다섯 단계다 — 많을수록 진하다.
 * 라이트·다크 각각 배경에 대해 따로 잡았고, 어두운 화면에서는 많을수록
 * **밝다**(배경에서 멀어지는 쪽이 "많다"). 가장 옅은 단계도 배경과 2:1 을
 * 넘겨 방문 하나짜리 나라가 묻히지 않는다. 방문이 없는 땅은 그보다 옅은
 * 중립색이라 "0"과 "1"이 섞이지 않는다.
 *
 * 너무 작아 면으로 안 보이는 나라(싱가포르·홍콩…)는 방문이 있을 때만 점으로
 * 찍는다 — 없는 나라까지 찍으면 섬나라 점 쉰 개가 지도를 덮는다.
 */

/** 램프 다섯 단계. 클래스 이름이 소스에 그대로 있어야 Tailwind 가 만든다. */
const RAMP = [
  'fill-[#de9574] dark:fill-[#7f472f]',
  'fill-[#ce734f] dark:fill-[#a55d3c]',
  'fill-[#b85331] dark:fill-[#c6764d]',
  'fill-[#993c23] dark:fill-[#e39365]',
  'fill-[#762a1b] dark:fill-[#f8b78b]',
] as const;
const RAMP_SWATCH = [
  'bg-[#de9574] dark:bg-[#7f472f]',
  'bg-[#ce734f] dark:bg-[#a55d3c]',
  'bg-[#b85331] dark:bg-[#c6764d]',
  'bg-[#993c23] dark:bg-[#e39365]',
  'bg-[#762a1b] dark:bg-[#f8b78b]',
] as const;
const NO_DATA = 'fill-[#e3dbce] dark:fill-[#3d332b]';
const NO_DATA_SWATCH = 'bg-[#e3dbce] dark:bg-[#3d332b]';

type Shape = { code: string; d: string; dot?: readonly number[] };
const SHAPES = world.countries as Shape[];

const fmt = (n: number) => n.toLocaleString('ko-KR');

export function CountryMap({ countries }: { countries: CountryTotal[] }) {
  const sessionsOf = new Map(
    countries.filter((c) => c.country).map((c) => [c.country, c.sessions]),
  );
  const breaks = binBreaks(Math.max(0, ...sessionsOf.values()));
  const fillOf = (sessions: number) => {
    const bin = binOf(sessions, breaks);
    return bin < 0 ? NO_DATA : RAMP[rampStep(bin, breaks.length)];
  };
  const top = countries
    .filter((c) => c.country && c.sessions > 0)
    .slice(0, 3)
    .map((c) => `${countryName(c.country)} ${fmt(c.sessions)}`)
    .join(', ');

  return (
    <figure className="mt-4">
      <MapHover>
        <svg
          viewBox={`0 0 ${world.width} ${world.height}`}
          className="h-auto w-full"
          role="img"
          aria-label={
            top
              ? `나라별 방문 지도. 많은 순서로 ${top}. 전체 숫자는 아래 표에 있습니다.`
              : '나라별 방문 지도. 이 기간에는 나라를 알 수 있는 방문이 없습니다.'
          }
        >
          {SHAPES.filter((shape) => shape.d).map((shape, index) => {
            const sessions = sessionsOf.get(shape.code) ?? 0;
            return (
              <path
                key={shape.code || `unnamed-${index}`}
                d={shape.d}
                // 나라 사이 경계는 배경색 실선이다 — 테두리를 긋는 대신 면과
                // 면 사이를 벌려 놓는다. 가리키면 경계가 글자색으로 선다.
                className={`${fillOf(sessions)} stroke-background outline-none [stroke-width:0.6] hover:stroke-foreground focus-visible:stroke-foreground`}
                {...(shape.code && {
                  'data-name': countryName(shape.code),
                  'data-value': sessions
                    ? `방문 ${fmt(sessions)}`
                    : '방문 없음',
                })}
                {...(sessions > 0 && {
                  tabIndex: 0,
                  'aria-label': `${countryName(shape.code)} 방문 ${fmt(sessions)}`,
                })}
              />
            );
          })}
          {SHAPES.filter(
            (shape) => shape.dot && (sessionsOf.get(shape.code) ?? 0) > 0,
          ).map((shape) => {
            const sessions = sessionsOf.get(shape.code)!;
            return (
              <circle
                key={`dot-${shape.code}`}
                cx={shape.dot![0]}
                cy={shape.dot![1]}
                r={4.5}
                // 이웃 나라 면 위에 겹쳐 찍히므로 배경색 테두리로 떼어 놓는다.
                className={`${fillOf(sessions)} stroke-background outline-none [stroke-width:1.5] hover:stroke-foreground focus-visible:stroke-foreground`}
                data-name={countryName(shape.code)}
                data-value={`방문 ${fmt(sessions)}`}
                tabIndex={0}
                aria-label={`${countryName(shape.code)} 방문 ${fmt(sessions)}`}
              />
            );
          })}
        </svg>
      </MapHover>

      {/* 범례 — 칸마다 색 조각과 세션 범위. 글자는 색을 입지 않는다. */}
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">세션</span>
        {breaks.map((_, bin) => (
          <span key={bin} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={`size-3 rounded-xs ${RAMP_SWATCH[rampStep(bin, breaks.length)]}`}
            />
            <span className="tabular-nums">{binLabel(bin, breaks)}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`size-3 rounded-xs ${NO_DATA_SWATCH}`} />
          방문 없음
        </span>
      </figcaption>
    </figure>
  );
}
