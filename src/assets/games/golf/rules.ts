/**
 * 골프 게임판 게임 방법 (IDE-030)
 *
 * 읽는 곳은 소개 페이지(`/games/golf`)다. 인쇄물에는 규칙 카드를 두지 않는다 —
 * 축구 게임판이 그 카드를 뺀 이유(2026-09-05)가 여기서도 그대로다. 대신 홀
 * 판마다 홀 정보 카드에 **그 홀의 타수 이름**이 인쇄되어 있어, 치는 동안 필요한
 * 것은 판 위에 있다.
 *
 * 벌타 문구는 `scoring.ts`의 `PENALTY`에서 온다 — **판에 적히는 말과 같은
 * 표**다(IDE-032). 한쪽만 고치면 종이와 설명이 어긋난다.
 *
 * 축구·야구와 같은 손놀림을 쓴다(2026-09-15 사용자 요청 — "게임방식은 축구와
 * 야구게임과 유사하게 연필로 튕겨서"). 다른 것은 **목표가 상대가 아니라
 * 자기 타수**라는 점이다. 그래서 여럿이 쳐도 서로를 방해하지 않고, 혼자서도
 * 놀 수 있다.
 */
import type { RuleBlock } from '@/lib/schema';
import { BALL_DIAMETER_MM, COURSE_PAR, HOLES } from './dimensions';
import { PENALTY, SCORE_TERMS } from './scoring';

export const RULES_TITLE = '골프 게임판 · 게임 방법';

/** 준비물 절의 용지 안내. 축구 게임판과 같은 말을 쓴다. */
export const PAPER_NOTE =
  '홀 판은 A4 용지에 한 장씩 출력한다. 스케치북에 붙이거나 조금 두꺼운 종이에 뽑으면 공이 잘 미끄러지고 오래 쓴다.';

/** 파와 타수의 이름 — 한 줄씩. 소개 페이지의 「점수의 이름」 절이 된다. */
export const TERM_LINES: readonly string[] = [
  '홀인원 — 한 번에 넣었다. 파 3홀에서는 이따금 나오고, 파 4·5홀에서 나오면 두고두고 이야깃거리다.',
  ...SCORE_TERMS.map((term) => {
    const gap =
      term.relative === 0
        ? '파와 같은 타수다'
        : term.relative < 0
          ? `파보다 ${-term.relative}타 적다`
          : `파보다 ${term.relative}타 많다`;
    return `${term.label} — ${gap}.`;
  }),
];

