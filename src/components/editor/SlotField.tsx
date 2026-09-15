'use client';

import {
  pointsOf,
  toFlatPoints,
  type Slot,
  type SlotValue,
} from '@/lib/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * 슬롯 하나에 대응하는 입력 컴포넌트 (IDE-006)
 *
 * 슬롯 `kind`가 입력 종류를 정한다 — 텍스트·숫자·색상·선택지 네 가지가 한 줄
 * 입력이라 게임을 몰라도 렌더링할 수 있다. 자동 폼 생성기(`CustomizationForm`)
 * 가 슬롯 배열을 순회하며 이 컴포넌트를 늘어놓는다.
 *
 * 나머지 둘은 여기서 그리지 않는다 — 목록(`list`)은 판 아래 패널이, 윤곽
 * (`outline`)은 사진 넣기 패널이 맡는다. 다만 **숫자 슬롯 하나는 그 사진 패널
 * 안에서 이 컴포넌트로 그려진다**(점 잇기의 점 개수) — 넣을 수 있는 최대치가
 * 윤곽선의 길이에서 나와 사진 옆에 있어야 뜻이 통하기 때문이다(IDE-020).
 */
export interface SlotFieldProps {
  slot: Slot;
  value: SlotValue;
  error: string | null;
  onChange: (value: SlotValue) => void;
  /**
   * 라벨과 입력을 한 줄에 놓는다. 에디터의 도구 막대·팀 줄처럼 세로 공간이
   * 아까운 자리에 쓴다(2026-09-06 레이아웃 정리). 기본은 라벨 아래 입력이다.
   */
  inline?: boolean;
  /**
   * 라벨을 화면에서 숨긴다(스크린리더에는 남는다). 팀 줄의 색처럼 바로 옆
   * 제목이 이미 무엇인지 말해 주는 입력에 쓴다 — "홈 팀" 옆에 "홈 팀 색"을
   * 또 쓰면 같은 말이 두 번이다.
   */
  labelHidden?: boolean;
}

/** 폼 입력에 붙는 id. 미리보기에서 슬롯을 누르면 이 id로 포커스를 옮긴다. */
export const slotFieldId = (slotId: string): string => `slot-field-${slotId}`;

/**
 * 새로 놓는 점의 자리 (IDE-031).
 *
 * 상자 한가운데에 겹쳐 쌓으면 손잡이가 서로를 가려 끌 수가 없다. 개수에 따라
 * 조금씩 어긋나게 두어 **놓자마자 집을 수 있게** 한다.
 */
function nextSpot(
  box: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  points: readonly { xMm: number; yMm: number }[],
): { xMm: number; yMm: number } {
  const n = points.length;
  const x = box.xMm + box.widthMm * (0.3 + 0.2 * (n % 3));
  const y = box.yMm + box.heightMm * (0.3 + 0.12 * Math.floor(n / 3));
  return {
    xMm: Math.min(Math.max(x, box.xMm), box.xMm + box.widthMm),
    yMm: Math.min(Math.max(y, box.yMm), box.yMm + box.heightMm),
  };
}

