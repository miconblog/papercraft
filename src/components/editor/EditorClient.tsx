'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  applyPreset,
  defaultCustomization,
  findSlot,
  resolveParts,
  slotsAffectingPart,
  validateSlotValue,
  type GameCustomization,
  type GameDefinition,
  type SlotPoint,
  type SlotValue,
} from '@/lib/schema';
import { movedPoint } from '@/lib/customization/movement';
import {
  getSaveFailure,
  getServerSaveFailure,
  saveCustomization,
  subscribeSaveFailure,
  SAVE_FAILURE_MESSAGE,
} from '@/lib/customization/storage';
import { useHydrated } from '@/lib/customization/useHydrated';
import { useStoredCustomization } from '@/lib/customization/useStoredCustomization';
import { PrintDialog } from '@/components/print/PrintDialog';
import {
  CustomizationForm,
  formGroupsFor,
  hasUngroupedFormSlots,
} from './CustomizationForm';
import { BoardPreview } from './BoardPreview';
import { ListSlotPanel } from './ListSlotPanel';
import { OutlineSlotPanel } from './OutlineSlotPanel';

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
      // 하이드레이션 전 첫 화면은 기본값이다. 그때 저장하면 사용자가 만든 값을
      // 기본값으로 덮어쓴 뒤에야 복원이 시작된다 — 복원할 것이 이미 없다
      // (2026-09-08 "새로고침하면 경로가 초기화된다"). 복원이 끝난 폼만 저장한다.
      persist={hydrated}
    />
  );
}

