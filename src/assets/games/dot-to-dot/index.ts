/**
 * 점 잇기 도안 (IDE-019)
 *
 * 치수는 전부 [`./dimensions.ts`](./dimensions.ts)에서 온다.
 *
 * ## 앞선 네 게임과 다른 점
 *
 * 1. **인쇄물의 형태가 저장소에 없다.** 축구·야구·세계일주·윷놀이는 도안이
 *    저장소 안에 있고 사용자는 이름·색·마커 자리만 고쳤다. 점 잇기는 판 위의
 *    점과 번호가 **사용자가 넣은 사진에서** 나온다. 그래서 두 파트가 모두
 *    `dynamic`이고, 정적 SVG는 보기 그림(앉은 고양이) 한 벌뿐이다.
 * 2. **크기가 바뀌지 않는 첫 동적 파트다.** 세계일주는 도시 수가 판을 A4 → A3
 *    → A2로 키웠지만(`sizeSteps`) 점 잇기 판은 사진이 무엇이든 190×277 한
 *    장이다. 그래서 `dynamic`에 `listSlotId`·`sizeSteps`가 없다.
 * 3. **혼자 하는 첫 놀이다**(`players: 1~1`). 카탈로그의 `formatPlayers`가
 *    최소·최대가 같으면 한 번만 적어 "1인용"으로 읽힌다.
 * 4. **생성된 기하 데이터를 담는 첫 슬롯**(`outline`)이 있다. 도안이 후보를
 *    미리 선언해 둘 수 없는 값이라 목록 슬롯(IDE-016)으로는 안 된다 —
 *    거기는 여전히 "고르는 것"이고 이쪽은 "계산되는 것"이다.
 *
 * 사진을 넣고 다시 따는 조작은 `IDE-020`이 만든다. 지금 만들기 화면에서 고칠
 * 수 있는 것은 제목·점 개수·안내선 셋이고, 윤곽은 보기 그림에 머문다.
 */
import { defineGame } from '@/lib/schema';
import { DEFAULT_DOT_COUNT } from './artwork/board';
import {
  ANSWER,
  ANSWER_BOX,
  BOARD,
  SAMPLE_OUTLINE,
  TYPE,
  artworkPath,
} from './dimensions';
import { RULES } from './rules';

const BOARD_PART_ID = 'board';
const ANSWER_PART_ID = 'answer';

/** 점 개수의 범위. 5보다 적으면 형태가 안 나오고 100을 넘으면 A4에 안 읽힌다. */
export const DOT_COUNT_RANGE = { min: 5, max: 100 } as const;

