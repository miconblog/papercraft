'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  listEntryId,
  listEntryLabel,
  type ListEntry,
  type ListItem,
  type ListValue,
  type Part,
  type Slot,
  type SlotValue,
} from '@/lib/schema';

/**
 * 목록 슬롯 패널 — 켜고 끄고 차례를 바꾸고, 검색해서 더한다 (IDE-016 2단계)
 *
 * 세계일주의 도시 목록이 처음 쓴다. 왼쪽이 **경로**(켠 항목, 차례대로 번호가
 * 붙는다)이고 오른쪽이 **전체 목록**(묶음별 체크박스)이다. 켜면 전체 목록의
 * 차례에서 바로 앞에 켜져 있는 항목 뒤에 끼어든다 — 그래야 켜는 순간 길이 엉키지
 * 않는다. 차례는 끌어서, 또는 ▲▼ 버튼으로 바꾼다. 고정 항목(서울)은 끌 수
 * 없고 늘 맨 앞이다.
 *
 * 슬롯이 검색을 허용하면(`search`) 상자가 하나 더 붙는다 — 서버 제공자가 찾아
 * 준 것을 더하면 옵션이면 켜지고, 풀 밖의 것이면 이름·자료를 실은 항목이 목록
 * 끝(서울 앞)에 들어간다. 그런 항목은 오른쪽 목록의 "직접 추가" 묶음에 보인다.
 *
 * 이 컴포넌트는 게임을 모른다 — 슬롯의 `options`·`presets`·`fixed`·`search`만
 * 읽는다.
 */
export interface ListSlotPanelProps {
  slot: Extract<Slot, { kind: 'list' }>;
  value: SlotValue;
  error: string | null;
  /** 지금 값으로 푼 파트 — 크기 안내에 쓴다. */
  part: Part;
  gameId: string;
  onChange: (value: ListValue) => void;
}

interface SearchHit {
  id: string;
  label: string;
  detail: string;
  item?: ListItem;
}

const A4_AREA_MM2 = 210 * 297;

