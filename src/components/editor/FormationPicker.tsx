'use client';

import type { LayoutPreset } from '@/lib/schema';

/**
 * 그룹(팀) 하나의 배치 프리셋(전술 대형) 선택 버튼 (IDE-006)
 *
 * `game.presets`만 읽는다 — 어떤 대형이 있는지, 몇 개인지는 게임마다 다르므로
 * 이름을 하드코딩하지 않는다. 축구 게임판이라면 그룹(팀)당 프리셋이 여러 개
 * (`4-4-2`·`3-5-2`·…) 있고, 버튼을 누르면 그 대형의 좌표로 마커가 옮겨간다.
 * 프리셋이 없는 그룹(위치를 가진 슬롯이 없는 그룹)에는 아무것도 그리지 않는다.
 */
export interface FormationPickerProps {
  presets: readonly LayoutPreset[];
  selectedPresetId: string | undefined;
  onApply: (presetId: string) => void;
  /**
   * 제목 없이 버튼만 한 줄로 낸다. 팀 줄에 색 옆으로 붙는 자리라 "대형"이라는
   * 말을 따로 두지 않아도 4-4-2 같은 숫자가 스스로 말한다(2026-09-06).
   */
  inline?: boolean;
}

export function FormationPicker({
  presets,
  selectedPresetId,
  onApply,
  inline = false,
}: FormationPickerProps) {
  if (presets.length === 0) return null;

  return (
    <div className={inline ? undefined : 'mt-3'}>
      {!inline && <p className="text-sm font-medium">대형</p>}
      <div
        className={(inline ? '' : 'mt-1 ') + 'flex flex-wrap gap-1.5'}
        role="group"
        aria-label="대형 선택"
      >
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={preset.id === selectedPresetId}
            onClick={() => onApply(preset.id)}
            className={
              'rounded-full px-2.5 py-1 text-xs font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ' +
              (preset.id === selectedPresetId
                ? 'bg-foreground text-background'
                : 'border border-black/15 hover:border-black/30 dark:border-white/20 dark:hover:border-white/40')
            }
          >
            {preset.formationId ?? preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
