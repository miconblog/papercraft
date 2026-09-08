/**
 * 목록 슬롯 검색 제공자 등록소 (IDE-016)
 *
 * 목록 슬롯이 `search.providerId`를 두면 에디터가 검색 상자를 내고, 질의는
 * `/api/games/[id]/list-search`로 온다. 제공자는 게임 데이터(세계 도시 7천 곳)를
 * 끌고 들어오므로 **서버에서만** 부른다.
 */
import { searchCities } from '@/assets/games/world-tour/search/search';
import type { SearchResult } from '@/assets/games/world-tour/search/search';

export type { SearchResult };

type Provider = (query: string) => SearchResult[];

const PROVIDERS: Readonly<Record<string, Provider>> = {
  'world-cities': searchCities,
};

export function searchListOptions(
  providerId: string,
  query: string,
): SearchResult[] | null {
  const provider = PROVIDERS[providerId];
  return provider ? provider(query) : null;
}
