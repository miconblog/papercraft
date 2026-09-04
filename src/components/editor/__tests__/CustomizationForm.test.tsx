import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { defaultCustomization, parseGame } from '@/lib/schema';
import { makeGameWithMarkers } from '@/lib/schema/__tests__/fixtures';
import { CustomizationForm } from '../CustomizationForm';

// 그룹 소속 슬롯(팀 이름·색·마커)뿐 아니라 그룹에 속하지 않은 슬롯도
// 렌더링되는지 보려고 하나 더 얹는다 — 축구 게임판의 `marker-style` 선택
// 슬롯이 이 자리에 해당한다.
const game = parseGame(
  makeGameWithMarkers({
    slots: [
      ...makeGameWithMarkers().slots,
      {
        id: 'headline',
        kind: 'text',
        label: '제목',
        maxLength: 10,
        default: '한판',
        placements: [
          { partId: 'board', mode: 'text', xMm: 105, yMm: 20, fontSizeMm: 6 },
        ],
      },
    ],
  }),
);

/** 공통 props에서 필요한 것만 덮어써 렌더링한다. */
function renderForm(overrides: Partial<Parameters<typeof CustomizationForm>[0]> = {}) {
  const customization = defaultCustomization(game);
  return render(
    <CustomizationForm
      game={game}
      values={customization.values}
      errors={{}}
      onChange={vi.fn()}
      selectedPresetByGroup={{}}
      onApplyPreset={vi.fn()}
      {...overrides}
    />,
  );
}

describe('CustomizationForm (IDE-006 — 스키마를 읽어 폼을 자동 생성)', () => {
  it('그룹의 이름·색·마커 슬롯을 모두 그린다', () => {
    renderForm();
    expect(screen.getByLabelText('팀 이름')).toBeInTheDocument();
    expect(screen.getByLabelText('팀 색')).toBeInTheDocument();
    expect(screen.getByLabelText('빨강 1번')).toBeInTheDocument();
    expect(screen.getByLabelText('빨강 2번')).toBeInTheDocument();
  });

  it('그룹 소속이 아닌 슬롯도 그린다', () => {
    renderForm();
    expect(screen.getByLabelText('제목')).toBeInTheDocument();
  });

  it('입력을 바꾸면 슬롯 id와 새 값으로 onChange를 부른다', () => {
    const onChange = vi.fn();
    renderForm({ onChange });
    const input = screen.getByLabelText('팀 이름');
    fireEvent.change(input, { target: { value: '새 팀' } });
    expect(onChange).toHaveBeenCalledWith('red-name', '새 팀');
  });

  it('슬롯의 오류를 해당 필드 아래에 보여준다', () => {
    renderForm({ errors: { 'red-name': '10자 이내로 입력한다' } });
    expect(screen.getByRole('alert')).toHaveTextContent('10자 이내로 입력한다');
  });

  it('그룹에 배치 프리셋이 있으면 대형 버튼을 보여준다', () => {
    renderForm();
    expect(screen.getByRole('button', { name: '벌린 배치' })).toBeInTheDocument();
  });

  it('대형 버튼을 누르면 그룹 id와 프리셋 id로 onApplyPreset을 부른다', () => {
    const onApplyPreset = vi.fn();
    renderForm({ onApplyPreset });
    fireEvent.click(screen.getByRole('button', { name: '벌린 배치' }));
    expect(onApplyPreset).toHaveBeenCalledWith('red', 'spread');
  });

  it('선택된 프리셋 버튼을 눌린 상태로 표시한다', () => {
    renderForm({ selectedPresetByGroup: { red: 'spread' } });
    expect(screen.getByRole('button', { name: '벌린 배치' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