export function SlotField({
  slot,
  value,
  error,
  onChange,
  inline = false,
  labelHidden = false,
}: SlotFieldProps) {
  const fieldId = slotFieldId(slot.id);
  const errorId = `${fieldId}-error`;

  return (
    <div className={inline ? 'flex flex-wrap items-center gap-x-2' : undefined}>
      <label
        htmlFor={fieldId}
        className={
          labelHidden
            ? 'sr-only'
            : inline
              ? 'text-sm font-medium'
              : 'block text-sm font-medium'
        }
      >
        {slot.label}
      </label>
      {slot.help && !inline && (
        <p className="mt-0.5 text-xs text-muted-foreground">{slot.help}</p>
      )}
      <div className={inline ? undefined : 'mt-1'}>
        <SlotInput
          slot={slot}
          fieldId={fieldId}
          value={value}
          invalid={error !== null}
          errorId={errorId}
          onChange={onChange}
          inline={inline}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function SlotInput({
  slot,
  fieldId,
  value,
  invalid,
  errorId,
  onChange,
  inline,
}: {
  slot: Slot;
  fieldId: string;
  value: SlotValue;
  invalid: boolean;
  errorId: string;
  onChange: (value: SlotValue) => void;
  inline: boolean;
}) {
  // 한 줄 배치에서는 입력이 줄 폭을 다 먹지 않는다 — 옆에 다른 조작이 온다.
  const commonClassName =
    (inline ? 'w-40 ' : 'w-full ') +
    'rounded-md border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-offset-0 ' +
    (invalid
      ? 'border-destructive focus:ring-destructive/40'
      : 'border-border focus:ring-ring/50');

  switch (slot.kind) {
    case 'text':
      return (
        <input
          id={fieldId}
          type="text"
          value={String(value)}
          placeholder={slot.placeholder}
          maxLength={slot.maxLength}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          className={commonClassName}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'number': {
      const field = (
        <input
          id={fieldId}
          type="number"
          value={String(value)}
          min={slot.min}
          max={slot.max}
          step={slot.integer ? 1 : 'any'}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          // 값 단추가 옆에 서면 입력 칸은 두세 자리만 받으면 된다.
          className={
            slot.presets.length > 0
              ? commonClassName.replace('w-40 ', 'w-24 ')
              : commonClassName
          }
          onChange={(e) => {
            const parsed = slot.integer
              ? Number.parseInt(e.target.value, 10)
              : Number.parseFloat(e.target.value);
            onChange(Number.isNaN(parsed) ? e.target.value : parsed);
          }}
        />
      );
      if (slot.presets.length === 0) return field;
      // 자주 쓰는 값 단추(IDE-020). 입력 칸을 대신하지 않고 옆에 선다 — 목록
      // 슬롯의 묶음 단추와 같은 모양이라 화면에서 같은 것으로 읽힌다.
      return (
        <div className="flex flex-wrap items-center gap-2">
          {field}
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={`${slot.label} 자주 쓰는 값`}
          >
            {slot.presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-pressed={value === preset.value}
                aria-label={
                  preset.help ? `${preset.label} — ${preset.help}` : undefined
                }
                title={preset.help}
                onClick={() => onChange(preset.value)}
                className={
                  'rounded-full px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ' +
                  (value === preset.value
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border hover:border-primary')
                }
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    case 'color':
      return (
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={fieldId}
            type="color"
            value={String(value)}
            aria-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
            className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
            onChange={(e) => onChange(e.target.value)}
          />
          {slot.palette && (
            <div className="flex flex-wrap gap-1.5" role="group">
              {slot.palette.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  aria-label={hex}
                  aria-pressed={value === hex}
                  onClick={() => onChange(hex)}
                  className={
                    'h-6 w-6 rounded-full border-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ' +
                    (value === hex ? 'border-foreground' : 'border-border')
                  }
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          )}
        </div>
      );

    case 'list':
      // 목록 슬롯은 여기서 그리지 않는다 — 판 아래 패널(`ListSlotPanel`)이 맡는다.
      return null;

    case 'outline':
      // 윤곽 슬롯의 값은 사진에서 생성된다(IDE-019). 사진을 넣고 다시 따는
      // 조작은 판 아래 패널(`OutlineSlotPanel`)이 맡는다 — 좌표 배열을 손으로
      // 칠 칸은 없다.
      return null;

    case 'points': {
      // 자리는 판 위에서 끈다(IDE-031). 여기서 하는 일은 **몇 개를 놓을지**뿐이다
      // — 손잡이를 끄는 동안 폼에 좌표가 숫자로 흐르면 읽을 것이 너무 많다.
      const points = pointsOf(value);
      const add = () => {
        const next = [...points, nextSpot(slot.box, points)];
        onChange(toFlatPoints(next));
      };
      const remove = () => onChange(toFlatPoints(points.slice(0, -1)));
      const pill =
        'rounded-full border border-border px-2.5 py-1 text-xs font-medium outline-none transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current';

      return (
        <div className="flex items-center gap-2" id={fieldId}>
          <span className="text-sm tabular-nums text-muted-foreground">
            {points.length}개
          </span>
          <button
            type="button"
            className={pill}
            onClick={add}
            disabled={points.length >= slot.max}
            aria-label={`${slot.handle.noun} 하나 더 놓기`}
          >
            + 하나 더
          </button>
          <button
            type="button"
            className={pill}
            onClick={remove}
            disabled={points.length <= slot.min}
            aria-label={`${slot.handle.noun} 마지막 것 빼기`}
          >
            − 빼기
          </button>
        </div>
      );
    }

    case 'choice':
      return (
        <Select
          value={String(value)}
          onValueChange={(v) => {
            // 단일 선택이라 실제로는 null이 오지 않는다 — 값이 온 경우만 반영한다.
            if (v !== null) onChange(v);
          }}
          items={slot.options.map((o) => ({ value: o.value, label: o.label }))}
        >
          <SelectTrigger
            id={fieldId}
            aria-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
            className={inline ? 'w-auto min-w-36' : 'w-full'}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {slot.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
  }
}