function EditorForm({
  game,
  initial,
  persist,
}: {
  game: GameDefinition;
  initial: GameCustomization;
  persist: boolean;
}) {
  const [customization, setCustomization] = useState(initial);
  const [currentPartId, setCurrentPartId] = useState(
    () => game.parts.find((p) => p.kind === 'board')?.id ?? game.parts[0].id,
  );
  // 그룹 id → 지금 좌표가 어느 프리셋인지. 셀렉트 박스의 표시에만 쓴다 —
  // 좌표 자체는 `customization.positions`에 있다. 처음 값은 좌표에서 알아낸다:
  // 기본 좌표는 기본 대형이고, 저장값을 복원했을 때도 그 대형 그대로여야
  // 셀렉트가 "직접 배치"라고 거짓말하지 않는다.
  const [selectedPresetByGroup, setSelectedPresetByGroup] = useState<
    Record<string, string | undefined>
  >(() =>
    Object.fromEntries(
      game.groups.map((group) => [
        group.id,
        matchingPresetId(game, initial, group.id),
      ]),
    ),
  );

  /**
   * 저장에 실패해 있으면 그 사유(IDE-020). 값은 메모리에 멀쩡히 있고 인쇄도
   * 되지만 "다음에 다시 여는 것"만 못 한다 — 그 말을 한 자리에서 한 번만 한다.
   *
   * 저장소 쪽이 실패한 키를 들고 있고 여기서는 구독만 한다. 효과 안에서 곧장
   * `setState`를 부르지 않으려는 것이기도 하고(`useHydrated` 참고), 사진을
   * 남기는 것도 같은 저장소를 쓰므로(윤곽 패널) 두 자리에서 같은 경고가
   * 나오지 않게 하려는 것이기도 하다.
   */
  const saveIssue = useSyncExternalStore(
    subscribeSaveFailure,
    getSaveFailure,
    getServerSaveFailure,
  );

  // 값이 바뀔 때마다 로컬 저장소에 동기화한다 — 새로고침해도 남아야 한다는
  // 수용 기준이 근거다.
  useEffect(() => {
    if (persist) saveCustomization(customization);
  }, [customization, persist]);

  const errors = useMemo(() => {
    const result: Record<string, string | null> = {};
    for (const slot of game.slots) {
      result[slot.id] = validateSlotValue(slot, customization.values[slot.id]);
    }
    return result;
  }, [game, customization]);

  const hasErrors = Object.values(errors).some((e) => e !== null);

  const handleChange = (slotId: string, value: SlotValue) => {
    setCustomization((prev) => ({
      ...prev,
      values: { ...prev.values, [slotId]: value },
    }));
  };

  const handleReset = () => {
    const defaults = defaultCustomization(game);
    setCustomization(defaults);
    setSelectedPresetByGroup(
      Object.fromEntries(
        game.groups.map((group) => [
          group.id,
          matchingPresetId(game, defaults, group.id),
        ]),
      ),
    );
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

  // 변형이 있는 파트는 지금 값의 모습이다(IDE-016) — 도시 수를 바꾸면 미리보기의
  // 크기·그림과 파트 버튼의 제목이 함께 바뀐다. 파트 id는 원본 그대로다.
  const parts = resolveParts(game, customization);
  const currentPart = parts.find((p) => p.id === currentPartId) ?? parts[0];

  // 옵션은 **지금 보는 파트에 쓰이는 것만** 낸다(2026-09-08 사용자 요청 —
  // "점수 기록칸이나 골대 전개도를 선택하면 운동장 옵션은 모두 숨겨줘").
  // 골대 전개도처럼 고칠 것이 하나도 없는 파트에서는 두 줄이 통째로 사라진다 —
  // 빈 상자가 여백만 남기지 않게 한다.
  const hasUngroupedSlots = hasUngroupedFormSlots(game, currentPart.id);
  const visibleGroups = formGroupsFor(game, currentPart.id);
  // 목록 슬롯(세계일주의 도시 목록)은 판 아래에 패널로 놓는다 — 항목이 백 개가
  // 넘어 한 줄 입력에 들어가지 않고, 판과 나란히 보여야 켜고 끈 결과가 읽힌다.
  const partSlots = slotsAffectingPart(game, currentPart.id);
  const listSlots = partSlots.filter((slot) => slot.kind === 'list');
  // 윤곽 슬롯(점 잇기의 사진)도 판 아래 패널이다 — 사진 넣기·밝기·돌리기와
  // 점 개수가 한 자리에 모여야 "왜 개수가 여기서 멈추는지"가 보인다(IDE-020).
  //
  // 세부 선 슬롯은 제 패널을 갖지 않는다(IDE-021) — 같은 사진에서 같은 조작으로
  // 나오므로 윤곽 슬롯의 패널이 함께 그린다. 안 걸러 내면 사진 넣는 상자가 둘이 된다.
  const detailSlotIds = new Set(
    game.slots.flatMap((s) =>
      s.kind === 'outline' && s.detailSlotId ? [s.detailSlotId] : [],
    ),
  );
  const outlineSlots = partSlots.filter(
    (slot) => slot.kind === 'outline' && !detailSlotIds.has(slot.id),
  );

  const formProps = {
    game,
    values: customization.values,
    errors,
    onChange: handleChange,
    selectedPresetByGroup,
    onApplyPreset: handleApplyPreset,
    partId: currentPart.id,
  };

  return (
    <div
      className="mx-auto mt-4 w-full"
      // 미리보기를 폭 전체로 크게 놓는다. 두 팀이 운동장 전체에 섞여 서기
      // 때문에(IDE-010) 마커가 촘촘해져, 좁게 두면 어느 것이 누구인지 알아볼 수
      // 없다. 폭만 늘리면 세로로 긴 파트가 화면을 한참 넘어가므로 **높이를
      // 뷰포트에 묶고** 그 높이에서 나오는 폭까지만 넓힌다 — 파트마다 가로세로비가
      // 달라 CSS 클래스로는 쓸 수 없다. 도구 막대와 팀 줄도 이 상자 안에 있어
      // 미리보기와 양끝이 맞는다.
      //
      // 높이 예산은 "화면 높이 − 위아래에 놓이는 것들"이다 — 사이트 머리글·
      // 돌아가기·제목·도구 막대·팀 줄이 대략 270px이다. 비율(80vh)로 잡았더니
      // 1000px 화면에서 팀 줄이 화면 밖으로 밀렸다(2026-09-06).
      style={{
        maxWidth: `calc((100vh - 270px) * ${currentPart.widthMm} / ${currentPart.heightMm})`,
      }}
    >
      {/* 도구 막대 — 왼쪽은 파트 선택, 오른쪽은 양 팀에 함께 걸리는 값(마커
          모양)과 되돌리기. 한 줄이고, 폭이 모자라면 오른쪽 묶음이 아래로
          접힌다(2026-09-06 레이아웃 정리 — "불필요한 개행이 너무 많아"). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {game.parts.length > 1 && (
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="편집할 파트 선택"
          >
            {parts.map((part) => (
              <button
                key={part.id}
                type="button"
                onClick={() => setCurrentPartId(part.id)}
                aria-pressed={part.id === currentPartId}
                className={
                  'rounded-full px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ' +
                  (part.id === currentPartId
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border hover:border-primary')
                }
              >
                {part.title}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          {hasUngroupedSlots && (
            <CustomizationForm {...formProps} groupIds={[]} />
          )}
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-border px-3 py-1 text-xs font-medium outline-none transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            기본값으로 되돌리기
          </button>
          {/* 인쇄는 여기서 모달로 연다 — 페이지를 옮기지 않는다(2026-09-06 사용자
              요청). 지금 화면의 값을 그대로 넘겨 "보이는 그대로 뽑힌다". */}
          <PrintDialog game={game} customization={customization} />
        </div>
      </div>
      {hasErrors && (
        <p className="mt-2 text-sm text-destructive">
          빨간 글씨로 표시된 값을 고쳐야 인쇄물이 정확하다.
        </p>
      )}
      {saveIssue && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {SAVE_FAILURE_MESSAGE[saveIssue]}
        </p>
      )}

      {/* 파트를 바꾸면 미리보기가 통째로 바뀐다 — 화면으로는 보이지만
          스크린리더는 놓치기 쉬워 이름을 소리로도 알린다. */}
      <p role="status" className="sr-only">
        {currentPart.title} 미리보기
      </p>
      <div className="mt-2">
        <BoardPreview
          key={currentPart.id}
          game={game}
          part={currentPart}
          customization={customization}
          onMoveSlot={handleMoveSlot}
        />
      </div>

      {listSlots.map((slot) =>
        slot.kind === 'list' ? (
          <ListSlotPanel
            key={slot.id}
            slot={slot}
            value={customization.values[slot.id]}
            error={errors[slot.id] ?? null}
            part={currentPart}
            gameId={game.id}
            onChange={(value) => handleChange(slot.id, value)}
          />
        ) : null,
      )}

      {outlineSlots.map((slot) => {
        if (slot.kind !== 'outline') return null;
        // 개수 슬롯은 **지금 보는 파트에 쓰일 때만** 함께 낸다. 점 잇기의 완성
        // 그림 부속에는 점이 없어, 거기서 개수를 물으면 안 그려질 값을 묻는 것이다.
        const countSlot = partSlots.find(
          (s) => s.id === slot.countSlotId && s.kind === 'number',
        );
        // 세부 슬롯은 파트를 가리지 않는다 — 판에도 완성 그림에도 그려진다.
        const detailSlot = game.slots.find(
          (s) => s.id === slot.detailSlotId && s.kind === 'outline',
        );
        return (
          <OutlineSlotPanel
            key={slot.id}
            slot={slot}
            value={customization.values[slot.id]}
            error={errors[slot.id] ?? null}
            gameId={game.id}
            countSlot={countSlot?.kind === 'number' ? countSlot : undefined}
            countValue={countSlot && customization.values[countSlot.id]}
            countError={countSlot ? (errors[countSlot.id] ?? null) : null}
            detailSlot={detailSlot?.kind === 'outline' ? detailSlot : undefined}
            detailValue={detailSlot && customization.values[detailSlot.id]}
            onChange={handleChange}
          />
        );
      })}

      {/* 팀 줄 — 그룹(팀)마다 제목·색·대형이 한 줄이다. 축구 게임판이라면 홈과
          원정이 나란히 서고, 폭이 모자라면 원정이 아랫줄로 내려간다. 게임을
          알아서가 아니라 `game.groups`를 그대로 늘어놓은 결과다. */}
      {visibleGroups.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-8 gap-y-2">
          {visibleGroups.map((group) => (
            <CustomizationForm
              key={group.id}
              {...formProps}
              groupIds={[group.id]}
              includeUngrouped={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 이 그룹의 지금 좌표와 **정확히 같은** 프리셋의 id. 없으면 `undefined`
 * (손으로 옮긴 배치). 회전은 보지 않는다 — 프리셋은 좌표만 정한다.
 */
function matchingPresetId(
  game: GameDefinition,
  customization: GameCustomization,
  groupId: string,
): string | undefined {
  return game.presets.find(
    (preset) =>
      preset.groupId === groupId &&
      preset.positions.every((pos) => {
        const point = customization.positions[pos.slotId];
        return point?.xMm === pos.xMm && point?.yMm === pos.yMm;
      }),
  )?.id;
}
