/**
 * 나라별 지도 툴팁
 *
 * 포인터가 나라 위에 있으면 값과 이름을, 나라 밖(바다)이나 틀 밖으로 나가면
 * 아무것도 띄우지 않는다. 키보드 초점에도 같은 툴팁이 뜬다.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MapHover } from '../MapHover';

const map = () =>
  render(
    <MapHover>
      <svg>
        <rect data-testid="ocean" />
        <path
          data-testid="kr"
          data-name="대한민국"
          data-value="방문 412"
          tabIndex={0}
        />
      </svg>
    </MapHover>,
  );

describe('MapHover', () => {
  it('나라 위에서 값과 이름을 띄우고, 바다로 나가면 지운다', () => {
    map();
    fireEvent.pointerMove(screen.getByTestId('kr'));
    expect(screen.getByText('방문 412')).toBeInTheDocument();
    expect(screen.getByText('대한민국')).toBeInTheDocument();

    fireEvent.pointerMove(screen.getByTestId('ocean'));
    expect(screen.queryByText('방문 412')).toBeNull();
  });

  it('틀 밖으로 나가면 지운다', () => {
    const { container } = map();
    fireEvent.pointerMove(screen.getByTestId('kr'));
    fireEvent.pointerLeave(container.firstElementChild!);
    expect(screen.queryByText('방문 412')).toBeNull();
  });

  it('키보드 초점에도 같은 툴팁이 뜬다', () => {
    map();
    fireEvent.focus(screen.getByTestId('kr'));
    expect(screen.getByText('방문 412')).toBeInTheDocument();
    fireEvent.blur(screen.getByTestId('kr'));
    expect(screen.queryByText('방문 412')).toBeNull();
  });
});
