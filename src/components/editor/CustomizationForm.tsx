'use client';

import type { GameCustomization, GameDefinition } from '@/lib/schema';
import { SlotField } from './SlotField';
import { FormationPicker } from './FormationPicker';

/**
 * 도안 스키마를 읽어 폼을 통째로 그리는 렌더러 (IDE-006)
 *
 * 게임마다 새로 만들지 않는다 — `game.slots`·`game.groups`·`game.presets`만
 * 순회할 뿐, 특정 게임의 슬롯 id나 이름을 알지 못한다. 그룹(팀) 소속 슬롯은
 * 그룹 섹션 아래로 묶고, 그룹의 이름·색 슬롯 → 배치 프리셋(있으면) → 나머지
 * (주로 마커 슬롯)를 격자로 늘어놓는다 — 축구 게임판이라면 등번호 11개가
 * 마지막에 해당한다.
 */
export interface CustomizationFormProps {
  game: GameDefinition;
  values: GameCustomization['values'];
  errors: Record<string, string | null>;
  onChange: (slotId: string, value: string | number) => void;
  /** 그룹 id → 그 그룹에 마지막으로 적용한 프리셋 id. 버튼 활성 표시에 쓴다. */
  selectedPresetByGroup: Record<string, string | undefined>;
  onApplyPreset: (groupId: string, presetId: string) => void;
}

export function CustomizationForm({
  game,
  values,
  errors,
  onChange,
  selectedPresetByGroup,
  onApplyPreset,
}: CustomizationFormProps) {
  const ungroupedSlots = game.slots.filter((slot) => !slot.groupId);

  return (
    <div className="space-y-8">
      {ungroupedSlots.length > 0 && (
        <section className="space-y-4">
          {ungroupedSlots.map((slot) => (
            <SlotField
              key={slot.id}
              slot={slot}
              value={values[slot.id]}
              error={errors[slot.id] ?? null}
              onChange={(value) => onChange(slot.id, value)}
            />
          ))}
        </section>
      )}

      {game.groups.map((group) => {
        const groupSlots = game.slots.filter((s) => s.groupId === group.id);
        const primarySlots = groupSlots.filter(
          (s) => s.id === group.nameSlotId || s.id === group.colorSlotId,
        );
        const restSlots = groupSlots.filter(
          (s) => s.id !== group.nameSlotId && s.id !== group.colorSlotId,
        );
        const groupPresets = game.presets.filter((p) => p.groupId === group.id);

        return (
          <section key={group.id}>
            <h3 className="text-base font-semibold">{group.label}</h3>
            {primarySlots.length > 0 && (
              <div className="mt-3 space-y-4">
                {primarySlots.map((slot) => (
                  <SlotField
                    key={slot.id}
                    slot={slot}
                    value={values[slot.id]}
                    error={errors[slot.id] ?? null}
                    onChange={(value) => onChange(slot.id, value)}
                  />
                ))}
              </div>
            )}
            <FormationPicker
              presets={groupPresets}
              selectedPresetId={selectedPresetByGroup[group.id]}
              onApply={(presetId) => onApplyPreset(group.id, presetId)}
            />
            {restSlots.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {restSlots.map((slot) => (
                  <SlotField
                    key={slot.id}
                    slot={slot}
                    value={values[slot.id]}
                    error={errors[slot.id] ?? null}
                    onChange={(value) => onChange(slot.id, value)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
