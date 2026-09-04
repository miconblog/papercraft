import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Slot } from '@/lib/schema';
import { SlotField } from '../SlotField';

const textSlot: Slot = {
  id: 'team-name',
  label: '팀 이름',
  tags: [],
  placements: [{ partId: 'board', mode: 'text', xMm: 0, yMm: 0, align: 'center', fontSizeMm: 5, rotationDeg: 0 }],
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
  min: 1,
  max: 99,
  integer: true,
  default: 1,
};

const colorSlot: Slot = {
  id: 'team-color',
  label: '팀 색',
  tags: [],
  placements: [{ partId: 'board', mode: 'paint', layerId: 'pc-team', property: 'fill' }],
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
      <SlotField slot={textSlot} value="파랑 팀" error={null} onChange={onChange} />,
    );
    const input = screen.getByLabelText('팀 이름');
    fireEvent.change(input, { target: { value: '새 이름' } });
    expect(onChange).toHaveBeenCalledWith('새 이름');
  });

  it('number 슬롯은 숫자 입력이고 정수로 바꿔 알린다', () => {
    const onChange = vi.fn();
    render(
      <SlotField slot={numberSlot} value={1} error={null} onChange={onChange} />,
    );
    const input = screen.getByLabelText('1번');
    expect(input).toHaveAttribute('type', 'number');
    fireEvent.change(input, { target: { value: '7' } });
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it('color 슬롯은 색상 입력과 팔레트 없이도 동작한다', () => {
    render(
      <SlotField slot={colorSlot} value="#1d4ed8" error={null} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText('팀 색')).toBeInTheDocument();
  });

  it('choice 슬롯은 고른 값을 보여주고, 열면 선택지를 모두 보여준다', async () => {
    const user = userEvent.setup();
    render(
      <SlotField slot={choiceSlot} value="circle" error={null} onChange={vi.fn()} />,
    );
    const trigger = screen.getByLabelText('마커 모양');
    expect(trigger).toHaveTextContent('원');

    await user.click(trigger);
    expect(await screen.findByRole('option', { name: '원' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '일러스트' })).toBeInTheDocument();
  });

  it('choice 슬롯에서 다른 선택지를 고르면 그 값으로 onChange를 부른다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SlotField slot={choiceSlot} value="circle" error={null} onChange={onChange} />,
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
    expect(screen.getByLabelText('팀 이름')).toHaveAttribute('aria-invalid', 'true');
  });
});
