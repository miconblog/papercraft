/**
 * 게임 방법 — 도안이 선언하는 규칙문 (IDE-003)
 *
 * 규칙은 오래 **인쇄물에만** 있었다(축구 게임판의 `rules-card` 파트). 그 카드를
 * 출력물에서 빼면서(2026-09-05 사용자 요청) 규칙이 갈 곳이 없어졌고, 그래서
 * 도안 정의가 직접 들고 있게 했다 — 게임 소개 페이지가 이 값을 읽어 그린다.
 *
 * 블록 종류가 셋뿐인 것은 규칙문이 **읽히기만 하면 되는 글**이기 때문이다.
 * 마크다운을 넣으면 렌더러가 커지고, 인쇄물로 되돌릴 때(다른 게임이 규칙 카드를
 * 원할 수 있다) 조판할 수 없는 문법이 섞인다.
 */
import { z } from 'zod';

export const ruleBlock = z.discriminatedUnion('kind', [
  /** 절 제목. */
  z.strictObject({
    kind: z.literal('heading'),
    text: z.string().min(1).max(60),
  }),
  /** 번호가 붙는 순서 있는 항목. */
  z.strictObject({ kind: z.literal('step'), text: z.string().min(1).max(300) }),
  /** 순서 없는 항목. */
  z.strictObject({
    kind: z.literal('bullet'),
    text: z.string().min(1).max(300),
  }),
]);
export type RuleBlock = z.infer<typeof ruleBlock>;

/** 제목이 아닌 블록 — 절 하나가 담는 내용이다. */
export type RuleBody = Exclude<RuleBlock, { kind: 'heading' }>;

export interface RuleSection {
  readonly heading: string | null;
  readonly blocks: readonly RuleBody[];
}

/**
 * 화면에 그리기 좋게 규칙을 절로 묶는다.
 *
 * `heading` 앞에 오는 블록들은 **제목 없는 첫 절**이 된다 — 규칙문이 반드시
 * 제목으로 시작해야 한다는 제약을 스키마에 넣지 않기 위한 것이다.
 */
export const groupRuleSections = (
  rules: readonly RuleBlock[],
): RuleSection[] => {
  const sections: { heading: string | null; blocks: RuleBody[] }[] = [];
  for (const block of rules) {
    if (block.kind === 'heading') {
      sections.push({ heading: block.text, blocks: [] });
      continue;
    }
    if (sections.length === 0) sections.push({ heading: null, blocks: [] });
    sections[sections.length - 1].blocks.push(block);
  }
  return sections;
};
