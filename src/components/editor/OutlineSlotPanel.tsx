'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  outlineRings,
  validateSlotValue,
  type OutlineRing,
  type Slot,
  type SlotValue,
  type RectMm,
} from '@/lib/schema';
import {
  applyFit,
  dotCapacity,
  fitTransform,
  toFlat,
  toPoints,
  tracePicture,
  MAX_DETAIL_LEVELS,
  MAX_THRESHOLD_OFFSET,
  type Box,
  type FitTransform,
  type OutlineFailure,
} from '@/lib/dot-to-dot';
import {
  photoPixels,
  readPhoto,
  turnPhoto,
  PhotoError,
  PHOTO_ACCEPT,
  type Photo,
} from '@/lib/dot-to-dot/browser';
import {
  clearPhoto,
  loadPhoto,
  savePhoto,
  type StoredPhoto,
} from '@/lib/customization/photo';
import { useHydrated } from '@/lib/customization/useHydrated';
import { SlotField } from './SlotField';

/**
 * 윤곽 슬롯 패널 — 사진을 넣고, 고치고, 다시 연다 (IDE-020)
 *
 * 점 잇기가 처음 쓴다. 목록 슬롯 패널(`ListSlotPanel`)과 같은 자리에 서고 같은
 * 규약을 따른다 — **슬롯이 말해 주는 것만 읽는다.** 게임 id도 슬롯 id도 모른다.
 * 슬롯이 알려 주는 것은 셋이다: 값이 앉을 상자(`box`), 그 위에 몇 개를 놓을지
 * 정하는 숫자 슬롯(`countSlotId`), 그리고 점 개수 상한을 정하는 윤곽선 자체.
 *
 * ## 사진은 이 컴포넌트 밖으로 나가지 않는다
 *
 * 파일 → 줄인 JPEG → 화소 → 윤곽선 좌표까지가 전부 브라우저 안에서 끝나고,
 * 커스터마이즈에 실려 서버로 가는 것은 **좌표뿐**이다. 사진은 커스터마이즈가
 * 아니라 따로 난 키에 남는다(`lib/customization/photo.ts`) — 담을 자리를 아예
 * 만들지 않는 것이 실수할 여지를 없앤다.
 *
 * ## 다시 열었을 때
 *
 * 윤곽선은 **저장된 좌표를 그대로** 쓴다. 사진에서 다시 따지 않는다 — 다시 딴
 * 결과가 처음과 미세하게 달라지면 사용자 눈에는 도안이 저 혼자 바뀐 것으로
 * 보인다. 사진이 하는 일은 개수를 바꾸는 것이 아니라(그건 좌표만으로 된다)
 * **다시 따는 것**이다: 밝기를 밀거나 돌리거나 뒤집을 때 원본이 있어야 한다.
 *
 * ## 실패했을 때 빈 판을 내지 않는다
 *
 * 윤곽을 못 딴 사진은 흔하다. 그때 **윤곽선을 건드리지 않고**(직전 그림이나 보기
 * 그림이 그대로 남는다) 무엇을 하면 되는지만 적는다 — 빈 종이가 나오고 마는 것이
 * 제일 나쁘다.
 */

/** `IDE-019`가 돌려주는 실패 사유를 **무엇을 하면 되는지**로 옮겨 적는다. */
const ADVICE: Record<OutlineFailure, string> = {
  empty:
    '사진에서 윤곽을 찾지 못했다. 밝기를 좌우로 밀어 보고, 그래도 안 되면 배경과 색이 뚜렷이 다른 사진으로 바꾼다.',
  'too-small':
    '피사체가 너무 작다. 아이나 인형이 화면을 절반쯤 채우게 가까이서 찍은 사진이 잘 된다.',
  flooded:
    '사진 거의 전체가 한 덩어리로 잡혔다. 역광이거나 배경과 밝기가 비슷한 사진이다 — 밝기를 왼쪽으로 밀어 본다.',
  scattered:
    '덩어리가 여럿이라 어느 것이 피사체인지 고르지 못했다. 배경이 단순한 곳(민무늬 벽·바닥)에서 찍은 사진이 잘 된다.',
};

