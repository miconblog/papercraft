'use client';

import { useId, useState } from 'react';
import { PART_KIND_LABEL } from '@/lib/games/format';
import type { Part } from '@/lib/schema';
import { fitToOnePageScale, scaleLabel } from '@/lib/print/geometry';
import { MAX_COPIES, MAX_SCALE, type PartSelection } from '@/lib/print/options';
import type { TilePlan } from '@/lib/print/tile';

/**
 * 파트 한 줄 — 뽑을지 · 배율 · 벌 수 (IDE-007)
 *
 * 파트마다 줄을 나눈 이유는 도안이 파트마다 다른 하한을 갖기 때문이다. 게임
 * 방법 별지는 본문이 3mm라 85% 아래로 못 내려가고, 운동장은 50%까지 내려간다
 * (`part.minScale`, IDE-004). 배율 하나를 전체에 강제하면 그 차이를 UI가
 * 거짓말하게 된다.
 */
export interface PartOptionsRowProps {
  part: Part;
  selection: PartSelection | undefined;
  plan: TilePlan | null;
  marginMm: number;
  blockingMessage: string | null;
  warningMessage: string | null;
  onToggle: (partId: string, on: boolean) => void;
  onChange: (partId: string, patch: Partial<PartSelection>) => void;
}

/** 프리셋 배율. `docs/print-spec.md` §2가 정한 세 개다. */
const SCALE_PRESETS = [0.5, 1, 2] as const;

const sizeText = (part: Part, scale: number) =>
  `${round(part.widthMm * scale)}×${round(part.heightMm * scale)}mm`;

const round = (v: number) => Math.round(v * 10) / 10;

const toPercent = (scale: number) => Math.round(scale * 1000) / 10;

/**
 * 숫자 칸 — 글자를 **로컬 상태로** 들고 있는다.
 *
 * 값을 곧장 바깥 상태에서 되받으면 칸을 비우는 순간 React가 이전 값을 되돌려
 * 놓아, 지우고 다시 치면 앞에 옛 숫자가 남는다(`100`을 지우고 `150`을 치면
 * `150100`이 된다). 그 숫자가 그대로 타일 계산에 들어가 수만 장짜리 계획이
 * 나온 적이 있다. 받아들일 수 있는 값일 때만 바깥에 알린다.
 */
function NumberField({
  id,
  label,
  initialValue,
  min,
  max,
  integer = false,
  invalid = false,
  onCommit,
}: {
  id: string;
  label: string;
  initialValue: number;
  min: number;
  max: number;
  integer?: boolean;
  invalid?: boolean;
  onCommit: (value: number) => void;
}) {
  const [text, setText] = useState(String(initialValue));
  return (
    <input
      id={id}
      type="number"
      min={min}
      max={max}
      step={1}
      value={text}
      aria-label={label}
      aria-invalid={invalid}
      onChange={(event) => {
        setText(event.target.value);
        const next = Number(event.target.value);
        if (
          Number.isFinite(next) &&
          next >= min &&
          next <= max &&
          (!integer || Number.isInteger(next))
        ) {
          onCommit(next);
        }
      }}
      onFocus={(event) => event.currentTarget.select()}
      className="w-20 rounded-md border border-black/15 px-2 py-1 text-sm tabular-nums dark:border-white/20 dark:bg-transparent"
    />
  );
}

