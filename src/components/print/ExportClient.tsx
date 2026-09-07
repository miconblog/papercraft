'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  defaultCustomization,
  type GameCustomization,
  type GameDefinition,
} from '@/lib/schema';
import { useHydrated } from '@/lib/customization/useHydrated';
import { useStoredCustomization } from '@/lib/customization/useStoredCustomization';
import { PRINT_SETTINGS } from '@/lib/print/settings';
import {
  DEFAULT_PRINTER_MARGIN_MM,
  MAX_PRINTER_MARGIN_MM,
  MIN_PRINTER_MARGIN_MM,
} from '@/lib/print/geometry';
import {
  defaultSelection,
  validateExportOptions,
  type ExportOptions,
  type PartSelection,
} from '@/lib/print/options';
import { planTiles, type TilePlan } from '@/lib/print/tile';
import { PartOptionsRow } from './PartOptionsRow';
import { PrintPreview } from './PrintPreview';

/**
 * 내보내기 화면 (IDE-007)
 *
 * 에디터에서 만든 값은 브라우저에 저장돼 있다(IDE-006). 여기서는 그 값을 읽어
 * "무엇을 · 얼마나 크게 · 몇 벌" 세 가지만 고르게 한다.
 *
 * 장수는 **고르는 즉시** 보여 준다. 200%가 A4 여덟 장이라는 사실은 뽑기 전에
 * 알아야 하는 정보다(`docs/print-spec.md` §5).
 *
 * 에디터의 출력 모달(`PrintDialog`)도 이 화면을 그대로 쓴다(2026-09-06). 그때는
 * 저장값을 읽는 대신 에디터가 지금 들고 있는 값을 `customization`으로 받고,
 * `embedded`로 페이지 전용 문구(값의 출처·에디터 링크)를 뺀다.
 */