export interface OutlineSlotPanelProps {
  slot: Extract<Slot, { kind: 'outline' }>;
  value: SlotValue;
  error: string | null;
  gameId: string;
  /**
   * 개수 슬롯 — `slot.countSlotId`가 가리키는 숫자 슬롯. 지금 보는 파트가 그
   * 값을 쓰지 않으면(점 잇기의 완성 그림 부속) 주지 않는다.
   */
  countSlot?: Extract<Slot, { kind: 'number' }>;
  countValue?: SlotValue;
  countError?: string | null;
  /**
   * 세부 선 슬롯 — `slot.detailSlotId`가 가리키는 윤곽 슬롯(IDE-021). 아이가
   * 잇지 않고 판에 미리 그려 두는 선을 담는다.
   */
  detailSlot?: Extract<Slot, { kind: 'outline' }>;
  detailValue?: SlotValue;
  onChange: (slotId: string, value: SlotValue) => void;
}

/**
 * 하이드레이션이 끝난 뒤에만 저장된 사진을 초기값으로 쓴다 — 서버에는 없는
 * 값이라 첫 렌더가 서버와 달라지면 안 된다. 효과 안에서 상태를 곧장 바꾸는 대신
 * `key`로 다시 마운트하는 것은 `EditorClient`가 커스터마이즈에 쓰는 수법과 같다.
 */
export function OutlineSlotPanel(props: OutlineSlotPanelProps) {
  const hydrated = useHydrated();
  return (
    <OutlinePanel
      key={hydrated ? 'restored' : 'initial'}
      {...props}
      initialPhoto={hydrated ? loadPhoto(props.gameId, props.slot.id) : null}
    />
  );
}

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; message: string }
  | { kind: 'failed'; message: string };

const IDLE: Status = { kind: 'idle' };

/**
 * 사진을 처음 넣었을 때의 세부 정도 (IDE-021).
 *
 * 1로 두는 것은 **얼굴이 나오는 것이 이 놀이의 기본**이기 때문이다 — 실루엣만
 * 있으면 무엇을 찍은 사진인지 알아보기 어렵다는 것이 이 이슈의 출발점이다.
 * 선이 많아 어수선하면 0으로 내린다.
 */
const DEFAULT_DETAIL_LEVEL = 1;

/** 세부 정도 단추. 값이 곧 밝기를 몇 단 더 나누는가다. */
const DETAIL_CHOICES: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: '없음' },
  { value: 1, label: '조금' },
  { value: 2, label: '보통' },
  { value: 3, label: '많이' },
];

const boxOf = (slot: Extract<Slot, { kind: 'outline' }>): Box => ({
  x: slot.box.xMm,
  y: slot.box.yMm,
  width: slot.box.widthMm,
  height: slot.box.heightMm,
});

/** 닫힌 폴리라인의 `d`. 직선뿐이라 M·L·Z 세 명령이면 된다. */
const outlinePathData = (flat: readonly number[]): string => {
  if (flat.length < 6) return '';
  const parts: string[] = [`M ${flat[0].toFixed(2)} ${flat[1].toFixed(2)}`];
  for (let i = 2; i + 1 < flat.length; i += 2) {
    parts.push(`L ${flat[i].toFixed(2)} ${flat[i + 1].toFixed(2)}`);
  }
  return `${parts.join(' ')} Z`;
};

