# 인쇄 파이프라인 스파이크 (IDE-002)

종이에 mm가 맞는지를 **코드로 재고**, 프린터가 개입하는 부분은 **사람이 자로 재도록**
준비물을 만들어 두는 곳이다. 제품 코드가 아니라 검증 도구다 — `src/`에 들어가지
않는다. 여기서 나온 규격은 [`docs/print-spec.md`](../../docs/print-spec.md)에 정리되어
있고 `IDE-007`이 그것을 따른다.

## 무엇이 여기 있나

| 파일               | 하는 일                                                       |
| ------------------ | ------------------------------------------------------------- |
| `lib/geometry.mjs` | mm ↔ pt ↔ px 변환, A4 상수, 프린터 여백·겹침 기본값           |
| `lib/pattern.mjs`  | 검증 도안 3종(보드 · 부속 별지 · 인쇄 가능 영역 탐침)         |
| `lib/tile.mjs`     | A4 타일 분할 계산 — 용지 방향까지 골라 장수를 최소화          |
| `lib/marks.mjs`    | 재단선 · 겹침 표시 · 조립 표식 · 장 번호                      |
| `lib/compose.mjs`  | 도안 + 배율 + 타일 계획 → 시트 목록                           |
| `lib/render-*.mjs` | 후보별 렌더러(HTML/CSS · SVG · pdf-lib · 브라우저 jsPDF)      |
| `lib/cdp.mjs`      | 의존성 없는 최소 CDP 클라이언트 — 헤드리스 Chrome 인쇄 제어   |
| `lib/raster.mjs`   | Ghostscript 렌더 + PGM 직접 판독으로 mm 실측                  |
| `build.mjs`        | 후보 × 도안 × 배율 산출물 생성 → `out/`                       |
| `measure.mjs`      | 산출물 실측 → `out/measure-report.md`                         |
| `fonts.mjs`        | 한글 폰트 임베딩 방식별 용량·재현 비교 → `out/font-report.md` |

## 돌리는 법

```bash
node spikes/print-pipeline/build.mjs     # 산출물 생성 (5~10분, 후보 ③이 느리다)
node spikes/print-pipeline/measure.mjs   # 디지털 실측
node spikes/print-pipeline/fonts.mjs     # 한글 폰트 비교
```

필요한 것:

- **Chrome** — 후보 ①·②-a·③ 실행. 다른 경로면 `CHROME_PATH` 환경변수로 준다
- **Ghostscript**(`gs`) — 실측용 래스터화. `brew install ghostscript`
- **폰트** — `assets/NotoSansKR-Regular.otf`(OFL). 없으면 아래로 받는다

```bash
curl -sSL -o spikes/print-pipeline/assets/NotoSansKR-Regular.otf \
  https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf
```

`out/`과 `assets/*.otf`·`assets/*.ttf`는 저장소에 넣지 않는다(용량). 위 명령으로 언제든 다시 만든다.

`package.json`의 `pdf-lib` · `@pdf-lib/fontkit` · `jspdf` · `svg2pdf.js`는 이 비교를
다시 돌릴 수 있게 남겨 둔 것이다. 이 중 **제품이 실제로 쓰는 것은 `pdf-lib`과
`@pdf-lib/fontkit`뿐**이고, `IDE-007`이 그 둘을 `dependencies`로 올린다.

---

## 종이 검증 절차 — 사람이 해야 하는 부분

코드는 **PDF 안의 치수**까지만 보증한다. 프린터 드라이버·용지 급지·잉크 번짐은
실물로만 확인된다. 아래 순서대로 하고 결과를 `IDE-002`의 결정 기록에 남긴다.

### 0. 공통 인쇄 설정 (모든 시트에 해당)

PDF 뷰어에서:

- **크기: 실제 크기 / 100%** — "용지에 맞춤(Fit to page)", "자동 회전 및 가운데 맞춤"을 **끈다**
- **용지: A4**
- 양면 인쇄 **끔**
- 프린터 드라이버의 "축소/확대", "테두리 없음(무여백)" **끔**

