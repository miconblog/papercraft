/**
 * 올리기 전에 사진을 줄인다 (IDE-028)
 *
 * 폰으로 찍은 사진은 한 장에 3~8MB 다. 그대로 올리면 두 가지가 걸린다 —
 * 서버 액션 본문 한도에 닿고(그래서 `Body exceeded 1 MB limit` 를 봤다),
 * 무엇보다 **글을 읽는 사람이 그 8MB 를 그대로 내려받는다.** 종이에 뽑을
 * 도안도 아니고 글 사이의 사진이라 그럴 이유가 없다.
 *
 * 그래서 **브라우저에서 긴 변 1600px JPEG 로 굽는다.** 보통 200~400KB 가 된다.
 *
 * 줄이지 못하면 **원본을 그대로 돌려준다.** 캔버스를 못 쓰는 브라우저에서
 * 사진을 아예 못 넣게 되는 것보다, 큰 채로라도 올라가는 편이 낫다 — 서버 쪽
 * 한도(`uploadLimit.ts`)가 그때를 받아 준다.
 *
 * `IDE-020` 의 `dot-to-dot/browser.ts` 와 하는 일이 겹쳐 보이지만 목적이
 * 다르다. 그쪽은 **윤곽을 따려고** 512px 흑백에 가깝게 줄이고 결과를
 * `localStorage` 에 담는 `dataUrl` 로 만든다. 여기는 **보여 줄 사진**이라
 * 크기와 화질이 다르고, 결과가 폼에 실릴 `File` 이어야 한다.
 */

/** 긴 변. 글 폭이 최대 2xl(약 672px)이라 고해상도 화면에서도 넉넉하다. */
export const PHOTO_MAX_SIDE = 1600;

/** JPEG 화질. 사진에서 이 정도면 눈으로 원본과 가른다고 하기 어렵다. */
export const PHOTO_QUALITY = 0.82;

/** 이보다 작으면 손대지 않는다 — 이미 작은 그림을 다시 구우면 되레 나빠진다. */
const LEAVE_ALONE_BYTES = 400 * 1024;

/** 다시 구울 수 없는 형식. 움직이는 GIF 를 JPEG 로 구우면 첫 장만 남는다. */
const KEEP_AS_IS = ['image/gif'];

/** 줄일 필요가 있나. 판단만 하므로 브라우저 없이도 시험할 수 있다. */
export const shouldShrink = (file: { type: string; size: number }): boolean =>
  file.type.startsWith('image/') &&
  !KEEP_AS_IS.includes(file.type) &&
  file.size > LEAVE_ALONE_BYTES;

/** 줄인 파일 이름. 원래 이름을 알아볼 수 있게 남기고 확장자만 바꾼다. */
export const shrunkName = (name: string): string =>
  `${name.replace(/\.[^.]*$/, '') || 'photo'}.jpg`;

/**
 * 캔버스에 옮겨 그린다.
 *
 * `createImageBitmap` 에 `imageOrientation: 'from-image'` 를 준다 — **폰 사진은
 * 회전 정보를 EXIF 에 들고 있어서**, 그냥 그리면 옆으로 누운 사진이 된다.
 */
async function toCanvas(file: File): Promise<HTMLCanvasElement | null> {
  if (typeof createImageBitmap !== 'function') return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > PHOTO_MAX_SIDE ? PHOTO_MAX_SIDE / longest : 1;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 투명한 PNG 를 JPEG 로 구우면 빈 자리가 검게 앉는다. 흰 바탕을 먼저 깐다
    // (`dot-to-dot/browser.ts` 가 같은 이유로 같은 일을 한다).
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

const toBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY));

/**
 * 줄인 사진. 줄일 수 없거나 줄여서 되레 커지면 **원본을 그대로** 돌려준다.
 */
export async function shrinkPhoto(file: File): Promise<File> {
  if (!shouldShrink(file)) return file;

  try {
    const canvas = await toCanvas(file);
    if (!canvas) return file;

    const blob = await toBlob(canvas);
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], shrunkName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

/** 사람이 읽을 크기. 화면에 "3.8MB → 0.3MB" 로 적는다. */
export const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
