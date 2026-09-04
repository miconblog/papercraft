'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  applyPreset,
  defaultCustomization,
  validateSlotValue,
  type GameCustomization,
  type GameDefinition,
} from '@/lib/schema';
import { saveCustomization } from '@/lib/customization/storage';
import { useHydrated } from '@/lib/customization/useHydrated';
import { useStoredCustomization } from '@/lib/customization/useStoredCustomization';
import { CustomizationForm } from './CustomizationForm';
import { BoardPreview } from './BoardPreview';

/**
 * 커스터마이즈 에디터 진입점 (IDE-006)
 *
 * 로컬 저장값은 브라우저에만 있어 서버 렌더링 결과와 다를 수 있다. 하이드레이션이
 * 끝나기 전엔 도안 기본값으로 그리고(서버와 똑같은 화면), 끝난 뒤 저장값이
 * 있으면 `key`를 바꿔 `EditorForm`을 통째로 다시 마운트한다 — `useEffect` 안에서
 * 곧장 `setState`를 부르는 대신 마운트 시점의 초기값을 바꾸는 쪽을 택했다
 * (`useHydrated` 참고).
 */
export function EditorClient({ game }: { game: GameDefinition }) {
  const hydrated = useHydrated();
  const stored = useStoredCustomization(game);
  const initial = hydrated && stored ? stored : defaultCustomization(game);

  return (
    <EditorForm key={hydrated ? 'restored' : 'initial'} game={game} initial={initial} />
  );
}

function EditorForm({
  game,
  initial,
}: {
  game: GameDefinition;
  initial: GameCustomization;
}) {
  const [customization, setCustomization] = useState(initial);
  const [currentPartId, setCurrentPartId] = useState(
    () => game.parts.find((p) => p.kind === 'board')?.id ?? game.parts[0].id,
  );
  // 그룹 id → 마지막으로 적용한 프리셋 id. 대형 버튼의 활성 표시에만 쓴다 —
  // 좌표 자체는 `customization.positions`에 있다.
  const [selectedPresetByGroup, setSelectedPresetByGroup] = useState<
    Record<string, string | undefined>
  >({});

  // 값이 바뀔 때마다 로컬 저장소에 동기화한다 — 새로고침해도 남아야 한다는
  // 수용 기준이 근거다.
  useEffect(() => {
    saveCustomization(customization);
  }, [customization]);

  const errors = useMemo(() => {
    const result: Record<string, string | null> = {};
    for (const slot of game.slots) {
      result[slot.id] = validateSlotValue(slot, customization.values[slot.id]);
    }
    return result;
  }, [game, customization]);

  const hasErrors = Object.values(errors).some((e) => e !== null);

  const handleChange = (slotId: string, value: string | number) => {
    setCustomization((prev) => ({
      ...prev,
      values: { ...prev.values, [slotId]: value },
    }));
  };

  const handleReset = () => {
    setCustomization(defaultCustomization(game));
    setSelectedPresetByGroup({});
  };

  const handleApplyPreset = (groupId: string, presetId: string) => {
    setCustomization((prev) => applyPreset(game, prev, presetId));
    setSelectedPresetByGroup((prev) => ({ ...prev, [groupId]: presetId }));
  };

  const currentPart =
    game.parts.find((p) => p.id === currentPartId) ?? game.parts[0];

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-2">
      <div className="order-2 lg:order-1">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">입력</h2>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-black/15 px-4 py-1.5 text-sm font-medium transition-colors hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
          >
            기본값으로 되돌리기
          </button>
        </div>
        {hasErrors && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            빨간 글씨로 표시된 값을 고쳐야 인쇄물이 정확하다.
          </p>
        )}
        <div className="mt-4">
          <CustomizationForm
            game={game}
            values={customization.values}
            errors={errors}
            onChange={handleChange}
            selectedPresetByGroup={selectedPresetByGroup}
            onApplyPreset={handleApplyPreset}
          />
        </div>
      </div>

      <div className="order-1 lg:sticky lg:top-8 lg:order-2 lg:self-start">
        <h2 className="text-lg font-semibold">미리보기</h2>
        {game.parts.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {game.parts.map((part) => (
              <button
                key={part.id}
                type="button"
                onClick={() => setCurrentPartId(part.id)}
                aria-pressed={part.id === currentPartId}
                className={
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                  (part.id === currentPartId
                    ? 'bg-foreground text-background'
                    : 'border border-black/15 hover:border-black/30 dark:border-white/20 dark:hover:border-white/40')
                }
              >
                {part.title}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3">
          <BoardPreview
            key={currentPart.id}
            game={game}
            part={currentPart}
            customization={customization}
          />
        </div>
      </div>
    </div>
  );
}
