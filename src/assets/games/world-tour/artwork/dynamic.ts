/**
 * 값에서 판을 그린다 (IDE-016 2단계)
 *
 * 도안 정의는 서버에서 클라이언트로 그대로 넘어가는 데이터라 함수를 실을 수
 * 없다. 그래서 게임 id별 렌더러는 여기 따로 있고, 등록소
 * (`lib/games/dynamic-artwork.ts`)가 서버에서만 부른다 — 미리보기는 API로 받고
 * 내보내기는 같은 함수를 부르므로 화면과 PDF가 같은 그림이다.
 *
 * 읽는 값: `cities`(목록 슬롯 — 켠 도시 id, 경로 차례) · `board-frame`(지도만).
 */
import { CITIES, type City } from '../cities.ts';
import { renderBoardRoute } from './board.ts';

/**
 * 스키마 모듈을 끌어오지 않는다 — 아트워크 코드는 `npm run artwork`가 Node로
 * 직접 실행하고, 스키마는 확장자 없는 import를 쓴다. 값의 모양만 구조적으로
 * 받는다. `'map'`은 스키마의 `MAP_ONLY_FRAME`과 같은 값이다(테스트가 맞춘다).
 */
export interface DynamicValues {
  readonly values: Readonly<Record<string, unknown>>;
}

export const CITIES_SLOT_ID = 'cities';
export const FRAME_SLOT_ID = 'board-frame';
export const BOARD_PART_ID = 'board';
export const MAP_ONLY_FRAME = 'map';

const byId = new Map(CITIES.map((city) => [city.id, city] as const));

const isCustomCity = (
  entry: unknown,
): entry is { id: string; label: string; data: { lon: number; lat: number } } =>
  typeof entry === 'object' &&
  entry !== null &&
  typeof (entry as { id?: unknown }).id === 'string' &&
  typeof (entry as { label?: unknown }).label === 'string' &&
  typeof (entry as { data?: { lon?: unknown } }).data?.lon === 'number' &&
  typeof (entry as { data?: { lat?: unknown } }).data?.lat === 'number';

/**
 * 값의 목록 → 도시. 옵션 id는 풀에서 찾고, 직접 더한 항목(검색 결과)은 실려 온
 * 이름·경위도로 도시를 만든다. 모르는 것은 조용히 건너뛴다(검증이 이미 막는다).
 */
export const routeFromValues = (customization: DynamicValues): City[] => {
  const entries = customization.values[CITIES_SLOT_ID];
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    if (typeof entry === 'string') {
      const city = byId.get(entry);
      return city ? [city] : [];
    }
    if (isCustomCity(entry)) {
      return [
        {
          id: entry.id,
          name: entry.label,
          lon: entry.data.lon,
          lat: entry.data.lat,
          rank: 0,
          leg: 'custom',
        } satisfies City,
      ];
    }
    return [];
  });
};

export const renderWorldTourArtwork = (
  partId: string,
  customization: DynamicValues,
): string | null => {
  if (partId !== BOARD_PART_ID) return null;
  return renderBoardRoute({
    route: routeFromValues(customization),
    mapOnly: customization.values[FRAME_SLOT_ID] === MAP_ONLY_FRAME,
  });
};
