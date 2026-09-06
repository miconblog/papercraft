'use client';

import {
  slotMarker,
  type GameCustomization,
  type GameDefinition,
} from '@/lib/schema';
import { SlotField } from './SlotField';
import { FormationPicker } from './FormationPicker';

/**
 * 도안 스키마를 읽어 폼을 그리는 렌더러 (IDE-006)
 *
 * 게임마다 새로 만들지 않는다 — `game.slots`·`game.groups`·`game.presets`만
 * 순회할 뿐, 특정 게임의 슬롯 id나 이름을 알지 못한다. 그룹(팀) 소속 슬롯은
 * 그룹 섹션 아래로 묶고, 그룹의 이름·색 슬롯 → 배치 프리셋(있으면) → 나머지
 * 슬롯 차례로 늘어놓는다.
 *
 * **마커로 놓이는 슬롯은 폼에 내지 않는다.** 그 슬롯의 편집은 미리보기에서
 * 끌어 놓는 것이고(IDE-012), 값(등번호)은 아이가 종이에 직접 쓰는 자리라 기본이
 * 비어 있다(2026-09-05). 축구 게임판의 등번호 입력 22개가 그렇게 빠졌다
 * (2026-09-06 사용자 요청 — "최대한 간결하고 직관적으로"). 마커 슬롯의 값을
 * 받고 싶은 도안은 그 슬롯에 글자 배치를 더한다.
 *
 * `groupIds`·`includeUngrouped`로 **일부만** 그릴 수 있다. 에디터가 공통 값은
 * 미리보기 위 도구 막대에, 그룹은 미리보기 아래 팀 줄에 나눠 앉히기 때문이다
 * (`EditorClient`). 값을 주지 않으면 전부 그린다.
 *
 * 전부 **한 줄 배치**다(2026-09-06 사용자 요청 — "불필요한 개행이 너무 많아").
 * 그룹 하나가 제목·색·대형 버튼이 이어진 한 줄이고, 폭이 모자라면 줄이 접힌다.
 */
export interface CustomizationFormProps {
  game: GameDefinition;
  values: GameCustomization['values'];
  errors: Record<string, string | null>;
  onChange: (slotId: string, value: string | number) => void;
  /** 그룹 id → 그 그룹에 마지막으로 적용한 프리셋 id. 버튼 활성 표시에 쓴다. */
  selectedPresetByGroup: Record<string, string | undefined>;
  onApplyPreset: (groupId: string, presetId: string) => void;
  /** 그릴 그룹. 주지 않으면 도안의 그룹을 모두 그린다. */
  groupIds?: readonly string[];
  /** 그룹에 속하지 않는 슬롯도 그릴지. */
  includeUngrouped?: boolean;
}

export function CustomizationForm({
  game,
  values,
  errors,
  onChange,
  selectedPresetByGroup,
  onApplyPreset,
  groupIds,
  includeUngrouped = true,
}: CustomizationFormProps) {
  const ungroupedSlots = includeUngrouped
    ? game.slots.filter((slot) => !slot.groupId && !slotMarker(slot))
    : [];
  const groups = groupIds
    ? game.groups.filter((g) => groupIds.includes(g.id))
    : game.groups;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {ungroupedSlots.map((slot) => (
        <SlotField
          key={slot.id}
          slot={slot}
          value={values[slot.id]}
          error={errors[slot.id] ?? null}
          onChange={(value) => onChange(slot.id, value)}
          inline
        />
      ))}

      {groups.map((group) => {
        const groupSlots = game.slots.filter((s) => s.groupId === group.id);
        const primarySlots = groupSlots.filter(
          (s) => s.id === group.nameSlotId || s.id === group.colorSlotId,
        );
        const restSlots = groupSlots.filter(
          (s) =>
            s.id !== group.nameSlotId &&
            s.id !== group.colorSlotId &&
            !slotMarker(s),
        );
        const groupPresets = game.presets.filter((p) => p.groupId === group.id);

        // 그룹 하나가 한 줄이다: 제목 → 이름·색 → 대형 버튼. 제목이 이미 어느
        // 팀인지 말하므로 이름·색 라벨은 숨긴다.
        return (
          <section
            key={group.id}
            className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
            aria-label={group.label}
          >
            <h3 className="text-sm font-semibold">{group.label}</h3>
            {primarySlots.map((slot) => (
              <SlotField
                key={slot.id}
                slot={slot}
                value={values[slot.id]}
                error={errors[slot.id] ?? null}
                onChange={(value) => onChange(slot.id, value)}
                inline
                labelHidden
              />
            ))}
            <FormationPicker
              presets={groupPresets}
              selectedPresetId={selectedPresetByGroup[group.id]}
              onApply={(presetId) => onApplyPreset(group.id, presetId)}
              inline
            />
            {restSlots.map((slot) => (
              <SlotField
                key={slot.id}
                slot={slot}
                value={values[slot.id]}
                error={errors[slot.id] ?? null}
                onChange={(value) => onChange(slot.id, value)}
                inline
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
