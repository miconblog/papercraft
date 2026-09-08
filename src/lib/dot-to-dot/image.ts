/**
 * 사진 픽셀 → 흑백 마스크 (IDE-019)
 *
 * 파이프라인의 첫 세 단계다 — **줄이기 · 회색조+흐리기 · 이진화**. 전부 순수
 * 함수이고 DOM에 매지 않는다. 브라우저는 `<canvas>`의 `ImageData`를 그대로
 * 넣고(`{width, height, data}` 모양이 같다), 테스트는 픽셀 배열을 직접 만든다.
 *
 * **외부 라이브러리를 들이지 않는다**(IDE-019 배경). OpenCV.js는 8MB가 넘어
 * 이 사이트가 여는 첫 화면보다 크다 — 여기 있는 것이 필요한 전부다.
 */

/** `ImageData`와 같은 모양. RGBA가 한 픽셀에 4바이트씩 늘어선다. */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray | Uint8Array | number[];
}

/** 회색조 한 채널. 값은 0(검정)~255(흰색)다. */
export interface GrayImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/**
 * 흑백 마스크. `1`이 **피사체**, `0`이 배경이다.
 *
 * 어느 쪽이 피사체인지는 밝기가 정하지 않는다 — 밝은 배경에 어두운 아이도,
 * 어두운 배경에 밝은 아이도 있다. `binarize`가 **가장자리에 많이 닿은 쪽을
 * 배경으로** 보고 정한다.
 */
export interface Mask {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/** 긴 변을 이만큼으로 줄인다. 노이즈가 줄고 뒤 단계가 전부 빨라진다. */
export const MAX_SIDE_PX = 1024;

/**
 * 회색조. 사람 눈이 느끼는 밝기(Rec. 601)로 섞는다 — 단순 평균을 쓰면 파란
 * 옷과 노란 배경이 같은 회색이 되어 이진화가 둘을 못 가른다.
 *
 * 투명한 픽셀은 **흰색으로 깐다.** PNG 스티커처럼 배경이 비어 있는 그림이
 * 들어오면 알파를 무시한 색(보통 검정)이 피사체로 잡혀 판이 통째로 칠해진다.
 */
export function toGray(image: RgbaImage): GrayImage {
  const { width, height, data } = image;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i += 1) {
    const o = i * 4;
    const alpha = data[o + 3] / 255;
    const r = data[o] * alpha + 255 * (1 - alpha);
    const g = data[o + 1] * alpha + 255 * (1 - alpha);
    const b = data[o + 2] * alpha + 255 * (1 - alpha);
    out[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return { width, height, data: out };
}

/**
 * 긴 변이 `maxSide`가 되게 줄인다. 이미 작으면 그대로 돌려준다.
 *
 * 상자 평균(box filter)이다 — 최근접 이웃으로 줄이면 줄무늬 옷에 무아레가
 * 생겨 이진화가 그 무늬를 윤곽으로 딴다.
 */
export function downscale(image: GrayImage, maxSide = MAX_SIDE_PX): GrayImage {
  const longest = Math.max(image.width, image.height);
  if (longest <= maxSide) return image;

  const scale = maxSide / longest;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const out = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor((y * image.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * image.height) / height));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor((x * image.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * image.width) / width));
      let sum = 0;
      let count = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          sum += image.data[sy * image.width + sx];
          count += 1;
        }
      }
      out[y * width + x] = Math.round(sum / count);
    }
  }
  return { width, height, data: out };
}

/**
 * 가우시안 흐리기. 옷의 무늬 같은 잔결을 없앤다.
 *
 * 분리 가능(separable) 커널이라 가로 한 번·세로 한 번이다. 가장자리는 **가장
 * 바깥 화소를 늘려** 잡는다(clamp) — 0으로 채우면 사진 테두리에 없던 어두운
 * 띠가 생겨 윤곽으로 딴다.
 */
export function gaussianBlur(image: GrayImage, sigma = 1.4): GrayImage {
  if (sigma <= 0) return image;
  const radius = Math.max(1, Math.ceil(sigma * 2.5));
  const kernel = new Float64Array(radius * 2 + 1);
  let total = 0;
  for (let i = -radius; i <= radius; i += 1) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = v;
    total += v;
  }
  for (let i = 0; i < kernel.length; i += 1) kernel[i] /= total;

  const { width, height } = image;
  const clamp = (v: number, max: number) => (v < 0 ? 0 : v > max ? max : v);

  const horizontal = new Float64Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        sum +=
          kernel[k + radius] * image.data[y * width + clamp(x + k, width - 1)];
      }
      horizontal[y * width + x] = sum;
    }
  }

  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -radius; k <= radius; k += 1) {
        sum +=
          kernel[k + radius] * horizontal[clamp(y + k, height - 1) * width + x];
      }
      out[y * width + x] = Math.round(clamp(sum, 255));
    }
  }
  return { width, height, data: out };
}

/**
 * Otsu 자동 임계값. 두 무리로 갈랐을 때 무리 사이 분산이 가장 커지는 값이다.
 *
 * 사용자가 임계값을 미는 것은 `IDE-020`이다 — 여기서는 자동으로 정하고,
 * 실패하면 `traceOutline`이 사유로 알린다.
 */
export function otsuThreshold(image: GrayImage): number {
  const histogram = new Float64Array(256);
  for (const v of image.data) histogram[v] += 1;
  const total = image.data.length;

  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * histogram[i];

  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let bestVariance = -1;
  for (let t = 0; t < 256; t += 1) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;
    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) *
      (meanBackground - meanForeground);
    if (between > bestVariance) {
      bestVariance = between;
      best = t;
    }
  }
  return best;
}

/**
 * 임계값으로 가른 뒤 **어느 쪽이 피사체인지 정한다.**
 *
 * 판단 근거는 밝기가 아니라 **테두리**다. 사진 가장자리를 절반 넘게 차지한
 * 쪽은 배경이다 — 아이를 찍은 사진에서 아이가 네 변에 다 닿는 일은 드물다.
 * 이 뒤집기가 없으면 어두운 배경에 밝게 선 아이가 통째로 배경이 된다.
 */
export function binarize(image: GrayImage, threshold: number): Mask {
  const { width, height } = image;
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = image.data[i] <= threshold ? 1 : 0;
  }

  let border = 0;
  let borderOn = 0;
  const touch = (x: number, y: number) => {
    border += 1;
    borderOn += data[y * width + x];
  };
  for (let x = 0; x < width; x += 1) {
    touch(x, 0);
    touch(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    touch(0, y);
    touch(width - 1, y);
  }

  if (border > 0 && borderOn * 2 > border) {
    for (let i = 0; i < data.length; i += 1) data[i] = data[i] === 1 ? 0 : 1;
  }
  return { width, height, data };
}

/** 사진 하나를 마스크까지. 중간 단계를 따로 부를 일은 테스트에만 있다. */
export function toMask(
  image: RgbaImage,
  options: { maxSide?: number; sigma?: number; threshold?: number } = {},
): Mask {
  const gray = gaussianBlur(
    downscale(toGray(image), options.maxSide ?? MAX_SIDE_PX),
    options.sigma ?? 1.4,
  );
  return binarize(gray, options.threshold ?? otsuThreshold(gray));
}
