'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  applyPreset,
  defaultCustomization,
  findSlot,
  validateSlotValue,
  type GameCustomization,
  type GameDefinition,
  type SlotPoint,
} from '@/lib/schema';
import { movedPoint } from '@/lib/customization/movement';
import { findIndistinguishablePair } from '@/lib/customization/contrast';
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
    <EditorForm
      key={hydrated ? 'restored' : 'initial'}
      game={game}
      initial={initial}
    />
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

  // 흑백·잉크 절약 인쇄에서도 팀이 구분돼야 한다(IDE-009 수용 기준). 색 슬롯을
  // 가진 그룹만 모아 짝지어 비교한다 — 그룹이 하나뿐이면 비교할 대상이 없다.
  const groupColorPair = useMemo(() => {
    const colors = game.groups
      .map((group) => {
        const value = group.colorSlotId
          ? customization.values[group.colorSlotId]
          : undefined;
        return typeof value === 'string'
          ? { id: group.id, label: group.label, hex: value }
          : null;
      })
      .filter((c): c is { id: string; label: string; hex: string } => c !== null);
    return findIndistinguishablePair(colors);
  }, [game, customization]);

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

  /**
   * 마커를 손으로 옮긴다. 프리셋은 출발점일 뿐이라 언제든 다시 놓을 수 있다.
   *
   * 갈 수 있는 자리는 도안이 정한다(`movedPoint`) — 영역 밖으로 끌면 경계에
   * 붙는다. 화면이 제 나름대로 자르지 않고 이 규칙 하나만 쓰는 이유는, 저장
   * 검증(`validateCustomization`)이 같은 경계를 보기 때문이다.
   */
  const handleMoveSlot = (slotId: string, point: SlotPoint) => {
    const slot = findSlot(game, slotId);
    if (!slot) return;
    setCustomization((prev) => ({
      ...prev,
      positions: { ...prev.positions, [slotId]: movedPoint(game, slot, point) },
    }));
    // 손으로 옮긴 순간 그 팀은 더 이상 그 대형이 아니다 — 버튼의 눌린 표시를
    // 남겨 두면 화면이 거짓말을 한다.
    if (slot.groupId) {
      setSelectedPresetByGroup((prev) => ({
        ...prev,
        [slot.groupId as string]: undefined,
      }));
    }
  };

  const handleApplyPreset = (groupId: string, presetId: string) => {
    setCustomization((prev) => applyPreset(game, prev, presetId));
    setSelectedPresetByGroup((prev) => ({ ...prev, [groupId]: presetId }));
  };

  const currentPart =
    game.parts.find((p) => p.id === currentPartId) ?? game.parts[0];

  const formProps = {
    game,
    values: customization.values,
    errors,
    onChange: handleChange,
    selectedPresetByGroup,
    onApplyPreset: handleApplyPreset,
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">입력</h2>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full border border-black/15 px-4 py-1.5 text-sm font-medium outline-none transition-colors hover:border-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:border-white/40"
        >
          기본값으로 되돌리기
        </button>
      </div>
      {hasErrors && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          빨간 글씨로 표시된 값을 고쳐야 인쇄물이 정확하다.
        </p>
      )}
      {groupColorPair && (
        <p
          role="alert"
          className="mt-3 text-sm text-amber-700 dark:text-amber-400"
        >
          {groupColorPair.a.label}과 {groupColorPair.b.label}의 색이 밝기가
          비슷해 흑백·잉크 절약 인쇄에서 구분되지 않을 수 있다 — 한쪽을 더
          밝거나 어둡게 바꾼다.
        </p>
      )}

      {game.parts.length > 1 && (
        <div
          className="mt-5 flex flex-wrap gap-2"
          role="group"
          aria-label="편집할 파트 선택"
        >
          {game.parts.map((part) => (
            <button
              key={part.id}
              type="button"
              onClick={() => setCurrentPartId(part.id)}
              aria-pressed={part.id === currentPartId}
              className={
                'rounded-full px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ' +
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

      {/*
        미리보기를 폭 전체로 크게 놓는다. 두 팀이 운동장 전체에 섞여 서기
        때문에(IDE-010) 마커가 촘촘해져, 좁게 두면 어느 것이 누구인지 알아볼 수
        없다.

        폭만 늘리면 세로로 긴 파트(게임 방법 148.5×210mm)가 화면을 한참 넘어가므로
        **높이를 뷰포트에 묶고** 그 높이에서 나오는 폭까지만 넓힌다. 파트마다
        가로세로비가 달라 이 계산을 CSS 클래스로는 쓸 수 없다.
      */}
      {/* 파트를 바꾸면 미리보기 아래 배치가 통째로 바뀐다 — 화면으로는
          보이지만 스크린리더는 놓치기 쉬워 이름을 소리로도 알린다. */}
      <p role="status" className="sr-only">
        {currentPart.title} 미리보기
      </p>
      <div
        className="mx-auto mt-3 w-full"
        style={{
          maxWidth: `calc(85vh * ${currentPart.widthMm} / ${currentPart.heightMm})`,
        }}
      >
        <BoardPreview
          key={currentPart.id}
          game={game}
          part={currentPart}
          customization={customization}
          onMoveSlot={handleMoveSlot}
        />
      </div>

      {/* 어느 그룹에도 속하지 않는 값(마커 모양)은 양 팀에 함께 걸린다.
          팀별 입력보다 먼저 오는 자리가 그 뜻에 맞는다. */}
      <div className="mt-6 max-w-xs">
        <CustomizationForm {...formProps} groupIds={[]} />
      </div>

      {/* 그룹(팀)을 나란히 놓는다. 축구 게임판이라면 홈과 원정이다 — 게임을
          알아서가 아니라 `game.groups`를 그대로 늘어놓은 결과다. */}
      <div
        className={
          'mt-8 grid gap-8 border-t border-black/10 pt-8 dark:border-white/15' +
          (game.groups.length > 1 ? ' sm:grid-cols-2' : '')
        }
      >
        {game.groups.map((group) => (
          <CustomizationForm
            key={group.id}
            {...formProps}
            groupIds={[group.id]}
            includeUngrouped={false}
          />
        ))}
      </div>
    </div>
  );
}
