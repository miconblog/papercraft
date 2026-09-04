import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { defaultCustomization } from '@/lib/schema';
import { getGame } from '@/lib/games';
import { BoardPreview } from '../BoardPreview';

const game = getGame('soccer')!;
const board = game.parts.find((p) => p.kind === 'board')!;

const publicDir = path.join(process.cwd(), 'public');
const readPublic = (assetPath: string) =>
  readFileSync(path.join(publicDir, assetPath), 'utf-8');

describe('BoardPreview — 마커 아트워크 (선수 마커 모양을 실제 그림으로 보여준다)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        text: async () => readPublic(url),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('기본 스타일(원형)의 실제 아트워크를 불러와 팀 색으로 칠한다', async () => {
    const customization = defaultCustomization(game);
    render(
      <BoardPreview game={game} part={board} customization={customization} />,
    );

    await waitFor(() => {
      // 원형 마커 SVG의 표식 — 원+등번호 대체 표시(circle만 있고 pc-art
      // 레이어가 없다)가 아니라 실제 아트워크가 꽂혔는지 이 id로 구분한다.
      expect(document.querySelector('[id="pc-marker-fill"]')).toBeInTheDocument();
    });
    const fillLayer = document.querySelector('[id="pc-marker-fill"]')!;
    // 홈 팀 기본색(#1d4ed8)으로 칠해졌다.
    expect(fillLayer.getAttribute('fill')).toBe('#1d4ed8');
  });

  it('마커 모양을 일러스트로 바꾸면 일러스트 아트워크가 반영된다', async () => {
    const customization = defaultCustomization(game);
    customization.values['marker-style'] = 'illustration';
    render(
      <BoardPreview game={game} part={board} customization={customization} />,
    );

    await waitFor(() => {
      const titles = [...document.querySelectorAll('svg.absolute title')].map(
        (t) => t.textContent,
      );
      expect(titles.some((t) => t?.includes('일러스트'))).toBe(true);
    });
  });

  it('아트워크를 불러오기 전에는 원 + 값으로 대체해 보여준다', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // 영원히 응답 없음
    const customization = defaultCustomization(game);
    render(
      <BoardPreview game={game} part={board} customization={customization} />,
    );
    // 등번호 값 자체는 즉시 보인다 — 대체 표시(circle)만 그림 대신 쓴다.
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(document.querySelector('[id="pc-marker-fill"]')).not.toBeInTheDocument();
  });
});
