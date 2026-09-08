'use client';

import type { Slot, SlotValue } from '@/lib/schema';
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
 * 슬롯 `kind`가 입력 종류를 정한다 — 텍스트·숫자·색상·선택지 네 가지뿐이라
 * 게임을 몰라도 렌더링할 수 있다. 자동 폼 생성기(`CustomizationForm`)가 슬롯
 * 배열을 순회하며 이 컴포넌트를 늘어놓는다.
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

    case 'number':
      return (
        <input
          id={fieldId}
          type="number"
          value={String(value)}
          min={slot.min}
          max={slot.max}
          step={slot.integer ? 1 : 'any'}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          className={commonClassName}
          onChange={(e) => {
            const parsed = slot.integer
              ? Number.parseInt(e.target.value, 10)
              : Number.parseFloat(e.target.value);
            onChange(Number.isNaN(parsed) ? e.target.value : parsed);
          }}
        />
      );

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
