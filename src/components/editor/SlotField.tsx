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
}

/** 폼 입력에 붙는 id. 미리보기에서 슬롯을 누르면 이 id로 포커스를 옮긴다. */
export const slotFieldId = (slotId: string): string => `slot-field-${slotId}`;

export function SlotField({ slot, value, error, onChange }: SlotFieldProps) {
  const fieldId = slotFieldId(slot.id);
  const errorId = `${fieldId}-error`;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium">
        {slot.label}
      </label>
      {slot.help && (
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {slot.help}
        </p>
      )}
      <div className="mt-1">
        <SlotInput
          slot={slot}
          fieldId={fieldId}
          value={value}
          invalid={error !== null}
          errorId={errorId}
          onChange={onChange}
        />
      </div>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-xs text-red-600 dark:text-red-400"
        >
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
}: {
  slot: Slot;
  fieldId: string;
  value: SlotValue;
  invalid: boolean;
  errorId: string;
  onChange: (value: SlotValue) => void;
}) {
  const commonClassName =
    'w-full rounded-md border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-offset-0 ' +
    (invalid
      ? 'border-red-500 focus:ring-red-500/40'
      : 'border-black/15 focus:ring-black/20 dark:border-white/20 dark:focus:ring-white/30');

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
            className="h-8 w-12 cursor-pointer rounded border border-black/15 bg-transparent p-0.5 dark:border-white/20"
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
                    (value === hex
                      ? 'border-black dark:border-white'
                      : 'border-black/15 dark:border-white/20')
                  }
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          )}
        </div>
      );

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
            className="w-full"
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
