# 도안 인쇄용 한글 폰트

PDF 생성기(`src/lib/print/font.ts`)가 **생성 시점에만** 읽는다. 사용자에게
내려보내지 않는다 — 글자는 폰트를 임베딩하지 않고 벡터 윤곽선으로 그린다
(`docs/print-spec.md` §7, IDE-002 결정 기록).

| 파일                     | 쓰임                           | 출처                                                                   |
| ------------------------ | ------------------------------ | ---------------------------------------------------------------------- |
| `NotoSansKR-Regular.otf` | 본문                           | [noto-cjk](https://github.com/notofonts/noto-cjk) `Sans/SubsetOTF/KR/` |
| `NotoSansKR-Bold.otf`    | 굵은 글자(`font-weight ≥ 600`) | 〃                                                                     |
| `OFL.txt`                | SIL Open Font License 1.1      | 〃 `Sans/LICENSE`                                                      |

굵기마다 파일을 따로 둔다. 합성 볼드(같은 글리프를 굵게 덧그리기)는 쓰지 않는다 —
한글은 획이 뭉개져 작은 크기에서 읽히지 않는다.