export const RULES: readonly RuleBlock[] = [
  { kind: 'heading', text: '준비물' },
  { kind: 'bullet', text: '연필 1자루 — 공을 튕기는 도구다.' },
  {
    kind: 'bullet',
    text: `공으로 쓸 작고 납작한 것 하나 — 지름 ${BALL_DIAMETER_MM}mm쯤이면 홀에 들어간다. 두꺼운 종이를 동그랗게 오려 써도 되고, 동전이나 작은 단추도 된다.`,
  },
  {
    kind: 'bullet',
    text: `뽑을 것은 홀 판 ${HOLES.length}장(1번 홀부터 18번 홀까지)과 기록표 1장뿐이다. 오리거나 접을 것은 없다. 판은 한 번에 다 뽑아도 되고, 칠 홀만 뽑아도 된다.`,
  },
  { kind: 'bullet', text: '1~4명이 함께 친다. 혼자서도 칠 수 있다.' },
  { kind: 'bullet', text: PAPER_NOTE },

  { kind: 'heading', text: '차리기' },
  {
    kind: 'step',
    text: '이번에 칠 홀의 판을 책상에 펼친다. 1번 홀부터 차례로 친다.',
  },
  { kind: 'step', text: '공을 판 아래쪽 티잉 그라운드(티) 안에 놓는다.' },
  {
    kind: 'step',
    text: '기록표에 각자 이름을 쓴다. 왼쪽 끝의 1·2·3·4가 자기 줄 번호다 — 세 표에서 같은 번호가 같은 사람이다.',
  },

  { kind: 'heading', text: '치기 — 한 번 튕기면 1타' },
  {
    kind: 'bullet',
    text: '연필로 공을 튕긴다. 한 번 튕기는 것이 1타다. 몇 번 튕겼는지 세어 둔다.',
  },
  {
    kind: 'bullet',
    text: '공이 멈춘 자리에서 그다음 타를 친다. 공은 손으로 옮기지 않는다.',
  },
  {
    kind: 'bullet',
    text: '여럿이 칠 때는 홀에서 **먼 사람부터** 친다. 첫 홀의 순서는 가위바위보로 정하고, 다음 홀부터는 앞 홀에서 적게 친 사람이 먼저 친다.',
  },
  {
    kind: 'bullet',
    text: '공이 홀(깃발 아래 동그라미)에 닿은 채로 멈추면 홀아웃이다. 그때까지 친 횟수가 그 홀의 타수다.',
  },

  { kind: 'heading', text: '땅에 따라 — 벌타' },
  {
    kind: 'bullet',
    text: '벌타는 **판에도 적혀 있다** — 모래와 물 위에 그 자리에서 어떻게 되는지가 쓰여 있어, 치다 말고 이 페이지를 펼 일이 없다.',
  },
  {
    kind: 'bullet',
    text: '페어웨이(옅은 초록 길)와 그린(진한 초록)에 멈추면 그대로 친다. 벌타는 없다.',
  },
  {
    kind: 'bullet',
    text: '러프(길 밖의 흰 자리)에 멈춰도 벌타는 없다. 다만 나무에 걸리면 돌아가야 해서 타수가 는다.',
  },
  {
    kind: 'bullet',
    text: `벙커(모래)에 멈추면 1벌타다 — 판의 모래에 \`${PENALTY.bunker.mark}\`라고 적혀 있다. 공은 그 자리에 두고 타수에 1을 더한다.`,
  },
  {
    kind: 'bullet',
    text: `물(연못·개울)에 들어가면 1벌타다 — 판의 물에 \`${PENALTY.water.mark} · ${PENALTY.water.note}\`라고 적혀 있다. 물에 들어가기 바로 전 자리에 공을 놓고 다시 친다.`,
  },
  {
    kind: 'bullet',
    text: `O.B. — 점선 밖으로 나가면 1벌타다. 판 아래 모서리에 \`${PENALTY.ob.mark} · ${PENALTY.ob.note}\`라고 적혀 있다.`,
  },
  {
    kind: 'bullet',
    text: '벌타는 친 횟수에 더해서 적는다. 치지 않아도 타수가 하나 는다.',
  },

  { kind: 'heading', text: '점수의 이름' },
  ...TERM_LINES.map((text) => ({ kind: 'bullet', text }) as const),

  { kind: 'heading', text: '기록하기 — 여기서 덧셈을 한다' },
  {
    kind: 'step',
    text: '홀이 끝나면 벌타까지 더한 타수를 기록표의 그 홀 칸에 적는다.',
  },
  {
    kind: 'step',
    text: '전반 아홉 홀(1~9번)을 다 치면 아홉 칸을 더해 OUT 칸에 적는다.',
  },
  {
    kind: 'step',
    text: '후반 아홉 홀(10~18번)도 같은 방법으로 더해 IN 칸에 적는다.',
  },
  {
    kind: 'step',
    text: '아래 합산 칸에서 OUT + IN = 총타수를 낸다. 칸 사이의 +와 =가 무엇을 하는 셈인지 말해 준다.',
  },
  {
    kind: 'step',
    text: `「파 ${COURSE_PAR}와 견주기」 칸에 네모가 둘 있다. 앞 네모에 총타수를 옮겨 적고, 뒤 네모에 답을 쓴다 — 총타수 − 파 ${COURSE_PAR}가 오늘의 성적이다. 파보다 많이 쳤으면 +(오버파), 적게 쳤으면 −(언더파)다.`,
  },
  {
    kind: 'step',
    text: '맨 오른쪽 「지난번과 견주기」 칸은 네모가 셋이다. 총타수, 지난 라운드의 총타수, 그리고 그 차이를 차례로 쓴다. 이 수가 −면 지난번보다 잘 친 것이다 — 99타에서 94타로 줄였으면 −5다. 처음 치는 날은 비워 둔다.',
  },

  { kind: 'heading', text: '이 규칙은 기본값입니다' },
  {
    kind: 'bullet',
    text: '여기 적힌 것은 기본 규칙입니다. 함께 치는 사람끼리 합의해 자유롭게 바꿔서 즐기세요.',
  },
  {
    kind: 'bullet',
    text: '어린아이와 칠 때 — 홀 원 대신 그린(진한 초록) 안에 멈추면 들어간 것으로 하면 한 홀이 훨씬 빨리 끝납니다. 벌타를 빼고 쳐도 됩니다.',
  },
  {
    kind: 'bullet',
    text: '9홀만 쳐도 한 판입니다. 전반만 치고 OUT까지만 더해도 좋습니다.',
  },
  {
    kind: 'bullet',
    text: '만들기 화면의 "나만의 홀"에서 티와 그린, 벙커와 연못을 직접 끌어 홀을 지을 수 있습니다. 지은 홀로 그 번호의 홀을 바꿔 쳐도 됩니다.',
  },
  {
    kind: 'bullet',
    text: '실제 골프에서는 벙커에 벌타가 없습니다. 이 판에서 1벌타를 둔 것은 모래를 피해 치는 재미를 주기 위해서입니다 — 빼고 쳐도 규칙에 어긋나지 않습니다.',
  },
] as const;