export function PartOptionsRow({
  part,
  selection,
  plan,
  marginMm,
  blockingMessage,
  warningMessage,
  onToggle,
  onChange,
}: PartOptionsRowProps) {
  const id = useId();
  const [presetTick, setPresetTick] = useState(0);
  const on = selection !== undefined;
  const scale = selection?.scale ?? part.defaultScale;
  const copies = selection?.copies ?? part.defaultCopies;
  // "A4 한 장 맞춤"은 **줄여서** 한 장에 담는 선택지다(`docs/print-spec.md` §4).
  // 이미 한 장에 들어가는 부속까지 키워 채우면 도안이 뜻 없이 커지므로 숨긴다.
  const applyScale = (next: number) => {
    onChange(part.id, { scale: next });
    setPresetTick((tick) => tick + 1);
  };

  const fitScaleRaw = fitToOnePageScale(part.widthMm, part.heightMm, marginMm);
  const fitScale = Math.floor(fitScaleRaw * 100) / 100;
  const showFitPreset = fitScale < 1 && fitScale >= part.minScale;
  const isFullSize = Math.abs(scale - 1) < 1e-9;

  return (
    <li
      className={
        'rounded-lg border p-4 transition-colors ' +
        (on
          ? 'border-black/15 dark:border-white/20'
          : 'border-black/5 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]')
      }
    >
      <div className="flex items-start gap-3">
        <input
          id={`${id}-on`}
          type="checkbox"
          checked={on}
          onChange={(e) => onToggle(part.id, e.target.checked)}
          className="mt-1 size-4 accent-current"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-on`} className="font-medium">
            {part.title}
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {PART_KIND_LABEL[part.kind]} · 배율 100%에서 {sizeText(part, 1)}
          </p>
        </div>
        {on && plan && (
          <p className="shrink-0 text-right text-sm">
            <span className="font-semibold">A4 {plan.total}장</span>
            {copies > 1 && (
              <span className="text-zinc-500 dark:text-zinc-400">
                {' '}
                × {copies}벌
              </span>
            )}
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              {plan.cols}×{plan.rows} · {sizeText(part, scale)}
            </span>
          </p>
        )}
      </div>

      {on && (
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3 pl-7">
          <div>
            <span className="block text-xs font-medium">배율</span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {SCALE_PRESETS.filter((s) => s >= part.minScale).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={Math.abs(scale - preset) < 1e-9}
                  onClick={() => applyScale(preset)}
                  className={
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                    (Math.abs(scale - preset) < 1e-9
                      ? 'bg-foreground text-background'
                      : 'border border-black/15 hover:border-black/30 dark:border-white/20 dark:hover:border-white/40')
                  }
                >
                  {scaleLabel(preset)}
                </button>
              ))}
              {showFitPreset && (
                <button
                  type="button"
                  aria-pressed={Math.abs(scale - fitScale) < 1e-9}
                  onClick={() => applyScale(fitScale)}
                  className={
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                    (Math.abs(scale - fitScale) < 1e-9
                      ? 'bg-foreground text-background'
                      : 'border border-black/15 hover:border-black/30 dark:border-white/20 dark:hover:border-white/40')
                  }
                >
                  A4 한 장({scaleLabel(fitScale)})
                </button>
              )}
              <span className="ml-1 inline-flex items-center gap-1">
                <NumberField
                  // 프리셋을 누르면 입력 글자도 따라가야 한다. 값이 바뀔 때만
                  // 다시 마운트해 초기값을 새로 받는다 — 타이핑 중에는 그대로다.
                  key={presetTick}
                  id={`${id}-scale`}
                  label={`${part.title} 배율(%)`}
                  initialValue={toPercent(scale)}
                  min={1}
                  max={MAX_SCALE * 100}
                  invalid={blockingMessage !== null}
                  onCommit={(percent) =>
                    onChange(part.id, { scale: percent / 100 })
                  }
                />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  %
                </span>
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor={`${id}-copies`}
              className="block text-xs font-medium"
            >
              몇 벌
            </label>
            <div className="mt-1">
              <NumberField
                id={`${id}-copies`}
                label={`${part.title} 몇 벌`}
                initialValue={copies}
                min={1}
                max={MAX_COPIES}
                integer
                onCommit={(next) => onChange(part.id, { copies: next })}
              />
            </div>
          </div>
        </div>
      )}

      {/* 배율이 100%가 아니면 실측 치수가 달라진다는 사실을 화면에 분명히 적는다
          — 특히 "A4 한 장 맞춤"이 100%처럼 보이면 안 된다(print-spec §4). */}
      {on && !isFullSize && !blockingMessage && (
        <p className="mt-2 pl-7 text-xs text-zinc-500 dark:text-zinc-400">
          배율 {scaleLabel(scale)}는 원본 크기가 아니다 — 뽑히는 크기는{' '}
          {sizeText(part, scale)}다.
        </p>
      )}
      {on && blockingMessage && (
        <p className="mt-2 pl-7 text-sm text-red-600 dark:text-red-400">
          {blockingMessage}
        </p>
      )}
      {on && !blockingMessage && warningMessage && (
        <p className="mt-2 pl-7 text-sm text-amber-700 dark:text-amber-400">
          {warningMessage}
        </p>
      )}
    </li>
  );
}