> 이 중 하나라도 틀리면 치수가 몇 %씩 어긋난다. 이것이 후보 ①(브라우저 인쇄
> 대화상자)을 채택하지 않은 이유다 — `out/measure-report.md`의 "사용자 기본설정" 줄을 보라.

### 1. 프린터의 인쇄 불가 여백 재기

`out/B2-probe-printable-area.pdf`를 A4 한 장에 뽑는다.

- 온전히 다 찍힌 **가장 바깥 사각형의 숫자**가 그 프린터의 인쇄 불가 여백이다
- 네 변이 다를 수 있으니 위·아래·좌·우를 각각 본다(아래쪽이 더 큰 기종이 많다)
- 잰 값을 적어 둔다 → `lib/geometry.mjs`의 `DEFAULT_PRINTER_MARGIN`이 이보다 크면 그대로 두고,
  작으면 그 프린터에서는 타일 장수가 늘 수 있다

| 프린터 | 위  | 아래 | 좌  | 우  |
| ------ | --- | ---- | --- | --- |
|        |     |      |     |     |

### 2. 배율 100% 실측

`out/B2-board-tiled-100.pdf`를 뽑는다(A4 **가로** 2장).

1. 1번 장의 **A↔B** 눈금선을 자로 잰다 → **150mm ±1mm** 여야 한다
2. **C↔D**를 잰다 → **200mm ±1mm**
3. 가로 눈금자 0↔10, 세로 눈금자 0↔10을 잰다 → 각 **100mm**
4. 두 장을 겹침 10mm 구간에서 포개 붙인다 — 정렬 삼각형 ▶▼ 두 쌍이 정확히 겹쳐야 한다
5. 붙인 뒤 **테두리 전체**를 잰다 → **210 × 297mm**

### 3. 축소·확대 실측

| 파일                       | 재는 곳 | 나와야 하는 값 |
| -------------------------- | ------- | -------------- |
| `B2-board-single-50.pdf`\* | A↔B     | 75mm           |
| `B2-board-tiled-100.pdf`   | A↔B     | 150mm          |
| `B2-board-tiled-200.pdf`   | A↔B     | 300mm          |

\* 50%는 A4 한 장에 그대로 들어간다(105×148.5mm). 타일 분할이 필요 없다.

### 4. 이음 확인 (확대 출력)

`out/B2-board-tiled-200.pdf` 8장을 뽑아 장 번호대로 붙인다.

- 하프라인이 **한 줄로** 이어지는가
- **빗살 21줄**이 이음선에서 끊기거나 계단지지 않는가
- 센터 서클이 원으로 보이는가
- 붙인 판 전체를 재면 **420 × 594mm** 인가

### 5. 부속 별지

`out/B2-accessory-tiled-100.pdf`를 뽑는다.

- 실선(오림선)을 가위로 잘라 본다 — 선이 남지도, 도안이 잘리지도 않는가
- 파선(골접기)·일점쇄선(산접기)대로 접힌다는 걸 알아볼 수 있는가
- 해칭(풀칠면)이 풀칠할 자리로 읽히는가
- **선 굵기 재현** 눈금에서 어느 굵기부터 안 보이는지 적는다 → 최소 선 굵기 결론

| 프린터 | 보이는 최소 굵기 |
| ------ | ---------------- |
|        |                  |

### 6. 브라우저 확인

PDF를 만드는 쪽은 브라우저와 무관하지만(→ `docs/print-spec.md`), **뽑는 화면**은
브라우저를 탄다. Chrome · Safari · Firefox 각각에서:

- PDF 내려받기가 되는가
- 뷰어에서 "실제 크기"로 인쇄했을 때 2번의 실측이 같게 나오는가

| 브라우저 | 버전 | 내려받기 | 100% 실측 | 비고 |
| -------- | ---- | -------- | --------- | ---- |
| Chrome   |      |          |           |      |
| Safari   |      |          |           |      |
| Firefox  |      |          |           |      |
