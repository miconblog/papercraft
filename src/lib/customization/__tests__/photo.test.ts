/**
 * 사진 저장 — 다시 열기와 한도 초과 (IDE-020)
 *
 * 여기서 지키는 것이 둘이다.
 *
 * - **사진은 커스터마이즈에 섞이지 않는다.** 섞이면 미리보기·내보내기 요청에
 *   실려 서버로 간다.
 * - **저장에 실패하면 그 사실이 남는다.** 삼키면 사용자는 창을 닫고 나서야 안다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGame } from '@/lib/games';
import { defaultCustomization } from '@/lib/schema';
import { clearPhoto, loadPhoto, parsePhoto, savePhoto } from '../photo';
import {
  getSaveFailure,
  saveCustomization,
  subscribeSaveFailure,
  __resetSaveFailuresForTests,
} from '../storage';

const game = getGame('dot-to-dot')!;
const outlineSlotId = 'outline';

const photo = {
  dataUrl: 'data:image/jpeg;base64,AAAA',
  widthPx: 320,
  heightPx: 480,
  thresholdOffset: 12,
  detailLevel: 1,
  rectMm: { xMm: 10, yMm: 20, widthMm: 100, heightMm: 150 },
};

afterEach(() => {
  window.localStorage.clear();
  __resetSaveFailuresForTests();
  vi.restoreAllMocks();
});

describe('사진 저장소', () => {
  it('남긴 사진을 그대로 되살린다 — 밝기와 앉은 자리까지', () => {
    expect(savePhoto(game.id, outlineSlotId, photo).ok).toBe(true);
    expect(loadPhoto(game.id, outlineSlotId)).toEqual(photo);
  });

  it('커스터마이즈 저장과 키가 겹치지 않는다', () => {
    savePhoto(game.id, outlineSlotId, photo);
    saveCustomization(defaultCustomization(game));
    const keys = Object.keys(window.localStorage);
    const customizationKey = keys.find((k) => k.includes('customization'));
    expect(customizationKey).toBeDefined();
    // 사진이 커스터마이즈 쪽 값에 섞여 들어가면 서버로 실려 간다.
    expect(window.localStorage.getItem(customizationKey!)).not.toContain(
      'data:image',
    );
  });

  it('데이터 URL이 아니면 되살리지 않는다 — 바깥으로 요청이 나가지 않게', () => {
    expect(
      parsePhoto({ ...photo, dataUrl: 'https://example.com/a.jpg' }),
    ).toBeNull();
  });

  it('모양이 깨진 저장값은 없는 것으로 본다', () => {
    window.localStorage.setItem(
      `papercraft:photo:${game.id}:${outlineSlotId}`,
      '{ 이건 JSON이 아니다',
    );
    expect(loadPhoto(game.id, outlineSlotId)).toBeNull();
    expect(parsePhoto({ ...photo, widthPx: 0 })).toBeNull();
  });

  it('앉은 자리가 없는 사진도 받는다 — 아직 윤곽을 못 딴 사진이다', () => {
    savePhoto(game.id, outlineSlotId, { ...photo, rectMm: null });
    expect(loadPhoto(game.id, outlineSlotId)?.rectMm).toBeNull();
  });

  it('지우면 없어진다', () => {
    savePhoto(game.id, outlineSlotId, photo);
    clearPhoto(game.id, outlineSlotId);
    expect(loadPhoto(game.id, outlineSlotId)).toBeNull();
  });
});

describe('저장 한도', () => {
  const quotaOnce = (matches: (key: string) => boolean) =>
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
    ) {
      if (matches(key)) {
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
    });

  it('한도를 넘기면 사유를 돌려주고 그 사실이 남는다', () => {
    quotaOnce(() => true);
    const result = savePhoto(game.id, outlineSlotId, photo);
    expect(result).toEqual({ ok: false, reason: 'quota' });
    expect(getSaveFailure()).toBe('quota');
  });

  it('한도가 아닌 실패는 `blocked`다 — 사생활 보호 모드', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('접근할 수 없다');
    });
    expect(savePhoto(game.id, outlineSlotId, photo)).toEqual({
      ok: false,
      reason: 'blocked',
    });
  });

  it('사진만 실패했을 때 값 저장이 성공해도 경고가 걷히지 않는다', () => {
    // 마지막 결과 하나만 보면 여기서 경고가 사라진다 — 사진은 여전히 안 남았는데.
    quotaOnce((key) => key.includes('photo'));
    savePhoto(game.id, outlineSlotId, photo);
    saveCustomization(defaultCustomization(game));
    expect(getSaveFailure()).toBe('quota');
  });

  it('다시 성공하면 걷힌다', () => {
    const spy = quotaOnce(() => true);
    savePhoto(game.id, outlineSlotId, photo);
    expect(getSaveFailure()).toBe('quota');
    spy.mockRestore();
    savePhoto(game.id, outlineSlotId, photo);
    expect(getSaveFailure()).toBeNull();
  });

  it('사진을 지워도 걷힌다 — 못 남긴 것이 이제 없다', () => {
    quotaOnce(() => true);
    savePhoto(game.id, outlineSlotId, photo);
    clearPhoto(game.id, outlineSlotId);
    expect(getSaveFailure()).toBeNull();
  });

  it('구독자에게 알린다', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSaveFailure(listener);
    quotaOnce(() => true);
    savePhoto(game.id, outlineSlotId, photo);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });
});
