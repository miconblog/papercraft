import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Slot } from '@/lib/schema';
import { SlotField } from '../SlotField';

const textSlot: Slot = {
  id: 'team-name',
  label: '팀 이름',
  tags: [],
  placements: [
    {
      partId: 'board',
      mode: 'text',
      xMm: 0,
      yMm: 0,
      align: 'center',
      fontSizeMm: 5,
      rotationDeg: 0,
    },
  ],
  kind: 'text',
  maxLength: 10,
  default: '파랑 팀',
};

const numberSlot: Slot = {
  id: 'player-1',
  label: '1번',
  tags: [],
  placements: [
    {
      partId: 'board',
      mode: 'marker',
      xMm: 0,
      yMm: 0,
      styleSetId: 'piece',
      regionId: 'field',
    },
  ],
  kind: 'number',
  presets: [],
  min: 1,
  max: 99,
  integer: true,
  default: 1,
};

const colorSlot: Slot = {
  id: 'team-color',
  label: '팀 색',
  tags: [],
  placements: [
    { partId: 'board', mode: 'paint', layerId: 'pc-team', property: 'fill' },
  ],
  kind: 'color',
  default: '#1d4ed8',
};

const choiceSlot: Slot = {
  id: 'marker-style',
  label: '마커 모양',
  tags: [],
  placements: [{ partId: 'board', mode: 'control' }],
  kind: 'choice',
  options: [
    { value: 'circle', label: '원' },
    { value: 'illustration', label: '일러스트' },
  ],
  default: 'circle',
};

describe('SlotField (IDE-006 — 슬롯 kind별 입력 컴포넌트)', () => {
  it('text 슬롯은 텍스트 입력이고 변경을 알린다', () => {
    const onChange = vi.fn();
    render(
      <SlotField
        slot={textSlot}
        value="파랑 팀"
        error={null}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('팀 이름');
    fireEvent.change(input, { target: { value: '새 이름' } });
    expect(onChange).toHaveBeenCalledWith('새 이름');
  });

  it('number 슬롯은 숫자 입력이고 정수로 바꿔 알린다', () => {
    const onChange = vi.fn();
    render(
      <SlotField
        slot={numberSlot}
        value={1}
        error={null}
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('1번');
    expect(input).toHaveAttribute('type', 'number');
    fireEvent.change(input, { target: { value: '7' } });
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it('color 슬롯은 색상 입력과 팔레트 없이도 동작한다', () => {
    render(
      <SlotField
        slot={colorSlot}
        value="#1d4ed8"
        error={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('팀 색')).toBeInTheDocument();
  });

  it('choice 슬롯은 고른 값을 보여주고, 열면 선택지를 모두 보여준다', async () => {
    const user = userEvent.setup();
    render(
      <SlotField
        slot={choiceSlot}
        value="circle"
        error={null}
        onChange={vi.fn()}
      />,
    );
    const trigger = screen.getByLabelText('마커 모양');
    expect(trigger).toHaveTextContent('원');

    await user.click(trigger);
    expect(
      await screen.findByRole('option', { name: '원' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: '일러스트' }),
    ).toBeInTheDocument();
  });

  it('choice 슬롯에서 다른 선택지를 고르면 그 값으로 onChange를 부른다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SlotField
        slot={choiceSlot}
        value="circle"
        error={null}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByLabelText('마커 모양'));
    // 팝업이 열리는 애니메이션 상태(`data-closed`)가 걷힐 때까지 기다린다 —
    // 클릭 직후엔 접근성 트리에서 아직 안 보일 수 있다.
    const option = await screen.findByRole('option', { name: '일러스트' });
    await user.click(option);
    expect(onChange).toHaveBeenCalledWith('illustration');
  });

  it('오류가 있으면 메시지를 보여주고 입력에 연결한다', () => {
    render(
      <SlotField
        slot={textSlot}
        value="12345678901"
        error="10자 이내로 입력한다"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('10자 이내로 입력한다');
    expect(screen.getByLabelText('팀 이름')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});

describe('예산 슬롯 (IDE-044 — 나눠 주는데 합에 상한이 있다)', () => {
  const budgetSlot: Slot = {
    id: 'defense-ability',
    label: '팀 수비 능력치',
    tags: [],
    placements: [{ partId: 'board', mode: 'control' }],
    kind: 'budget',
    items: [
      { id: 'shortstop', label: '유격수', max: 6 },
      { id: 'center', label: '중견수', max: 6 },
      { id: 'right', label: '우익수', max: 6 },
    ],
    total: 10,
    unit: 'mm',
    default: [0, 0, 0],
  };

  const renderBudget = (value: number[], onChange = vi.fn()) => {
    render(
      <SlotField
        slot={budgetSlot}
        value={value}
        error={null}
        onChange={onChange}
      />,
    );
    return onChange;
  };

  it('항목마다 입력이 하나씩, 남은 예산이 함께 보인다', () => {
    renderBudget([4, 2, 0]);
    for (const label of ['유격수', '중견수', '우익수']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    // 10에서 6을 썼으니 4가 남는다.
    expect(screen.getByText('4mm')).toBeTruthy();
  });

  it('남은 예산까지만 올릴 수 있다 — 눌렀는데 곧장 오류가 되는 자리가 없다', () => {
    renderBudget([4, 2, 0]);
    // 자기 몫 2 + 남은 4 = 6이고 그것이 마침 한 자리 상한이다.
    expect(screen.getByLabelText('중견수').getAttribute('max')).toBe('6');
    // 아직 받지 않은 자리는 남은 예산만큼만 — 상한 6보다 작다.
    expect(screen.getByLabelText('우익수').getAttribute('max')).toBe('4');
  });

  it('한 칸을 고치면 나머지는 그대로인 배열이 돌아온다', () => {
    const onChange = renderBudget([4, 2, 0]);
    fireEvent.change(screen.getByLabelText('우익수'), {
      target: { value: '3' },
    });
    expect(onChange).toHaveBeenCalledWith([4, 2, 3]);
  });

  it('다 쓰면 남은 예산이 0이고 빈 자리는 더 못 받는다', () => {
    renderBudget([6, 4, 0]);
    expect(screen.getByText('0mm')).toBeTruthy();
    expect(screen.getByLabelText('우익수').getAttribute('max')).toBe('0');
  });
});
