'use client';

import { useId } from 'react';
import type { LayoutPreset } from '@/lib/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * 그룹(팀) 하나의 배치 프리셋(전술 대형) 선택 (IDE-006)
 *
 * `game.presets`만 읽는다 — 어떤 대형이 있는지, 몇 개인지는 게임마다 다르므로
 * 이름을 하드코딩하지 않는다. 축구 게임판이라면 그룹(팀)당 프리셋이 여러 개
 * (`4-3-3`·`4-2-3-1`·…) 있고, 고르면 그 대형의 좌표로 마커가 옮겨간다.
 * 프리셋이 없는 그룹(위치를 가진 슬롯이 없는 그룹)에는 아무것도 그리지 않는다.
 *
 * 버튼 줄이었다가 **셀렉트 박스**가 됐다(2026-09-06 사용자 요청). 대형이 여섯
 * 개가 되면서 버튼 여섯 개 × 두 팀이 팀 줄을 다 먹었다. 마커를 손으로 옮겨
 * 어느 대형도 아니게 되면 "직접 배치"로 보인다 — 어떤 대형 이름을 남겨 두면
 * 화면이 거짓말을 한다.
 */
export interface FormationPickerProps {
  presets: readonly LayoutPreset[];
  selectedPresetId: string | undefined;
  onApply: (presetId: string) => void;
  /** 접근성 이름에 쓴다 — "홈 팀 대형". 화면에는 제목이 이미 있어 안 보인다. */
  groupLabel: string;
}

export function FormationPicker({
  presets,
  selectedPresetId,
  onApply,
  groupLabel,
}: FormationPickerProps) {
  const id = useId();
  if (presets.length === 0) return null;

  const items = presets.map((preset) => ({
    value: preset.id,
    label: preset.formationId ?? preset.label,
  }));

  return (
    <Select
      value={selectedPresetId ?? null}
      onValueChange={(value) => {
        // 단일 선택이라 실제로는 null이 오지 않는다 — 값이 온 경우만 반영한다.
        if (value !== null) onApply(value);
      }}
      items={items}
    >
      <SelectTrigger
        id={id}
        aria-label={`${groupLabel} 대형`}
        size="sm"
        className="min-w-28"
      >
        <SelectValue placeholder="직접 배치" />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
