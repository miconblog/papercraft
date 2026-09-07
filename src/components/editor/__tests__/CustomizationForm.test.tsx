import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
function renderForm(
  overrides: Partial<Parameters<typeof CustomizationForm>[0]> = {},
) {
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
  it('그룹의 이름·색 슬롯은 그리고, 마커로 놓이는 슬롯은 입력을 내지 않는다', () => {
    renderForm();
    expect(screen.getByLabelText('팀 이름')).toBeInTheDocument();
    expect(screen.getByLabelText('팀 색')).toBeInTheDocument();
    // 마커 슬롯의 편집은 미리보기에서 끌어 놓는 것이다(IDE-012). 값은 아이가
    // 종이에 쓰는 자리라 입력을 두지 않는다(2026-09-06).
    expect(screen.queryByLabelText('빨강 1번')).toBeNull();
    expect(screen.queryByLabelText('빨강 2번')).toBeNull();
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

  it('그룹에 배치 프리셋이 있으면 대형 셀렉트를 보여주고, 고른 것이 없으면 "직접 배치"다', () => {
    renderForm();
    expect(screen.getByLabelText(/대형$/)).toHaveTextContent('직접 배치');
  });

  /**
   * `partId`를 주면 그 파트에 쓰이는 옵션만 남는다(2026-09-08). 픽스처의 제목
   * 슬롯과 대형은 `board`에만 있고, 팀 색은 배치가 없어도 마커를 칠하므로 남는다.
   */
  it('partId를 주면 그 파트에 쓰이는 옵션만 남는다', () => {
    renderForm({ partId: 'board' });
    expect(screen.getByLabelText('제목')).toBeInTheDocument();
    expect(screen.getByLabelText('팀 색')).toBeInTheDocument();
  });

  it('마커도 배치도 없는 파트에서는 아무 옵션도 그리지 않는다', () => {
    const { container } = renderForm({ partId: '없는-파트' });
    expect(screen.queryByLabelText('제목')).toBeNull();
    expect(screen.queryByLabelText('팀 이름')).toBeNull();
    expect(screen.queryByLabelText('팀 색')).toBeNull();
    // 제목만 남은 빈 그룹 상자도 그리지 않는다.
    expect(container.querySelectorAll('section')).toHaveLength(0);
  });

  it('대형을 고르면 그룹 id와 프리셋 id로 onApplyPreset을 부른다', async () => {
    const user = userEvent.setup();
    const onApplyPreset = vi.fn();
    renderForm({ onApplyPreset });
    await user.click(screen.getByLabelText(/대형$/));
    await user.click(await screen.findByRole('option', { name: '벌린 배치' }));
    expect(onApplyPreset).toHaveBeenCalledWith('red', 'spread');
  });

  it('선택된 프리셋을 셀렉트에 보여준다', () => {
    renderForm({ selectedPresetByGroup: { red: 'spread' } });
    expect(screen.getByLabelText(/대형$/)).toHaveTextContent('벌린 배치');
  });
});
