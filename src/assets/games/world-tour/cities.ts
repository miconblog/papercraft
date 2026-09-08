/**
 * 세계일주 게임판의 도시와 경로 (IDE-015)
 *
 * **배열의 차례가 곧 기본 경로다.** 서울에서 출발해 태평양 → 남아메리카 →
 * 북아메리카 → 북극해 → 유럽 → 아프리카 → 서남아시아 → 남·동남아시아 →
 * 오세아니아 → 동아시아를 거쳐 서울로 돌아온다(2026-09-08 사용자가 정한 차례.
 * 마지막 동아시아 구간은 시드니에서 한국까지 한 칸으로 뛰지 않으려고 넣었다).
 * 제주는 뺐다(같은 날) — 서울과 함께 적기엔 너무 조밀하다. 사용자는 만들기
 * 화면에서 도시를 켜고 끄고 차례를 바꿀 수 있다(`IDE-016`) — 여기 차례는
 * 켤 때 끼어드는 자리와 프리셋의 차례를 정한다.
 *
 * ## 도시 수 프리셋은 중첩이다
 *
 * 도시마다 `rank`가 있다 — **그 도시가 처음 들어오는 프리셋**이다. `rank ≤ N`인
 * 도시가 프리셋 N의 도시다. 50에 든 도시는 60 이상 어디에도 반드시 있고, 프리셋마다
 * 목록을 따로 들지 않으므로 어긋날 수 없다. `rank`가 0이면 어느 프리셋에도
 * 없고 토글(`IDE-016`)로만 켤 수 있는 도시다.
 *
 * 서울은 고정이다(`fixed`). 출발지라 끌 수 없다.
 *
 * ## 특수칸은 도시에 붙는다
 *
 * 특수칸 넷 — 급행·후퇴·다시·쉼. 급행과 후퇴는 **주사위를 다시 굴려 그 수만큼**
 * 앞·뒤로 간다(2026-09-08 사용자가 규칙을 바꿨다 — 처음엔 적힌 번호로 갔고
 * "또 한 번"도 있었다). 목적지가 없으니 도시를 켜고 꺼도 아무것도 안 밀린다.
 *
 * 위경도는 시청·도심 기준의 어림값이다. 칸이 겹치지 않게 그릴 때 어차피
 * 몇 mm씩 옮겨지므로(`./artwork/layout.ts`) 소수 둘째 자리면 충분하다.
 */

export type Leg =
  | 'start'
  | 'pacific'
  | 'south-america'
  | 'north-america'
  | 'arctic'
  | 'europe'
  | 'africa'
  | 'west-asia'
  | 'south-asia'
  | 'oceania'
  | 'east-asia'
  /** 사용자가 검색해서 더한 도시. 풀에는 없고 값에만 있다. */
  | 'custom';

export const LEG_LABELS: Readonly<Record<Leg, string>> = {
  start: '출발·도착',
  pacific: '태평양',
  'south-america': '남아메리카',
  'north-america': '북아메리카',
  arctic: '북극해',
  europe: '유럽',
  africa: '아프리카',
  'west-asia': '서남아시아',
  'south-asia': '남·동남아시아',
  oceania: '오세아니아',
  'east-asia': '동아시아',
  custom: '직접 추가',
};

/** 순서대로 그리면 경로 구간의 차례가 된다. */
export const LEG_ORDER: readonly Leg[] = [
  'start',
  'pacific',
  'south-america',
  'north-america',
  'arctic',
  'europe',
  'africa',
  'west-asia',
  'south-asia',
  'oceania',
  'east-asia',
];

/**
 * 도시 수 프리셋. 처음 넷(50–80)은 사용자가 고른 것이고(2026-09-08), 90·100은
 * 같은 날 "최대 100개까지" 요청으로 늘렸다. 판 크기는 도시 수를 따라 커진다
 * (`../dimensions.ts`의 `PAPER_STEPS`).
 */
export const PRESET_COUNTS = [50, 60, 70, 80, 90, 100] as const;
export type PresetCount = (typeof PRESET_COUNTS)[number];