function OutlinePanel({
  slot,
  value,
  error,
  gameId,
  countSlot,
  countValue,
  countError,
  detailSlot,
  detailValue,
  onChange,
  initialPhoto,
}: OutlineSlotPanelProps & { initialPhoto: StoredPhoto | null }) {
  const id = useId();
  const [photo, setPhoto] = useState<StoredPhoto | null>(initialPhoto);
  const [status, setStatus] = useState<Status>(IDLE);
  const [dragOver, setDragOver] = useState(false);
  const [compare, setCompare] = useState(false);
  /** 개수가 상한에 걸려 깎였을 때 그 수. 없으면 안 깎였다. */
  const [clampedTo, setClampedTo] = useState<number | null>(null);
  /**
   * 지금 유효한 작업의 번호. 슬라이더를 끄는 동안 따기가 여럿 겹칠 수 있는데,
   * 늦게 시작한 것이 먼저 끝나면 화면이 한 칸 전 밝기로 되돌아간다.
   */
  const ticket = useRef(0);
  const sliderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (sliderTimer.current) clearTimeout(sliderTimer.current);
    },
    [],
  );

  // 값이 배열이라고 다 윤곽은 아니다 — 목록 값도 배열이다. 슬롯이 아는 모양대로
  // 읽는 것은 `outlineRings`가 한다(고리 하나짜리든 여럿이든).
  const outline: OutlineRing = outlineRings(slot, value)[0] ?? [];
  const detail: OutlineRing[] = detailSlot
    ? outlineRings(detailSlot, detailValue)
    : [];
  const capacity = dotCapacity(outline);
  /** 실제로 잡아 주는 한계. 슬롯이 정한 최솟값 아래로는 내리지 않는다. */
  const countLimit = countSlot ? Math.max(countSlot.min, capacity) : capacity;

  // 저장 실패는 여기서 알리지 않는다 — 저장소가 실패한 키를 들고 있고
  // 에디터가 한 자리에서 한 번만 말한다(`SAVE_FAILURE_MESSAGE`).
  const remember = (next: StoredPhoto) => {
    setPhoto(next);
    savePhoto(gameId, slot.id, next);
  };

  /**
   * 사진 하나에서 윤곽을 딴다. 성공하면 값이 바뀌고, 실패하면 **값을 그대로 두고**
   * 무엇을 하면 되는지만 남긴다.
   */
  const trace = async (
    source: Photo,
    thresholdOffset: number,
    detailLevel: number,
  ) => {
    const mine = (ticket.current += 1);
    const stale = () => ticket.current !== mine;
    const store = (rectMm: RectMm | null): StoredPhoto => ({
      dataUrl: source.dataUrl,
      widthPx: source.widthPx,
      heightPx: source.heightPx,
      thresholdOffset,
      detailLevel,
      rectMm,
    });
    const place = (fit: FitTransform, flat: readonly number[]): OutlineRing =>
      toFlat(toPoints(flat).map((p) => applyFit(fit, p.x, p.y)));

    setStatus({ kind: 'busy', message: '사진에서 윤곽을 따는 중이다…' });
    try {
      const pixels = await photoPixels(source);
      if (stale()) return;
      const traced = tracePicture(pixels, {
        thresholdOffset,
        detailLevels: detailLevel,
      });
      if (stale()) return;
      if (!traced.ok) {
        remember(store(null));
        setStatus({ kind: 'failed', message: ADVICE[traced.reason] });
        return;
      }

      // 딴 좌표는 사진 화소 단위다. 상자에 맞춰 넣는 변환을 **세부 선과 사진에도
      // 그대로** 먹인다 — 세부를 따로 맞추면 눈이 판을 가득 채우고, 사진에
      // 먹이지 않으면(rectMm) 원본 대조 보기가 겹쳐지지 않는다.
      const points = toPoints(traced.outline);
      const fit = fitTransform(points, boxOf(slot));
      const fitted = toFlat(points.map((p) => applyFit(fit, p.x, p.y)));
      const reason = validateSlotValue(slot, fitted);
      if (reason) {
        setStatus({
          kind: 'failed',
          message: `딴 윤곽을 판에 넣지 못했다 — ${reason}. 다른 사진으로 바꿔 본다.`,
        });
        return;
      }

      const topLeft = applyFit(fit, 0, 0);
      const bottomRight = applyFit(fit, pixels.width, pixels.height);
      onChange(slot.id, fitted);
      if (detailSlot) {
        // 모양을 어긴 고리는 조용히 뺀다 — 세부 하나 때문에 값 전체가 검증에
        // 걸려 판이 안 그려지는 것이 더 나쁘다.
        const rings = traced.detail
          .map((ring) => place(fit, ring))
          .filter((ring) => validateSlotValue(detailSlot, [ring]) === null)
          .slice(0, detailSlot.maxRings);
        onChange(detailSlot.id, rings);
      }
      remember(
        store({
          xMm: topLeft.x,
          yMm: topLeft.y,
          widthMm: bottomRight.x - topLeft.x,
          heightMm: bottomRight.y - topLeft.y,
        }),
      );

      // 새 윤곽이 앞의 것보다 짧으면 지금 개수가 상한을 넘을 수 있다. 그대로
      // 두면 화면의 숫자와 종이 위 점의 수가 어긋난다 — 여기서 함께 잡는다.
      const fresh = Math.max(countSlot?.min ?? 0, dotCapacity(fitted));
      if (countSlot && typeof countValue === 'number' && countValue > fresh) {
        onChange(countSlot.id, fresh);
        setClampedTo(fresh);
      } else {
        setClampedTo(null);
      }
      setStatus(IDLE);
    } catch (cause) {
      if (stale()) return;
      setStatus({
        kind: 'failed',
        message:
          cause instanceof PhotoError
            ? cause.message
            : '사진을 다루지 못했다. 다른 사진으로 바꿔 본다.',
      });
    }
  };

  const takeFile = async (file: File) => {
    setStatus({ kind: 'busy', message: '사진을 읽는 중이다…' });
    try {
      const fresh = await readPhoto(file);
      // 새 사진이니 밝기도 자동으로 되돌린다 — 앞 사진에 맞춰 민 값이 다음
      // 사진에도 맞을 이유가 없다. 세부 정도는 사람이 고른 취향이라 남긴다.
      await trace(fresh, 0, photo?.detailLevel ?? DEFAULT_DETAIL_LEVEL);
    } catch (cause) {
      setStatus({
        kind: 'failed',
        message:
          cause instanceof PhotoError
            ? cause.message
            : '사진을 읽지 못했다. 다른 파일로 바꿔 본다.',
      });
    }
  };

  const turn = async (options: { quarterTurns?: number; flip?: boolean }) => {
    if (!photo) return;
    setStatus({ kind: 'busy', message: '사진을 돌리는 중이다…' });
    try {
      const turned = await turnPhoto(photo, options);
      await trace(turned, photo.thresholdOffset, photo.detailLevel);
    } catch {
      setStatus({ kind: 'failed', message: '사진을 돌리지 못했다.' });
    }
  };

  const removePhoto = () => {
    clearPhoto(gameId, slot.id);
    setPhoto(null);
    setCompare(false);
    setStatus(IDLE);
    // 윤곽선은 도안의 기본값으로 되돌린다 — 사진을 지웠는데 그 사진의 윤곽이
    // 판에 남아 있으면 화면이 거짓말을 한다. 보기 그림이 앞의 것보다 짧으면
    // 개수도 함께 잡는다(따고 난 뒤와 같은 규칙이다).
    onChange(slot.id, structuredClone(slot.default));
    if (detailSlot)
      onChange(detailSlot.id, structuredClone(detailSlot.default));
    const back = Math.max(
      countSlot?.min ?? 0,
      dotCapacity(outlineRings(slot, slot.default)[0] ?? []),
    );
    if (countSlot && typeof countValue === 'number' && countValue > back) {
      onChange(countSlot.id, back);
      setClampedTo(back);
    } else {
      setClampedTo(null);
    }
  };

  /**
   * 개수를 바꾼다. **윤곽선은 건드리지 않는다** — 점만 다시 배분된다.
   *
   * 상한을 넘겼으면 입력을 막는 대신 최대치로 잡아 주고 왜 그랬는지 적는다.
   * 막아 버리면 "왜 100이 안 들어가지"만 남고 이유가 안 보인다.
   */
  const changeCount = (next: SlotValue) => {
    if (!countSlot) return;
    if (
      typeof next === 'number' &&
      Number.isFinite(next) &&
      next > countLimit
    ) {
      setClampedTo(countLimit);
      onChange(countSlot.id, countLimit);
      return;
    }
    setClampedTo(null);
    onChange(countSlot.id, next);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void takeFile(file);
  };

  const busy = status.kind === 'busy';

  return (
    <section
      className="mt-4 rounded-lg border border-border p-4"
      aria-labelledby={`${id}-title`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-title`} className="text-sm font-semibold">
          {slot.label}{' '}
          <span className="font-normal text-muted-foreground">
            {photo ? '사진에서 딴 형태다' : '보기 그림이다 — 사진을 넣어 본다'}
          </span>
        </h2>
      </div>
      {slot.help && (
        <p className="mt-1 text-xs text-muted-foreground">{slot.help}</p>
      )}

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <ComparePane
          slot={slot}
          outline={outline}
          detail={detail}
          photo={photo}
          compare={compare}
          onToggleCompare={() => setCompare((on) => !on)}
        />

        <div>
          {/* 사진 넣기 — 끌어다 놓거나 골라서. 파일 입력을 숨기고 라벨을 단추처럼
              보이게 두면 키보드로도 그대로 열린다(입력 자체가 포커스를 받는다). */}
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={
              'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-dashed p-3 transition-colors ' +
              (dragOver ? 'border-primary bg-muted/50' : 'border-border')
            }
          >
            <input
              id={`${id}-file`}
              type="file"
              accept={PHOTO_ACCEPT}
              className="peer sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                // 같은 파일을 다시 골라도 change가 오도록 값을 비운다.
                event.target.value = '';
                if (file) void takeFile(file);
              }}
            />
            <label
              htmlFor={`${id}-file`}
              className="cursor-pointer rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-current"
            >
              {photo ? '다른 사진 고르기' : '사진 고르기'}
            </label>
            <p className="text-xs text-muted-foreground">
              여기로 끌어다 놓아도 된다. 휴대폰에서는 카메라로 바로 찍을 수
              있다. 사진은 이 브라우저 안에서만 다루고 서버로 보내지 않는다.
            </p>
          </div>

          {countSlot && (
            <div className="mt-3">
              <SlotField
                slot={countSlot}
                value={countValue ?? countSlot.default}
                error={countError ?? null}
                onChange={changeCount}
                inline
              />
              {countSlot.help && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {countSlot.help}
                </p>
              )}
              {/* 개수와 상한을 한 줄에 둔다. 스크린리더에는 단추를 누른 결과가
                  이 줄로 전해진다 — 판 그림은 소리로 읽히지 않는다. */}
              <p role="status" className="mt-1 text-xs text-muted-foreground">
                {typeof countValue === 'number' ? `점 ${countValue}개` : ''} ·
                이 윤곽선에는 {capacity}개까지 넣을 수 있다
                {clampedTo !== null
                  ? ` — 더 넣으면 번호가 겹쳐 읽을 수 없어 ${clampedTo}개로 맞췄다. 점을 더 넣으려면 윤곽이 긴 사진을 쓴다.`
                  : ''}
              </p>
            </div>
          )}

          {photo && (
            <div className="mt-3">
              <label
                htmlFor={`${id}-threshold`}
                className="block text-xs font-medium"
              >
                밝기 — 윤곽을 어디서 가를지
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <input
                  id={`${id}-threshold`}
                  type="range"
                  min={-MAX_THRESHOLD_OFFSET}
                  max={MAX_THRESHOLD_OFFSET}
                  step={4}
                  value={photo.thresholdOffset}
                  // 따는 동안에도 잠그지 않는다 — 끄는 중에 손잡이가 사라지면
                  // 잡을 것이 없어진다. 늦게 끝난 따기는 번호로 걸러진다.
                  aria-describedby={`${id}-threshold-help`}
                  className="w-56 accent-current"
                  onChange={(event) => {
                    const offset = Number(event.target.value);
                    // 손잡이는 곧장 따라오고, 다시 따는 것은 손을 멈춘 뒤다 —
                    // 한 칸마다 따면 512px 한 장을 수십 번 훑는다.
                    setPhoto({ ...photo, thresholdOffset: offset });
                    if (sliderTimer.current) clearTimeout(sliderTimer.current);
                    sliderTimer.current = setTimeout(
                      () => void trace(photo, offset, photo.detailLevel),
                      150,
                    );
                  }}
                />
                <span
                  id={`${id}-threshold-help`}
                  className="text-xs text-muted-foreground"
                >
                  {photo.thresholdOffset === 0
                    ? '자동'
                    : photo.thresholdOffset < 0
                      ? `어두운 쪽으로 ${-photo.thresholdOffset}`
                      : `밝은 쪽으로 ${photo.thresholdOffset}`}
                </span>
              </div>

              {detailSlot && (
                <div className="mt-2">
                  <span
                    id={`${id}-detail`}
                    className="block text-xs font-medium"
                  >
                    세부 정도 — 눈·입 같은 선을 얼마나 그릴지
                  </span>
                  <div
                    className="mt-1 flex flex-wrap items-center gap-1.5"
                    role="group"
                    aria-labelledby={`${id}-detail`}
                  >
                    {DETAIL_CHOICES.filter(
                      (choice) => choice.value <= MAX_DETAIL_LEVELS,
                    ).map((choice) => (
                      <button
                        key={choice.value}
                        type="button"
                        aria-pressed={photo.detailLevel === choice.value}
                        onClick={() => {
                          if (busy || photo.detailLevel === choice.value)
                            return;
                          setPhoto({ ...photo, detailLevel: choice.value });
                          void trace(
                            photo,
                            photo.thresholdOffset,
                            choice.value,
                          );
                        }}
                        className={
                          'rounded-full px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ' +
                          (photo.detailLevel === choice.value
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border hover:border-primary')
                        }
                      >
                        {choice.label}
                      </button>
                    ))}
                    <span
                      role="status"
                      className="text-xs text-muted-foreground"
                    >
                      {detail.length === 0
                        ? '그린 선 없음'
                        : `선 ${detail.length}줄 — 아이는 이 선을 잇지 않는다`}
                    </span>
                  </div>
                </div>
              )}

              <div
                className="mt-2 flex flex-wrap gap-1.5"
                role="group"
                aria-label="사진 고치기"
              >
                <ToolButton
                  busy={busy}
                  onClick={() => void turn({ quarterTurns: 3 })}
                >
                  왼쪽으로 90°
                </ToolButton>
                <ToolButton
                  busy={busy}
                  onClick={() => void turn({ quarterTurns: 1 })}
                >
                  오른쪽으로 90°
                </ToolButton>
                <ToolButton
                  busy={busy}
                  onClick={() => void turn({ flip: true })}
                >
                  좌우 뒤집기
                </ToolButton>
                <ToolButton
                  busy={busy}
                  onClick={() => void trace(photo, 0, photo.detailLevel)}
                >
                  다시 따기
                </ToolButton>
                <ToolButton busy={busy} onClick={removePhoto}>
                  사진 지우기
                </ToolButton>
              </div>
            </div>
          )}

          <p role="status" className="mt-2 text-xs text-muted-foreground">
            {status.kind === 'busy' ? status.message : ''}
          </p>
          {status.kind === 'failed' && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {status.message}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * 사진을 고치는 단추. 따는 동안에는 눌러도 듣지 않지만 **`disabled`를 걸지는
 * 않는다** — 누른 단추가 그 순간 disabled가 되면 포커스가 문서 처음으로
 * 튕겨, 키보드로만 쓰는 사람은 자리를 잃는다. `aria-disabled`는 "지금은 안
 * 된다"를 알리면서 포커스를 남긴다.
 */
function ToolButton({
  busy,
  onClick,
  children,
}: {
  busy: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-disabled={busy}
      onClick={() => {
        if (!busy) onClick();
      }}
      className={
        'rounded-full border border-border px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ' +
        (busy ? 'opacity-40' : 'hover:border-primary')
      }
    >
      {children}
    </button>
  );
}

/**
 * 원본 대조 보기 — 딴 윤곽이 사진과 맞는지 여기서 본다.
 *
 * **판 미리보기에는 사진을 깔지 않는다.** 인쇄물에 없는 것이 화면에 있으면
 * 사용자가 뽑고 나서 놀란다. 그래서 대조는 이 작은 상자 안에서만 하고, 단추를
 * 눌러 켜고 끈다 — 누르고 있는 동안만 보이게 하면 키보드로는 볼 수 없다
 * (`IDE-009`가 요구한 "마우스 없이 끝까지").
 *
 * 사진과 윤곽을 같은 좌표계에 놓을 수 있는 것은 윤곽을 딸 때 쓴 변환을 사진에도
 * 먹여 두었기 때문이다(`photo.rectMm`).
 */
function ComparePane({
  slot,
  outline,
  detail,
  photo,
  compare,
  onToggleCompare,
}: {
  slot: Extract<Slot, { kind: 'outline' }>;
  outline: readonly number[];
  detail: ReadonlyArray<readonly number[]>;
  photo: StoredPhoto | null;
  compare: boolean;
  onToggleCompare: () => void;
}) {
  const rect = photo?.rectMm ?? null;
  // 사진 테두리는 피사체보다 넓어 상자 밖으로 나간다 — 둘을 다 담는 창을 잡는다.
  const minX = Math.min(slot.box.xMm, rect ? rect.xMm : Infinity);
  const minY = Math.min(slot.box.yMm, rect ? rect.yMm : Infinity);
  const maxX = Math.max(
    slot.box.xMm + slot.box.widthMm,
    rect ? rect.xMm + rect.widthMm : -Infinity,
  );
  const maxY = Math.max(
    slot.box.yMm + slot.box.heightMm,
    rect ? rect.yMm + rect.heightMm : -Infinity,
  );

  return (
    <div>
      <svg
        viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
        role="img"
        aria-label={
          compare ? '딴 윤곽선을 원본 사진 위에 겹쳐 본다' : '딴 윤곽선'
        }
        className="w-full rounded-md border border-border bg-paper text-paper-foreground"
      >
        {compare && rect && photo && (
          <image
            href={photo.dataUrl}
            x={rect.xMm}
            y={rect.yMm}
            width={rect.widthMm}
            height={rect.heightMm}
            opacity={0.6}
            preserveAspectRatio="none"
          />
        )}
        <path
          d={outlinePathData(outline)}
          fill="none"
          stroke="currentColor"
          strokeWidth={(maxX - minX) / 220}
          strokeLinejoin="round"
        />
        {/* 세부 선도 함께 보여야 대조가 뜻이 있다 — 눈이 눈 자리에 앉았는지가
            여기서 보인다. 판에서처럼 윤곽보다 가늘게 긋는다. */}
        {detail.map((ring, i) => (
          <path
            key={i}
            d={outlinePathData(ring)}
            fill="none"
            stroke="currentColor"
            strokeWidth={(maxX - minX) / 380}
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          aria-pressed={compare}
          disabled={!rect}
          onClick={onToggleCompare}
          className={
            'rounded-full px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-40 ' +
            (compare
              ? 'bg-primary text-primary-foreground'
              : 'border border-border hover:border-primary')
          }
        >
          원본 대조 보기
        </button>
        <span className="text-xs text-muted-foreground">
          꼭짓점 {Math.floor(outline.length / 2)}개
          {detail.length > 0 ? ` · 세부 ${detail.length}줄` : ''}
        </span>
      </div>
    </div>
  );
}
