/**
 * 사진 파일 → 줄인 사진 → 화소 (IDE-020)
 *
 * **이 파일만 브라우저에 매여 있다.** `index.ts`가 모으는 파이프라인은 전부
 * 순수 함수라 서버 렌더러(`src/assets/games/dot-to-dot/artwork/`)와 `npm run
 * artwork`가 그대로 쓰는데, 여기는 `<canvas>`와 `Image`를 쓴다. 그래서 **`index.ts`
 * 에서 다시 내보내지 않는다** — 실수로 서버 코드가 끌어다 쓰면 Node에서 터진다.
 *
 * 하는 일은 셋이다.
 *
 * 1. **줄인다.** 파일에서 읽어 긴 변 512px JPEG로 만든다. 원본을 그대로 들고
 *    있으면 `localStorage` 5MB 한도에 사진 한 장이 다 들어간다(IDE-020 「사진을
 *    어디까지 간직하나」).
 * 2. **돌리고 뒤집는다.** 결과를 다시 구워 저장한다 — 각도를 따로 들고 다니지
 *    않는다. 값 하나가 줄면 원본 대조 보기도, 다시 따기도 각도를 몰라도 된다.
 * 3. **화소로 편다.** 그 뒤는 순수 파이프라인(`traceOutline`)의 몫이다.
 *
 * 사진은 여기서 끝난다. 서버로 가는 것은 좌표뿐이다.
 */
import type { RgbaImage } from './image.ts';

/**
 * 저장할 사진의 긴 변. 512px JPEG면 100KB쯤이다.
 *
 * **`MAX_SIDE_PX`(윤곽 따기가 줄이는 크기)보다 작아야 한다.** 그래야 저장한
 * 사진이 곧 윤곽을 딴 마스크와 같은 크기이고, 원본 대조 보기가 사진을 윤곽과
 * 같은 자리에 겹칠 수 있다(`fitTransform`이 마스크 좌표를 판 mm로 옮긴다).
 * 두 값이 어긋나면 겹친 사진이 슬며시 밀리기만 해 눈으로는 잡기 어려우므로
 * 도안 테스트가 대신 지킨다.
 */
export const PHOTO_MAX_SIDE_PX = 512;

/** JPEG 화질. 윤곽만 따면 되므로 낮춰도 결과가 거의 같다. */
export const PHOTO_QUALITY = 0.72;

/** 받아 줄 파일 크기. 요즘 폰 사진이 5MB쯤이라 넉넉하다. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** `<input type="file">`의 accept. 모바일에서는 이것만으로 카메라도 뜬다. */
export const PHOTO_ACCEPT = 'image/*';

/** 브라우저에 남는 사진 한 장. 이미 줄이고 돌린 결과다. */
export interface Photo {
  /** `data:image/jpeg;base64,…` */
  readonly dataUrl: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

/** 사용자에게 그대로 보여도 되는 사유를 담은 오류. */
export class PhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoError';
  }
}

const context = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoError('이 브라우저에서는 사진을 다룰 수 없다.');
  return ctx;
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new PhotoError(
          '사진을 읽지 못했다. JPEG·PNG·WebP 같은 그림 파일인지 확인한다.',
        ),
      );
    image.src = src;
  });

interface DrawOptions {
  /** 긴 변을 이만큼으로. 이미 작으면 그대로 둔다. */
  readonly maxSide?: number;
  /** 시계 방향 90° 회전 횟수(0~3). */
  readonly quarterTurns?: number;
  /** 좌우 반전. */
  readonly flip?: boolean;
}

/**
 * 그림 하나를 캔버스에 옮겨 그린다 — 줄이기·돌리기·뒤집기가 한 번에 끝난다.
 *
 * **흰 바탕을 먼저 깐다.** JPEG는 알파를 못 담아, 배경이 비어 있는 PNG를
 * 그대로 구우면 빈 자리가 검게 앉아 피사체로 잡힌다. 순수 쪽의 `toGray`가
 * 투명을 흰색으로 깔아 두는 것과 같은 규칙이다.
 */
function drawPhoto(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: DrawOptions = {},
): HTMLCanvasElement {
  const maxSide = options.maxSide ?? Infinity;
  const quarterTurns = (((options.quarterTurns ?? 0) % 4) + 4) % 4;
  const longest = Math.max(sourceWidth, sourceHeight);
  const scale = longest > maxSide ? maxSide / longest : 1;
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  const turned = quarterTurns % 2 === 1;
  canvas.width = turned ? height : width;
  canvas.height = turned ? width : height;

  const ctx = context(canvas);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (quarterTurns !== 0) ctx.rotate((quarterTurns * Math.PI) / 2);
  if (options.flip) ctx.scale(-1, 1);
  ctx.drawImage(source, -width / 2, -height / 2, width, height);
  return canvas;
}

const toPhoto = (canvas: HTMLCanvasElement): Photo => ({
  dataUrl: canvas.toDataURL('image/jpeg', PHOTO_QUALITY),
  widthPx: canvas.width,
  heightPx: canvas.height,
});

/**
 * 고른 파일을 저장할 수 있는 사진으로. 형식과 크기를 여기서 막는다.
 *
 * 실패는 전부 `PhotoError`이고 메시지가 그대로 화면에 뜬다 — 무엇이 잘못됐는지
 * 사용자가 알아야 다음 사진을 고를 수 있다.
 */
export async function readPhoto(file: File): Promise<Photo> {
  if (!file.type.startsWith('image/')) {
    throw new PhotoError(
      '그림 파일이 아니다. JPEG·PNG·WebP 같은 사진을 고른다.',
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = Math.round(MAX_FILE_BYTES / 1024 / 1024);
    throw new PhotoError(`사진이 너무 크다 — ${mb}MB까지 받는다.`);
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return toPhoto(
      drawPhoto(image, image.naturalWidth, image.naturalHeight, {
        maxSide: PHOTO_MAX_SIDE_PX,
      }),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 돌리거나 뒤집은 사진을 새로 굽는다.
 *
 * 각도를 값으로 들고 다니지 않고 **구워 넣는** 이유는 그 뒤가 전부 단순해지기
 * 때문이다 — 윤곽을 다시 딸 때도, 사진을 판 위에 겹쳐 볼 때도 "지금 몇 도인가"를
 * 아무도 묻지 않는다. 90° 단위라 기하 손실은 없고, JPEG를 다시 굽는 손실은
 * 512px에서 서너 번으로는 윤곽에 닿지 않는다.
 */
export async function turnPhoto(
  photo: Photo,
  options: { quarterTurns?: number; flip?: boolean },
): Promise<Photo> {
  const image = await loadImage(photo.dataUrl);
  return toPhoto(
    drawPhoto(image, image.naturalWidth, image.naturalHeight, options),
  );
}

/** 저장된 사진을 화소로 편다. 여기서부터는 순수 파이프라인이 받는다. */
export async function photoPixels(photo: Photo): Promise<RgbaImage> {
  const image = await loadImage(photo.dataUrl);
  const canvas = drawPhoto(image, image.naturalWidth, image.naturalHeight);
  return context(canvas).getImageData(0, 0, canvas.width, canvas.height);
}
