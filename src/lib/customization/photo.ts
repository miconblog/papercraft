/**
 * 사진을 브라우저에 간직한다 (IDE-020)
 *
 * **커스터마이즈와 다른 키에 둔다.** 이유가 하나뿐이고 그게 결정적이다 —
 * `GameCustomization`은 미리보기(`/api/games/[id]/artwork`)와 내보내기로
 * **서버에 통째로 실려 간다.** 사진을 거기 넣으면 아이 사진이 서버로 가고,
 * 그것은 이 놀이를 만들며 하지 않기로 한 일이다(IDE-019, 2026-09-08). 값에
 * 담을 자리를 아예 만들지 않는 것이 실수할 여지를 없앤다.
 *
 * 남기는 것은 **줄인 사진 한 장과 그것을 다시 딸 때 필요한 값들**이다. 윤곽선
 * 좌표 자체는 커스터마이즈의 `outline` 슬롯에 있다 — 다시 열었을 때 사진에서
 * 새로 따지 않고 저장된 좌표를 그대로 쓰는 이유는, 다시 딴 결과가 처음과
 * 미세하게 달라지면 사용자 눈에는 도안이 저 혼자 바뀐 것으로 보이기 때문이다.
 * 사진이 하는 일은 **개수를 바꾸는 것이 아니라 다시 따는 것**이다 — 밝기를
 * 밀거나 돌리거나 뒤집을 때 원본이 있어야 한다.
 */
import type { Photo } from '@/lib/dot-to-dot/browser';
import type { RectMm } from '@/lib/schema';
import { removeStorage, writeStorage, type SaveResult } from './storage';

const KEY_PREFIX = 'papercraft:photo:';

/** 게임과 슬롯마다 키를 나눈다 — 윤곽 슬롯이 둘인 도안도 언젠가 있을 수 있다. */
const photoKey = (gameId: string, slotId: string): string =>
  `${KEY_PREFIX}${gameId}:${slotId}`;

export interface StoredPhoto extends Photo {
  /**
   * Otsu가 정한 임계값에서 사용자가 민 정도. 다시 열었을 때 슬라이더가 제자리에
   * 있어야 "다시 따기"가 같은 결과를 낸다.
   */
  readonly thresholdOffset: number;
  /**
   * 밝기를 몇 단 더 나눠 **세부 선**을 딸지 (IDE-021). 0이면 세부가 없다.
   *
   * 이것도 밝기와 같은 "어떻게 뽑았나" 설정이라 여기 남는다 — 도안이 고르는
   * 값이 아니라 사진에서 값을 만들 때 쓰는 손잡이다. 뽑아 낸 선 자체는
   * 커스터마이즈의 세부 슬롯에 있다.
   */
  readonly detailLevel: number;
  /**
   * 딴 윤곽이 판 위 **어디에 앉았는지**(파트 로컬 mm). 원본 대조 보기가 사진을
   * 윤곽과 같은 자리에 겹치는 데 쓴다. 윤곽을 아직 못 딴 사진이면 없다.
   */
  readonly rectMm: RectMm | null;
}

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const parseRect = (value: unknown): RectMm | null => {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  if (
    !isFiniteNumber(r.xMm) ||
    !isFiniteNumber(r.yMm) ||
    !isFiniteNumber(r.widthMm) ||
    !isFiniteNumber(r.heightMm)
  ) {
    return null;
  }
  return {
    xMm: r.xMm,
    yMm: r.yMm,
    widthMm: r.widthMm,
    heightMm: r.heightMm,
  };
};

/**
 * 저장된 사진을 되살린다. 모양이 조금이라도 어긋나면 null이다 — 사진이 없는
 * 것은 회복할 수 있는 상태(다시 고르면 된다)이지만, 반쯤 깨진 사진은 캔버스로
 * 들어가 무슨 일이 날지 알 수 없다.
 *
 * **데이터 URL인지까지 본다.** 저장소는 사용자가 손댈 수 있는 자리라 `http://`
 * 같은 바깥 주소가 들어오면 사진을 부르는 요청이 나간다 — 사진이 브라우저 안에서
 * 끝난다는 약속이 거기서 깨진다.
 */
export const parsePhoto = (stored: unknown): StoredPhoto | null => {
  if (!stored || typeof stored !== 'object') return null;
  const p = stored as Record<string, unknown>;
  if (typeof p.dataUrl !== 'string' || !p.dataUrl.startsWith('data:image/'))
    return null;
  if (!isFiniteNumber(p.widthPx) || !isFiniteNumber(p.heightPx)) return null;
  if (p.widthPx <= 0 || p.heightPx <= 0) return null;
  return {
    dataUrl: p.dataUrl,
    widthPx: p.widthPx,
    heightPx: p.heightPx,
    thresholdOffset: isFiniteNumber(p.thresholdOffset) ? p.thresholdOffset : 0,
    // 세부가 없던 시절의 저장값은 0이다 — 다시 열었을 때 판이 저 혼자 바뀌지
    // 않는다. 세부를 보고 싶으면 사용자가 올린다.
    detailLevel: isFiniteNumber(p.detailLevel)
      ? Math.max(0, Math.round(p.detailLevel))
      : 0,
    rectMm: parseRect(p.rectMm),
  };
};

export function loadPhoto(gameId: string, slotId: string): StoredPhoto | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(photoKey(gameId, slotId));
  if (!raw) return null;
  try {
    return parsePhoto(JSON.parse(raw));
  } catch {
    return null;
  }
}

export const savePhoto = (
  gameId: string,
  slotId: string,
  photo: StoredPhoto,
): SaveResult => writeStorage(photoKey(gameId, slotId), JSON.stringify(photo));

export function clearPhoto(gameId: string, slotId: string): void {
  removeStorage(photoKey(gameId, slotId));
}
