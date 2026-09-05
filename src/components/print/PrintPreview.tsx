'use client';

import {
  BoardPreview,
  type BoardPreviewProps,
} from '@/components/editor/BoardPreview';
import type { TilePlan } from '@/lib/print/tile';

/**
 * 인쇄 미리보기 — 에디터와 같은 그림 위에 **타일 경계**를 얹는다 (IDE-007)
 *
 * 도안 자체는 `BoardPreview`가 그린다. 인쇄 화면이 따로 그리면 미리보기와
 * 인쇄물이 어긋날 자리가 하나 더 생긴다.
 *
 * 경계선은 파트 로컬 좌표로 그린다 — 타일 계획은 배율을 적용한 mm를 쓰므로
 * 배율로 나눠 되돌린다. 그래서 배율을 바꿔도 미리보기 상자 크기는 그대로이고
 * **몇 장으로 쪼개지는지만** 달라진다.
 */
export interface PrintPreviewProps extends Omit<
  BoardPreviewProps,
  'interactive'
> {
  plan: TilePlan;
  scale: number;
}

export function PrintPreview({ plan, scale, ...preview }: PrintPreviewProps) {
  const { part } = preview;
  const toLocal = (mm: number) => mm / scale;
  const strokeMm = 0.6 / scale;

  return (
    <div className="relative">
      <BoardPreview {...preview} interactive={false} />
      <svg
        viewBox={`0 0 ${part.widthMm} ${part.heightMm}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        {plan.tiles.map((tile) => {
          const x = toLocal(tile.srcXMm);
          const y = toLocal(tile.srcYMm);
          const w = toLocal(tile.srcWMm);
          const h = toLocal(tile.srcHMm);
          return (
            <g key={tile.index}>
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                fill="none"
                stroke="#dc2626"
                strokeWidth={strokeMm}
                strokeDasharray={`${3 / scale} ${2 / scale}`}
              />
              {plan.total > 1 && (
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  fontSize={Math.min(w, h) * 0.28}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#dc2626"
                  fillOpacity={0.35}
                  fontWeight={700}
                >
                  {tile.index}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
