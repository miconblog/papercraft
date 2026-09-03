import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from '../page';

test('홈페이지가 h1 헤딩을 렌더링한다', () => {
  render(<Page />);
  expect(
    screen.getByRole('heading', { level: 1 })
  ).toBeInTheDocument();
});