/** 기본 프리셋 — 판을 처음 열면 이 수다. */
export const DEFAULT_COUNT: PresetCount = 50;

export interface City {
  readonly id: string;
  readonly name: string;
  readonly lon: number;
  readonly lat: number;
  /** 처음 들어오는 프리셋. 0이면 토글로만 켠다. */
  readonly rank: 0 | PresetCount;
  readonly leg: Leg;
  /** 끌 수 없는 도시 — 서울(출발·도착). */
  readonly fixed?: true;
}

const c = (
  id: string,
  name: string,
  lon: number,
  lat: number,
  rank: City['rank'],
  leg: Leg,
  fixed?: true,
): City => ({ id, name, lon, lat, rank, leg, ...(fixed ? { fixed } : {}) });

/** 경로 차례대로. 첫 도시가 출발지이고, 마지막 도시 다음은 다시 첫 도시다. */
export const CITIES: readonly City[] = [
  c('seoul', '서울', 126.98, 37.57, 50, 'start', true),

  // 태평양 — 도쿄에서 하와이로 건너 폴리네시아를 거쳐 남아메리카로.
  c('osaka', '오사카', 135.5, 34.69, 80, 'pacific'),
  c('tokyo', '도쿄', 139.69, 35.69, 50, 'pacific'),
  c('guam', '괌', 144.79, 13.44, 50, 'pacific'),
  c('honolulu', '호놀룰루', -157.86, 21.31, 50, 'pacific'),
  c('papeete', '파페에테', -149.57, -17.54, 50, 'pacific'),
  c('easter-island', '이스터섬', -109.35, -27.11, 50, 'pacific'),

  // 남아메리카 — 서해안을 따라 내려가 남단을 돌고 동해안으로 올라온다.
  c('lima', '리마', -77.03, -12.05, 50, 'south-america'),
  c('cusco', '쿠스코', -71.97, -13.52, 70, 'south-america'),
  c('la-paz', '라파스', -68.15, -16.5, 60, 'south-america'),
  c('santiago', '산티아고', -70.67, -33.45, 50, 'south-america'),
  c('ushuaia', '우수아이아', -68.3, -54.8, 80, 'south-america'),
  c('buenos-aires', '부에노스아이레스', -58.38, -34.6, 50, 'south-america'),
  c('montevideo', '몬테비데오', -56.16, -34.9, 70, 'south-america'),
  c('asuncion', '아순시온', -57.64, -25.29, 100, 'south-america'),
  c('sao-paulo', '상파울루', -46.63, -23.55, 50, 'south-america'),
  c('rio', '리우데자네이루', -43.17, -22.91, 50, 'south-america'),
  c('brasilia', '브라질리아', -47.93, -15.78, 90, 'south-america'),
  c('salvador', '살바도르', -38.51, -12.97, 100, 'south-america'),
  c('manaus', '마나우스', -60.02, -3.12, 100, 'south-america'),
  c('quito', '키토', -78.47, -0.18, 60, 'south-america'),
  c('medellin', '메데인', -75.56, 6.25, 0, 'south-america'),
  c('bogota', '보고타', -74.07, 4.71, 50, 'south-america'),
  c('caracas', '카라카스', -66.9, 10.49, 70, 'south-america'),

  // 북아메리카 — 중미에서 카리브해, 동해안을 올라 대륙을 건너 서해안으로,
  // 알래스카에서 북극해로 나간다.
  c('panama-city', '파나마시티', -79.52, 8.98, 50, 'north-america'),
  c('san-jose', '산호세', -84.09, 9.93, 100, 'north-america'),
  c('mexico-city', '멕시코시티', -99.13, 19.43, 50, 'north-america'),
  c('cancun', '칸쿤', -86.85, 21.16, 100, 'north-america'),
  c('havana', '아바나', -82.38, 23.13, 50, 'north-america'),
  c('miami', '마이애미', -80.19, 25.76, 50, 'north-america'),
  c('washington', '워싱턴', -77.04, 38.91, 50, 'north-america'),
  c('new-york', '뉴욕', -74.01, 40.71, 50, 'north-america'),
  c('boston', '보스턴', -71.06, 42.36, 0, 'north-america'),
  c('montreal', '몬트리올', -73.57, 45.5, 60, 'north-america'),
  c('toronto', '토론토', -79.38, 43.65, 80, 'north-america'),
  c('chicago', '시카고', -87.63, 41.88, 50, 'north-america'),
  c('denver', '덴버', -104.99, 39.74, 0, 'north-america'),
  c('los-angeles', '로스앤젤레스', -118.24, 34.05, 50, 'north-america'),
  c('san-francisco', '샌프란시스코', -122.42, 37.77, 50, 'north-america'),
  c('seattle', '시애틀', -122.33, 47.61, 80, 'north-america'),
  c('vancouver', '밴쿠버', -123.12, 49.28, 60, 'north-america'),
  c('anchorage', '앵커리지', -149.9, 61.22, 50, 'north-america'),

  // 북극해 — 북극점은 도시가 아니지만 옛 인쇄본의 북극곰 자리다. 지도 위
  // 꼭대기 한가운데(중앙 자오선)에 둔다.
  c('north-pole', '북극점', 150, 87, 50, 'arctic'),
  c('longyearbyen', '롱이어비엔', 15.63, 78.22, 80, 'arctic'),
  c('murmansk', '무르만스크', 33.08, 68.97, 60, 'arctic'),

  // 유럽 — 러시아에서 발트해를 따라 서쪽으로 내려와 북해 연안을 지나 영국,
  // 아이슬란드를 찍고 파리로 돌아와 중부 유럽·이탈리아를 거쳐 이베리아에서
  // 아프리카로 건넌다. 50개 판에서는 모스크바 → 베를린 → 암스테르담 → 런던 →
  // 파리 → 로마 → 마드리드가 되어 화살표가 서로 가로지르지 않는다.
  c('moscow', '모스크바', 37.62, 55.75, 50, 'europe'),
  c('st-petersburg', '상트페테르부르크', 30.32, 59.94, 90, 'europe'),
  c('helsinki', '헬싱키', 24.94, 60.17, 60, 'europe'),
  c('stockholm', '스톡홀름', 18.07, 59.33, 70, 'europe'),
  c('oslo', '오슬로', 10.75, 59.91, 60, 'europe'),
  c('copenhagen', '코펜하겐', 12.57, 55.68, 0, 'europe'),
  c('berlin', '베를린', 13.41, 52.52, 50, 'europe'),
  c('amsterdam', '암스테르담', 4.9, 52.37, 50, 'europe'),
  c('london', '런던', -0.13, 51.51, 50, 'europe'),
  c('dublin', '더블린', -6.26, 53.35, 100, 'europe'),
  c('reykjavik', '레이캬비크', -21.94, 64.15, 70, 'europe'),
  c('paris', '파리', 2.35, 48.86, 50, 'europe'),
  c('munich', '뮌헨', 11.58, 48.14, 0, 'europe'),
  c('prague', '프라하', 14.42, 50.09, 90, 'europe'),
  c('vienna', '빈', 16.37, 48.21, 70, 'europe'),
  c('venice', '베네치아', 12.32, 45.44, 90, 'europe'),
  c('rome', '로마', 12.5, 41.9, 50, 'europe'),
  c('barcelona', '바르셀로나', 2.17, 41.39, 0, 'europe'),
  c('madrid', '마드리드', -3.7, 40.42, 50, 'europe'),
  c('lisbon', '리스본', -9.14, 38.72, 80, 'europe'),

  // 아프리카 — 서해안을 내려가 희망봉을 돌고 동해안으로 올라 카이로까지.
  c('casablanca', '카사블랑카', -7.59, 33.57, 50, 'africa'),
  c('dakar', '다카르', -17.44, 14.69, 80, 'africa'),
  c('accra', '아크라', -0.19, 5.6, 90, 'africa'),
  c('lagos', '라고스', 3.39, 6.52, 50, 'africa'),
  c('kinshasa', '킨샤사', 15.31, -4.32, 80, 'africa'),
  c('luanda', '루안다', 13.23, -8.84, 0, 'africa'),
  c('cape-town', '케이프타운', 18.42, -33.93, 50, 'africa'),
  c('johannesburg', '요하네스버그', 28.05, -26.2, 60, 'africa'),
  c('antananarivo', '안타나나리보', 47.52, -18.88, 100, 'africa'),
  c('dar-es-salaam', '다르에스살람', 39.28, -6.79, 100, 'africa'),
  c('nairobi', '나이로비', 36.82, -1.29, 50, 'africa'),
  c('addis-ababa', '아디스아바바', 38.75, 9.02, 70, 'africa'),
  c('khartoum', '하르툼', 32.53, 15.55, 0, 'africa'),
  c('cairo', '카이로', 31.24, 30.04, 50, 'africa'),

  // 서남아시아 — 이스탄불은 유럽과 아시아에 걸친 도시다. 여기 둔다.
  c('jerusalem', '예루살렘', 35.22, 31.77, 50, 'west-asia'),
  c('istanbul', '이스탄불', 28.98, 41.01, 50, 'west-asia'),
  c('baghdad', '바그다드', 44.36, 33.31, 80, 'west-asia'),
  c('tehran', '테헤란', 51.39, 35.69, 60, 'west-asia'),
  c('riyadh', '리야드', 46.72, 24.69, 70, 'west-asia'),
  c('dubai', '두바이', 55.27, 25.2, 50, 'west-asia'),
  c('muscat', '무스카트', 58.41, 23.59, 100, 'west-asia'),

  // 남·동남아시아
  c('karachi', '카라치', 67.01, 24.86, 90, 'south-asia'),
  c('delhi', '델리', 77.21, 28.61, 50, 'south-asia'),
  c('kathmandu', '카트만두', 85.32, 27.72, 80, 'south-asia'),
  c('mumbai', '뭄바이', 72.88, 19.08, 50, 'south-asia'),
  c('colombo', '콜롬보', 79.86, 6.93, 60, 'south-asia'),
  c('yangon', '양곤', 96.17, 16.87, 0, 'south-asia'),
  c('bangkok', '방콕', 100.5, 13.76, 50, 'south-asia'),
  c('kuala-lumpur', '쿠알라룸푸르', 101.69, 3.14, 90, 'south-asia'),
  c('singapore', '싱가포르', 103.82, 1.35, 50, 'south-asia'),
  c('jakarta', '자카르타', 106.85, -6.21, 50, 'south-asia'),

  // 오세아니아 — 호주를 서에서 동으로 건너 뉴질랜드를 찍고 북쪽 다윈으로.
  c('perth', '퍼스', 115.86, -31.95, 90, 'oceania'),
  c('melbourne', '멜버른', 144.96, -37.81, 90, 'oceania'),
  c('canberra', '캔버라', 149.13, -35.28, 70, 'oceania'),
  c('sydney', '시드니', 151.21, -33.87, 50, 'oceania'),
  c('wellington', '웰링턴', 174.78, -41.29, 90, 'oceania'),
  c('auckland', '오클랜드', 174.76, -36.85, 50, 'oceania'),
  c('suva', '수바', 178.44, -18.14, 0, 'oceania'),
  c('darwin', '다윈', 130.84, -12.46, 50, 'oceania'),

  // 동아시아 귀환
  c('manila', '마닐라', 120.98, 14.6, 50, 'east-asia'),
  c('hanoi', '하노이', 105.85, 21.03, 0, 'east-asia'),
  c('hong-kong', '홍콩', 114.17, 22.32, 50, 'east-asia'),
  c('taipei', '타이베이', 121.57, 25.03, 70, 'east-asia'),
  c('okinawa', '오키나와', 127.68, 26.21, 0, 'east-asia'),
  c('shanghai', '상하이', 121.47, 31.23, 50, 'east-asia'),
  c('beijing', '베이징', 116.41, 39.9, 50, 'east-asia'),
  c('busan', '부산', 129.08, 35.18, 100, 'east-asia'),
];