export default defineGame({
  schemaVersion: 1,
  id: 'dot-to-dot',
  title: '점 잇기',
  tagline: '사진에서 윤곽을 따 점과 번호를 찍는, 혼자 하는 종이 한 장',
  description:
    '사진을 넣으면 그 안의 형태를 따라 점을 찍고 점마다 번호를 붙인 판이 ' +
    '나온다. 아이는 1번부터 차례로 선을 이어 그림을 완성한다. 숫자를 순서대로 ' +
    '읽는 연습이자 연필을 쥐고 선을 긋는 연습이다. 점 개수가 곧 난이도라 같은 ' +
    '사진으로 열 개짜리와 쉰 개짜리를 따로 뽑을 수 있다. 다 이었을 때 나오는 ' +
    '그림은 어른이 먼저 확인하도록 따로 뽑는다. ' +
    '사진은 브라우저 안에서만 다루고 서버로 보내지 않는다 — 오가는 것은 ' +
    '윤곽선의 좌표뿐이다.',
  players: { min: 1, max: 1 },
  supplies: ['연필', '색연필'],
  thumbnail: artworkPath(BOARD_PART_ID),

  rules: [...RULES],

  parts: [
    {
      id: BOARD_PART_ID,
      kind: 'board',
      title: '점 잇기 판',
      description:
        '190×277mm 세로 한 장이다. 배율 100%에서 A4 한 장에 여백까지 그대로 ' +
        '들어간다. 점과 번호, 시작점 화살표, 제목 칸이 있다. 번호는 점 위가 ' +
        '아니라 윤곽선 바깥쪽에 앉아 연필 댈 자리를 가리지 않는다. ' +
        '오리거나 접지 않는다.',
      widthMm: BOARD.widthMm,
      heightMm: BOARD.heightMm,
      orientation: 'portrait',
      // 번호 글자(3.2mm)가 하한을 정한다. 0.8이면 2.6mm로, 그 아래는 만 4세가
      // 못 읽는다. 위로는 큰 종이에 크게 그어 보는 쓰임이 있어 넉넉히 둔다.
      minScale: 0.8,
      maxScale: 3,
      artwork: artworkPath(BOARD_PART_ID),
      // 크기 단계가 없는 첫 동적 파트다 — 사진이 무엇이든 판은 한 장이고
      // 그림만 값에서 나온다. 무엇이 그림을 바꾸는지는 이 파트에 control
      // 배치를 가진 슬롯이 말한다(`dynamicSourceSlots`).
      dynamic: {},
    },
    {
      id: ANSWER_PART_ID,
      kind: 'cutout',
      title: '완성 그림',
      description:
        '다 이었을 때 나오는 실루엣 한 장. 어른이 먼저 보고 사진이 제대로 ' +
        '땄는지 확인하는 용도다. 아이에게 먼저 보이면 놀이가 끝나므로 판과 ' +
        '따로 뽑는다. 오려서 접어 두었다가 다 이은 뒤에 맞춰 본다.',
      widthMm: ANSWER.widthMm,
      heightMm: ANSWER.heightMm,
      orientation: 'portrait',
      // 실루엣과 한 줄짜리 안내뿐이라 작게 뽑아도 읽힌다.
      minScale: 0.6,
      maxScale: 2,
      marks: ['cut'],
      artwork: artworkPath(ANSWER_PART_ID),
      dynamic: {},
    },
  ],

  slots: [
    {
      id: 'title',
      kind: 'text',
      label: '도안 제목',
      help: '판 위쪽에 찍힌다. 비워 두면 밑줄만 남아 아이가 손으로 쓸 수 있다.',
      maxLength: 18,
      default: '',
      placeholder: '우리 강아지',
      placements: [
        {
          partId: BOARD_PART_ID,
          mode: 'text',
          xMm: BOARD.widthMm / 2,
          yMm: TYPE.titleYMm,
          align: 'center',
          fontSizeMm: TYPE.titleFontMm,
          maxWidthMm: TYPE.titleMaxWidthMm,
        },
        {
          partId: ANSWER_PART_ID,
          mode: 'text',
          xMm: ANSWER.widthMm / 2,
          yMm: TYPE.answerTitleYMm,
          align: 'center',
          fontSizeMm: TYPE.answerTitleFontMm,
          maxWidthMm: ANSWER_BOX.width,
        },
      ],
    },
    {
      id: 'dot-count',
      kind: 'number',
      label: '점 개수',
      help: '난이도다. 만 3~4세는 10~20개, 만 6세 이상은 50개를 넘겨도 끝까지 간다. 윤곽이 짧으면 넣을 수 있는 최대치에서 멈춘다.',
      min: DOT_COUNT_RANGE.min,
      max: DOT_COUNT_RANGE.max,
      integer: true,
      default: DEFAULT_DOT_COUNT,
      // 값이 글자로 찍히는 게 아니라 판 전체를 다시 그리게 한다 — `number`
      // 슬롯에 `control` 배치를 쓰는 첫 자리다(IDE-019).
      placements: [{ partId: BOARD_PART_ID, mode: 'control' }],
    },
    {
      id: 'guide-line',
      kind: 'choice',
      label: '안내선',
      help: '숫자를 아직 다 못 읽는 아이는 옅은 윤곽선이 있어야 선을 따라간다. 그 위 나이는 없어야 놀이가 된다.',
      options: [
        { value: 'off', label: '안내선 없음' },
        { value: 'on', label: '옅은 안내선' },
      ],
      default: 'off',
      placements: [{ partId: BOARD_PART_ID, mode: 'control' }],
    },
    {
      id: 'outline',
      kind: 'outline',
      label: '윤곽선',
      help: '사진에서 딴 형태다. 사진 넣기는 만들기 화면에서 한다.',
      // 사진을 넣기 전에는 보기 그림(앉은 고양이)이다. 빈 판을 기본값으로 두면
      // 소개 페이지에 아무것도 없는 종이가 걸린다.
      default: SAMPLE_OUTLINE,
      minPoints: 3,
      maxPoints: 2000,
      placements: [
        { partId: BOARD_PART_ID, mode: 'control' },
        { partId: ANSWER_PART_ID, mode: 'control' },
      ],
    },
  ],
});
