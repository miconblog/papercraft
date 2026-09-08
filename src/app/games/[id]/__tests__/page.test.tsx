import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page, { generateStaticParams } from '../page';
import { getGame } from '@/lib/games';
import { groupRuleSections } from '@/lib/schema';

describe('게임 상세 페이지', () => {
  it('등록된 게임마다 정적 경로 params를 만든다', () => {
    expect(generateStaticParams()).toEqual(
      expect.arrayContaining([{ id: 'soccer' }]),
    );
  });

  it('축구 게임판 상세를 렌더링한다 — 제목·인원·구성·만들기 링크', async () => {
    const soccer = getGame('soccer')!;
    const element = await Page({ params: Promise.resolve({ id: 'soccer' }) });
    render(element);

    expect(
      screen.getByRole('heading', { level: 1, name: soccer.title }),
    ).toBeInTheDocument();
    expect(screen.getByText('2인용')).toBeInTheDocument();
    for (const part of soccer.parts) {
      expect(screen.getByText(part.title)).toBeInTheDocument();
    }
    // 만들기 문은 둘이다 — 맨 위 버튼과 도안 그림. 스크롤 없이 닿는다
    // (2026-09-06). 인쇄 링크는 없다 — 만들기 페이지 안의 모달이 맡는다.
    expect(screen.getByRole('link', { name: '만들기' })).toHaveAttribute(
      'href',
      '/games/soccer/edit',
    );
    expect(
      screen.getByRole('link', { name: `${soccer.title} 만들기` }),
    ).toHaveAttribute('href', '/games/soccer/edit');
    expect(screen.queryByRole('link', { name: /인쇄/ })).toBeNull();
  });

  /**
   * 윷놀이는 판 위에 마커가 하나도 없고 그룹이 부속에만 사는 첫 게임이다
   * (`IDE-017`). 상세 페이지는 게임을 몰라도 되게 짜여 있으므로(`IDE-005`)
   * 그런 게임에서도 제목·인원·구성·규칙이 다 나와야 한다.
   */
  it('윷놀이 상세가 열린다 — 파트 셋과 게임 방법 절이 그대로 나온다', async () => {
    const yut = getGame('yut-nori')!;
    const element = await Page({ params: Promise.resolve({ id: 'yut-nori' }) });
    render(element);

    expect(
      screen.getByRole('heading', { level: 1, name: yut.title }),
    ).toBeInTheDocument();
    expect(screen.getByText('2~4인용')).toBeInTheDocument();
    for (const part of yut.parts) {
      // 부속 이름 '게임 방법'은 페이지의 규칙 절 제목과 같은 글자다 —
      // 규칙을 종이로도 내는 게임이라 그렇고, 둘 다 있는 것이 맞다.
      expect(screen.getAllByText(part.title).length, part.id).toBeGreaterThan(
        0,
      );
    }
    for (const section of groupRuleSections(yut.rules)) {
      if (section.heading) {
        expect(
          screen.getAllByText(section.heading).length,
          section.heading,
        ).toBeGreaterThan(0);
      }
    }
    expect(screen.getByRole('link', { name: '만들기' })).toHaveAttribute(
      'href',
      '/games/yut-nori/edit',
    );
  });

  it('없는 게임 id는 notFound를 던진다', async () => {
    await expect(
      Page({ params: Promise.resolve({ id: '없는-게임' }) }),
    ).rejects.toThrow();
  });
});
