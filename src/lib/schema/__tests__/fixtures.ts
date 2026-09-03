import type { GameDefinitionInput } from '../game';

/** 규칙 하나씩만 어긋뜨려 보려고 쓰는, 최소한으로 유효한 도안. */
export function makeGame(
  overrides: Partial<GameDefinitionInput> = {},
): GameDefinitionInput {
  return {
    schemaVersion: 1,
    id: 'demo',
    title: '데모 게임',
    tagline: '규격 검증용 최소 도안',
    description: '스키마 테스트에만 쓰는 도안이다.',
    players: { min: 1, max: 2 },
    supplies: ['가위'],
    thumbnail: '/games/demo/thumbnail.png',
    parts: [
      {
        id: 'board',
        kind: 'board',
        title: '게임판',
        widthMm: 210,
        heightMm: 297,
        orientation: 'portrait',
        regions: [
          {
            id: 'play-area',
            label: '놀이 영역',
            rect: { xMm: 10, yMm: 10, widthMm: 190, heightMm: 277 },
          },
        ],
      },
    ],
    slots: [
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
    ...overrides,
  };
}

/** 마커 슬롯·스타일 세트·그룹·프리셋까지 갖춘 도안. 위치 관련 규칙 검증에 쓴다. */
export function makeGameWithMarkers(
  overrides: Partial<GameDefinitionInput> = {},
): GameDefinitionInput {
  return makeGame({
    groups: [
      {
        id: 'red',
        label: '빨강',
        nameSlotId: 'red-name',
        colorSlotId: 'red-color',
      },
    ],
    styleSets: [
      {
        id: 'piece',
        label: '말',
        variants: [
          {
            id: 'dot',
            label: '점',
            widthMm: 10,
            heightMm: 10,
            valueFontSizeMm: 4,
          },
        ],
      },
    ],
    slots: [
      {
        id: 'red-name',
        kind: 'text',
        label: '팀 이름',
        groupId: 'red',
        maxLength: 10,
        default: '빨강',
        placements: [
          { partId: 'board', mode: 'text', xMm: 105, yMm: 20, fontSizeMm: 6 },
        ],
      },
      {
        id: 'red-color',
        kind: 'color',
        label: '팀 색',
        groupId: 'red',
        default: '#ff0000',
        placements: [
          { partId: 'board', mode: 'paint', layerId: 'pc-team-red' },
        ],
      },
      {
        id: 'red-piece-1',
        kind: 'number',
        label: '빨강 1번',
        groupId: 'red',
        min: 1,
        max: 99,
        default: 1,
        placements: [
          {
            partId: 'board',
            mode: 'marker',
            xMm: 60,
            yMm: 60,
            styleSetId: 'piece',
            regionId: 'play-area',
          },
        ],
      },
      {
        id: 'red-piece-2',
        kind: 'number',
        label: '빨강 2번',
        groupId: 'red',
        min: 1,
        max: 99,
        default: 2,
        placements: [
          {
            partId: 'board',
            mode: 'marker',
            xMm: 140,
            yMm: 60,
            styleSetId: 'piece',
            regionId: 'play-area',
          },
        ],
      },
    ],
    presets: [
      {
        id: 'spread',
        label: '벌린 배치',
        groupId: 'red',
        partId: 'board',
        positions: [
          { slotId: 'red-piece-1', xMm: 40, yMm: 100 },
          { slotId: 'red-piece-2', xMm: 160, yMm: 100 },
        ],
      },
    ],
    ...overrides,
  });
}

type SlotInput = GameDefinitionInput['slots'][number];

/** 픽스처에서 슬롯 하나를 종류까지 좁혀 꺼낸다. 종류별 필드를 고쳐 볼 때 쓴다. */
export function slotOf<K extends SlotInput['kind']>(
  game: GameDefinitionInput,
  id: string,
  kind: K,
): Extract<SlotInput, { kind: K }> {
  const slot = game.slots.find((s) => s.id === id);
  if (!slot) throw new Error(`픽스처에 없는 슬롯이다: ${id}`);
  if (slot.kind !== kind)
    throw new Error(`슬롯 종류가 다르다: ${id}는 ${slot.kind}다`);
  return slot as Extract<SlotInput, { kind: K }>;
}