export function ExportClient({
  game,
  customization: given,
  embedded = false,
}: {
  game: GameDefinition;
  /** 뽑을 값. 주지 않으면 브라우저 저장값을 읽는다(인쇄 페이지). */
  customization?: GameCustomization;
  /** 모달 안에 들어간 모습 — 위 여백과 페이지 전용 문구를 뺀다. */
  embedded?: boolean;
}) {
  const hydrated = useHydrated();
  const stored = useStoredCustomization(game);
  const customization =
    given ?? (hydrated && stored ? stored : defaultCustomization(game));

  const [selections, setSelections] = useState<PartSelection[]>(() =>
    game.parts.map(defaultSelection),
  );
  const [marginMm, setMarginMm] = useState(DEFAULT_PRINTER_MARGIN_MM);
  const [previewPartId, setPreviewPartId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const options: ExportOptions = useMemo(
    () => ({ parts: selections, marginMm, overlapMm: 10 }),
    [selections, marginMm],
  );

  const plans = useMemo(() => {
    const result = new Map<string, TilePlan>();
    for (const selection of selections) {
      const part = game.parts.find((p) => p.id === selection.partId);
      if (!part) continue;
      try {
        result.set(
          part.id,
          planTiles({
            partWidthMm: part.widthMm * selection.scale,
            partHeightMm: part.heightMm * selection.scale,
            marginMm,
          }),
        );
      } catch {
        // 여백이 용지를 다 먹은 경우다. 아래 검증이 메시지를 낸다.
      }
    }
    return result;
  }, [game, selections, marginMm]);

  const issues = useMemo(
    () => (selections.length > 0 ? validateExportOptions(game, options) : []),
    [game, options, selections.length],
  );
  const blocked = issues.filter((i) => i.blocking);
  const totalPages = selections.reduce((sum, selection) => {
    const plan = plans.get(selection.partId);
    return sum + (plan ? plan.total * selection.copies : 0);
  }, 0);

  const toggle = (partId: string, on: boolean) =>
    setSelections((prev) => {
      if (!on) return prev.filter((s) => s.partId !== partId);
      if (prev.some((s) => s.partId === partId)) return prev;
      const part = game.parts.find((p) => p.id === partId);
      if (!part) return prev;
      // 도안이 선언한 순서를 유지한다 — PDF에 담기는 차례와 같아야 한다.
      const next = [...prev, defaultSelection(part)];
      const order = game.parts.map((p) => p.id);
      return next.sort(
        (a, b) => order.indexOf(a.partId) - order.indexOf(b.partId),
      );
    });

  const change = (partId: string, patch: Partial<PartSelection>) =>
    setSelections((prev) =>
      prev.map((s) => (s.partId === partId ? { ...s, ...patch } : s)),
    );

  const selectGroup = (kind: 'all' | 'board' | 'accessories') =>
    setSelections(
      game.parts
        .filter(
          (p) =>
            kind === 'all' ||
            (kind === 'board' ? p.kind === 'board' : p.kind !== 'board'),
        )
        .map(defaultSelection),
    );

  // 고른 파트만 미리 볼 수 있다. 고른 것이 사라지면 첫 파트로 되돌아간다.
  const previewable = game.parts.filter((p) =>
    selections.some((s) => s.partId === p.id),
  );
  const previewPart =
    previewable.find((p) => p.id === previewPartId) ?? previewable[0] ?? null;
  const previewSelection = previewPart
    ? selections.find((s) => s.partId === previewPart.id)
    : undefined;
  const previewPlan = previewPart ? plans.get(previewPart.id) : undefined;

  const download = async () => {
    setBusy(true);
    setErrors([]);
    try {
      const res = await fetch(`/api/games/${game.id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customization, options }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          messages?: string[];
        } | null;
        setErrors(body?.messages ?? ['PDF를 만들지 못했다']);
        return;
      }
      // 파일명은 서버가 정한다 — 규칙이 한 곳에만 있어야 어긋나지 않는다.
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filename =
        /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${game.id}.pdf`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrors(['PDF를 내려받지 못했다 — 잠시 뒤에 다시 시도한다']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={
        (embedded ? 'mt-5 ' : 'mt-8 ') +
        'grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]'
      }
    >
      <div>
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">무엇을 뽑을까</h2>
            <div className="flex gap-1.5">
              {(
                [
                  ['all', '전체'],
                  ['board', '게임판만'],
                  ['accessories', '부속만'],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => selectGroup(kind)}
                  className="rounded-full border border-border px-3 py-1 text-xs font-medium outline-none transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ul aria-label="뽑을 파트" className="mt-3 space-y-2">
            {game.parts.map((part) => (
              <PartOptionsRow
                key={part.id}
                part={part}
                selection={selections.find((s) => s.partId === part.id)}
                plan={plans.get(part.id) ?? null}
                marginMm={marginMm}
                blockingMessage={
                  blocked.find((i) => i.partId === part.id)?.message ?? null
                }
                warningMessage={
                  issues.find((i) => !i.blocking && i.partId === part.id)
                    ?.message ?? null
                }
                onToggle={toggle}
                onChange={change}
              />
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">프린터</h2>
          <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <label
                htmlFor="printer-margin"
                className="block text-xs font-medium"
              >
                인쇄 불가 여백
              </label>
              <div className="mt-1 flex items-center gap-1">
                <input
                  id="printer-margin"
                  type="number"
                  min={MIN_PRINTER_MARGIN_MM}
                  max={MAX_PRINTER_MARGIN_MM}
                  step={0.5}
                  value={marginMm}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (
                      Number.isFinite(next) &&
                      next >= MIN_PRINTER_MARGIN_MM &&
                      next <= MAX_PRINTER_MARGIN_MM
                    ) {
                      setMarginMm(next);
                    }
                  }}
                  className="w-20 rounded-md border border-border px-2 py-1 text-sm tabular-nums"
                />
                <span className="text-xs text-muted-foreground">mm</span>
              </div>
            </div>
            <p className="max-w-sm text-xs text-muted-foreground">
              가정용 프린터는 용지 가장자리에 인쇄하지 못한다. 기본값 0mm는
              가장자리까지 쓴다는 뜻이라, 내 프린터가 먹는 만큼 재서 올린다.{' '}
              <a
                href={`/api/print/probe?margin=${marginMm}`}
                className="underline underline-offset-2"
              >
                내 프린터 여백 재기 시트 →
              </a>
            </p>
          </div>
        </section>
      </div>

      {/* 미리보기는 위에 붙어 따라온다. 헤더도 상단 고정이라(53px) 그 아래로
          내려 잡는다 — top-8이면 제목 뒤로 숨는다. */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <h2 className="text-lg font-semibold">미리보기</h2>
        {previewPart && previewSelection && previewPlan ? (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              빨간 점선이 A4 한 장의 경계다
            </p>
            {previewable.length > 1 && (
              <div
                className="mt-2 flex flex-wrap gap-1.5"
                role="group"
                aria-label="미리 볼 파트 선택"
              >
                {previewable.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => setPreviewPartId(part.id)}
                    aria-pressed={part.id === previewPart.id}
                    className={
                      'rounded-full px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ' +
                      (part.id === previewPart.id
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border hover:border-primary')
                    }
                  >
                    {part.title}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2">
              <PrintPreview
                key={previewPart.id}
                game={game}
                part={previewPart}
                customization={customization}
                plan={previewPlan}
                scale={previewSelection.scale}
              />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            뽑을 파트를 하나 이상 고른다.
          </p>
        )}

        <div className="mt-5 rounded-lg border border-border p-4">
          <p className="text-sm">
            <span className="font-semibold">모두 A4 {totalPages}장</span>
          </p>
          <button
            type="button"
            onClick={download}
            disabled={busy || selections.length === 0 || blocked.length > 0}
            className="mt-3 w-full rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'PDF를 만드는 중…' : 'PDF 내려받기'}
          </button>
          {blocked.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-destructive">
              {blocked
                .filter((i) => i.partId === null)
                .map((issue) => (
                  <li key={issue.message}>{issue.message}</li>
                ))}
              {blocked.some((i) => i.partId !== null) && (
                <li>배율이 하한보다 작은 파트가 있다 — 왼쪽에서 고친다.</li>
              )}
            </ul>
          )}
          {errors.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-destructive">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>

        {/* 프린터의 자동 맞춤이 치수를 말없이 바꾼다(IDE-002 §8.2). 화면과
            인쇄물 양쪽에 같은 문구를 둔다. */}
        <div className="mt-4 rounded-lg border border-warning/45 bg-warning-surface/60 p-4 text-sm">
          <p className="font-semibold">배율 100%로 인쇄한다</p>
          <p className="mt-1 text-muted-foreground">
            PDF 뷰어의 인쇄 대화상자에서 아래를 확인한다. 하나라도 놓치면 치수가
            어긋난다.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {PRINT_SETTINGS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        {/* 모달에서는 값의 출처를 말할 필요가 없다 — 뒤에 보이는 판 그대로다. */}
        {!embedded && (
          <p className="mt-4 text-xs text-muted-foreground">
            {hydrated && stored
              ? '에디터에서 만든 값으로 뽑는다.'
              : '아직 만든 값이 없어 도안 기본값으로 뽑는다.'}{' '}
            <Link
              href={`/games/${game.id}/edit`}
              className="underline underline-offset-2"
            >
              에디터로 가기
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