export const cityById = (id: string): City => {
  const city = CITIES.find((x) => x.id === id);
  if (!city) throw new Error(`없는 도시다: ${id}`);
  return city;
};

/** 프리셋 N의 도시 — 경로 차례 그대로. */
export const citiesFor = (count: PresetCount): City[] =>
  CITIES.filter((city) => city.rank !== 0 && city.rank <= count);

/** 특수칸 네 종류. 급행·후퇴는 주사위를 다시 굴려 그 수만큼 앞·뒤로 간다. */
export type SpecialKind = 'forward' | 'back' | 'restart' | 'rest';

export interface SpecialSquare {
  readonly cityId: string;
  readonly kind: SpecialKind;
  /** 왜 이 도시인가 — 판에 인쇄되지는 않고 규칙문·문서가 쓴다. */
  readonly reason: string;
}

/**
 * 기본 특수칸 열넷. 호스트는 전부 50 프리셋의 도시다 — 어느 프리셋에서도
 * 사라지지 않는다(토글로 끄면 그때 같이 꺼진다). 옛 인쇄본이 63칸에 열다섯쯤
 * 이었으니 50칸에는 이 정도가 맞다 — 더 많으면 주사위가 아니라 칸이 게임을
 * 한다. 도시가 100개로 늘어도 그대로다 — 큰 판에서는 그만큼 드물어진다.
 */