export function ListSlotPanel({
  slot,
  value,
  error,
  part,
  gameId,
  onChange,
}: ListSlotPanelProps) {
  const id = useId();
  // 값이 배열이라고 다 목록은 아니다 — 윤곽 슬롯의 좌표도 배열이다(IDE-019).
  // 이 패널이 그리는 것은 목록 슬롯뿐이므로 항목의 모양까지 확인하고 받는다.
  const selected: ListValue =
    Array.isArray(value) &&
    value.every(
      (entry) => typeof entry === 'string' || typeof entry === 'object',
    )
      ? (value as ListValue)
      : [];
  const selectedIds = selected.map(listEntryId);
  const selectedSet = new Set(selectedIds);
  const labelOf = (entry: ListEntry) => listEntryLabel(slot, entry);
  const isFixed = (entryId: string) => slot.fixed.includes(entryId);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  const sheets = Math.max(
    1,
    Math.round((part.widthMm * part.heightMm) / A4_AREA_MM2),
  );

  /** 옵션을 켠다 — 전체 목록 차례에서 바로 앞에 켜져 있는 항목 뒤에 끼어든다. */
  const turnOn = (optionId: string) => {
    if (selectedSet.has(optionId)) return;
    const order = slot.options.map((o) => o.value);
    const at = order.indexOf(optionId);
    let insertAfter = -1;
    for (let i = at - 1; i >= 0; i -= 1) {
      const index = selectedIds.indexOf(order[i]);
      if (index !== -1) {
        insertAfter = index;
        break;
      }
    }
    const next = [...selected];
    next.splice(insertAfter + 1, 0, optionId);
    onChange(next);
  };

  /** 직접 더한 항목 — 목록 끝에 붙는다. 서울 앞이 곧 끝이다. */
  const addCustom = (item: ListItem) => {
    if (selectedSet.has(item.id)) return;
    onChange([...selected, item]);
  };

  const turnOff = (entryId: string) => {
    if (isFixed(entryId)) return;
    onChange(selected.filter((entry) => listEntryId(entry) !== entryId));
  };

  const move = (entryId: string, to: number) => {
    const from = selectedIds.indexOf(entryId);
    if (from === -1 || isFixed(entryId)) return;
    const firstFree = selectedIds.findIndex((x) => !isFixed(x));
    const target = Math.max(firstFree, Math.min(selected.length - 1, to));
    if (target === from) return;
    const next = [...selected];
    const [entry] = next.splice(from, 1);
    next.splice(target, 0, entry);
    onChange(next);
  };

  const onDragStart =
    (entryId: string) => (event: DragEvent<HTMLLIElement>) => {
      if (isFixed(entryId)) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', entryId);
      setDragging(entryId);
    };

  const onDragOver = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    if (!dragging) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropAt(index);
  };

  const onDrop = (index: number) => (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault();
    const entryId = dragging ?? event.dataTransfer.getData('text/plain');
    setDragging(null);
    setDropAt(null);
    if (entryId) move(entryId, index);
  };

  const groups = [...new Set(slot.options.map((o) => o.group ?? ''))].map(
    (group) => ({
      group,
      options: slot.options.filter((o) => (o.group ?? '') === group),
    }),
  );
  const customEntries = selected.filter(
    (entry): entry is ListItem => typeof entry !== 'string',
  );

  return (
    <section
      className="mt-4 rounded-lg border border-border p-4"
      aria-labelledby={`${id}-title`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-title`} className="text-sm font-semibold">
          {slot.label}{' '}
          <span className="font-normal text-muted-foreground">
            {selected.length}개 · {part.widthMm}×{part.heightMm}mm · A4 {sheets}
            장
          </span>
        </h2>
        {slot.presets.length > 0 && (
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={`${slot.label} 묶음`}
          >
            {slot.presets.map((preset) => {
              const active =
                preset.values.length === selected.length &&
                preset.values.every((v, i) => selectedIds[i] === v);
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange([...preset.values])}
                  className={
                    'rounded-full px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ' +
                    (active
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border hover:border-primary')
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {slot.help && (
        <p className="mt-1 text-xs text-muted-foreground">{slot.help}</p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}

      {slot.search && (
        <SearchBox
          gameId={gameId}
          slot={slot}
          selectedIds={selectedSet}
          onPick={(hit) => (hit.item ? addCustom(hit.item) : turnOn(hit.id))}
        />
      )}

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div>
          <h3 className="text-xs font-medium">
            경로 차례{' '}
            <span className="font-normal text-muted-foreground">
              — 끌거나 ▲▼로 바꾼다
            </span>
          </h3>
          <ol
            aria-label={`${slot.label} 경로 차례`}
            className="mt-1 max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm"
          >
            {selected.map((entry, index) => {
              const entryId = listEntryId(entry);
              const fixed = isFixed(entryId);
              const custom = typeof entry !== 'string';
              return (
                <li
                  key={entryId}
                  draggable={!fixed}
                  onDragStart={onDragStart(entryId)}
                  onDragOver={onDragOver(index)}
                  onDrop={onDrop(index)}
                  onDragEnd={() => {
                    setDragging(null);
                    setDropAt(null);
                  }}
                  className={
                    'flex items-center gap-2 px-2 py-1 ' +
                    (dragging === entryId ? 'opacity-40 ' : '') +
                    (dropAt === index && dragging && dragging !== entryId
                      ? 'border-t-2 border-t-primary '
                      : '') +
                    (fixed ? 'bg-muted/40' : 'cursor-grab')
                  }
                >
                  <span className="w-7 shrink-0 text-right tabular-nums text-muted-foreground">
                    {index === 0 ? '출발' : index}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {labelOf(entry)}
                    {custom && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        직접 추가
                      </span>
                    )}
                  </span>
                  {!fixed && (
                    <>
                      <button
                        type="button"
                        aria-label={`${labelOf(entry)} 앞으로`}
                        disabled={index <= 1}
                        onClick={() => move(entryId, index - 1)}
                        className="size-6 rounded text-xs hover:bg-muted disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        aria-label={`${labelOf(entry)} 뒤로`}
                        disabled={index >= selected.length - 1}
                        onClick={() => move(entryId, index + 1)}
                        className="size-6 rounded text-xs hover:bg-muted disabled:opacity-30"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        aria-label={`${labelOf(entry)} 끄기`}
                        onClick={() => turnOff(entryId)}
                        className="size-6 rounded text-xs hover:bg-muted"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div>
          <h3 className="text-xs font-medium">
            전체 목록{' '}
            <span className="font-normal text-muted-foreground">
              — 체크한 것만 판에 그린다
            </span>
          </h3>
          <div className="mt-1 grid max-h-80 gap-x-6 gap-y-3 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2 xl:grid-cols-3">
            {customEntries.length > 0 && (
              <fieldset className="min-w-0">
                <legend className="text-xs font-semibold text-muted-foreground">
                  직접 추가
                </legend>
                <ul className="mt-1 space-y-0.5">
                  {customEntries.map((entry) => (
                    <li key={entry.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked
                          onChange={() => turnOff(entry.id)}
                          className="size-4 accent-current"
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {entry.label}
                        </span>
                        <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {selectedIds.indexOf(entry.id)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
            {groups.map(({ group, options }) => (
              <fieldset key={group || '(전체)'} className="min-w-0">
                {group && (
                  <legend className="text-xs font-semibold text-muted-foreground">
                    {group}
                  </legend>
                )}
                <ul className="mt-1 space-y-0.5">
                  {options.map((option) => {
                    const on = selectedSet.has(option.value);
                    const fixed = isFixed(option.value);
                    const order = selectedIds.indexOf(option.value);
                    return (
                      <li key={option.value}>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={fixed}
                            onChange={(event) =>
                              event.target.checked
                                ? turnOn(option.value)
                                : turnOff(option.value)
                            }
                            className="size-4 accent-current"
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {option.label}
                          </span>
                          {on && (
                            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                              {order === 0 ? '출발' : order}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 검색 상자. 질의를 250ms 뒤에 서버로 보내고, 결과를 눌러 더한다. 이미 켜진
 * 것은 "있음"으로 표시하고 다시 더하지 않는다.
 */
function SearchBox({
  gameId,
  slot,
  selectedIds,
  onPick,
}: {
  gameId: string;
  slot: Extract<Slot, { kind: 'list' }>;
  selectedIds: ReadonlySet<string>;
  onPick: (hit: SearchHit) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const latest = useRef(0);

  const active = query.trim() !== '';

  // 질의가 비면 아무것도 안 한다 — 결과는 `active`가 가린다. 렌더 직후의 동기
  // setState는 두지 않는다(효과 안에서 상태를 바로 바꾸면 렌더가 연쇄된다).
  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) return;
    const ticket = (latest.current += 1);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('loading');
      try {
        const res = await fetch(
          `/api/games/${gameId}/list-search?slot=${encodeURIComponent(slot.id)}&q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { results: SearchHit[] };
        if (ticket === latest.current) {
          setHits(body.results);
          setStatus('idle');
        }
      } catch {
        if (!controller.signal.aborted && ticket === latest.current)
          setStatus('error');
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, gameId, slot.id]);

  return (
    <div className="mt-3">
      <label htmlFor={`${id}-q`} className="block text-xs font-medium">
        검색해서 더하기
      </label>
      <input
        id={`${id}-q`}
        type="search"
        value={query}
        placeholder={slot.search?.placeholder ?? '이름으로 찾기'}
        onChange={(event) => setQuery(event.target.value)}
        className="mt-1 w-full max-w-md rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/50"
      />
      {status === 'error' && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          검색하지 못했다 — 잠시 뒤에 다시 해 본다.
        </p>
      )}
      {active && status !== 'error' && (
        <ul
          aria-label="검색 결과"
          className="mt-1 max-h-56 max-w-md divide-y divide-border overflow-y-auto rounded-md border border-border text-sm"
        >
          {hits.length === 0 && status === 'idle' && (
            <li className="px-2 py-1.5 text-muted-foreground">
              맞는 곳이 없다.
            </li>
          )}
          {hits.map((hit) => {
            const present = selectedIds.has(hit.id);
            return (
              <li key={hit.id} className="flex items-center gap-2 px-2 py-1">
                <span className="min-w-0 flex-1 truncate">
                  {hit.label}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {hit.detail}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={present}
                  onClick={() => onPick(hit)}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium hover:border-primary disabled:opacity-40"
                >
                  {present ? '있음' : '더하기'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