export const SPECIALS: readonly SpecialSquare[] = [
  { cityId: 'tokyo', kind: 'forward', reason: '신칸센 — 빠르다' },
  { cityId: 'honolulu', kind: 'forward', reason: '태평양 횡단 급행' },
  { cityId: 'easter-island', kind: 'rest', reason: '모아이를 구경하느라' },
  { cityId: 'panama-city', kind: 'forward', reason: '파나마 운하를 지나 곧장' },
  {
    cityId: 'miami',
    kind: 'restart',
    reason: '버뮤다 삼각지대에서 길을 잃었다',
  },
  { cityId: 'new-york', kind: 'back', reason: '택시가 꽉 막혔다' },
  { cityId: 'north-pole', kind: 'rest', reason: '눈보라에 발이 묶였다' },
  { cityId: 'paris', kind: 'forward', reason: '고속열차 TGV' },
  { cityId: 'cairo', kind: 'rest', reason: '피라미드를 보고 간다' },
  { cityId: 'nairobi', kind: 'back', reason: '사파리 차가 길을 잘못 들었다' },
  { cityId: 'dubai', kind: 'forward', reason: '직항 비행기' },
  { cityId: 'singapore', kind: 'rest', reason: '환승 대기' },
  { cityId: 'manila', kind: 'back', reason: '태풍에 배가 밀려났다' },
  { cityId: 'shanghai', kind: 'back', reason: '여권을 두고 왔다' },
];

export const SPECIAL_LABELS: Readonly<Record<SpecialKind, string>> = {
  forward: '급행',
  back: '후퇴',
  restart: '다시',
  rest: '쉼',
};

/** 특수칸이 경로 안에서 어떻게 그려지는지. 지금은 종류가 곧 표시다. */
export interface ResolvedSpecial {
  readonly cityId: string;
  readonly display: SpecialKind;
}

/**
 * 경로의 도시 목록에 특수칸을 얹는다. 호스트가 목록에 없는 칸은 **조용히
 * 빠진다**. 목적지가 없으므로 번호가 밀려도 아무 일도 없다.
 */
export const resolveSpecials = (route: readonly City[]): ResolvedSpecial[] => {
  const present = new Set(route.map((city) => city.id));
  return SPECIALS.filter((special) => present.has(special.cityId)).map(
    (special) => ({ cityId: special.cityId, display: special.kind }),
  );
};
