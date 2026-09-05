#!/bin/zsh
# 산출 PDF를 디지털로 실측한다 (IDE-007)
#
#     npm run print:verify
#
# 배율마다 두 가지를 잰다.
#   ① 배율 정확도 — 필드 라인이 도안이 말하는 자리·크기로 나오는가
#   ② 타일 이음   — 여러 장을 계획대로 붙이면 타일 없이 그린 기준 시트와 같은가
#
# 종이 실측을 대신하지는 않는다. 종이·프린터가 개입하기 **전까지**가 우리
# 책임이고 거기까지를 자동으로 잰다. 사람이 할 몫은
# `spikes/print-pipeline/README.md`의 체크리스트에 있다.
#
# 필요한 것: Ghostscript(gs) · ImageMagick(magick) · python3
set -e

DIR="${1:-out/print-samples}"
WORK="$DIR/verify"
# 12 px/mm = 304.8dpi. mm 좌표가 정수 픽셀로 떨어져 반올림 오차가 없다.
PX_PER_MM=12
DPI=304.8
# 무엇을 어디서 재는지는 도안이 정한다 — `measure-target.json`을 산출 단계가 쓴다.
# 값을 여기 적어 두면 도안을 고칠 때마다 조용히 어긋난다.

for tool in gs magick python3; do
  command -v $tool >/dev/null || { echo "$tool 가 필요하다"; exit 1; }
done
[[ -f "$DIR/measure-100-tiles.pdf" && -f "$DIR/measure-target.json" ]] || {
  echo "먼저 npm run print:samples 를 돌린다"; exit 1
}

target=$(python3 -c "
import json
t = json.load(open('$DIR/measure-target.json'))
print(t['xMm'], t['yMm'], t['widthMm'], t['heightMm'], t['lineWidthMm'], t['inkColor'])
")
tv=(${(z)target})
TARGET_X=$tv[1] TARGET_Y=$tv[2] TARGET_W=$tv[3] TARGET_H=$tv[4]
TARGET_LINE=$tv[5] FIELD_INK=$tv[6]

rm -rf "$WORK"; mkdir -p "$WORK"
px() { python3 -c "print(round($1 * $PX_PER_MM))"; }
raster() {
  gs -q -dNOPAUSE -dBATCH -sDEVICE=png16m -r$DPI \
     -dGraphicsAlphaBits=1 -dTextAlphaBits=1 -sOutputFile="$2" "$1"
}
# 필드 라인만 남긴 뒤 잉크의 경계 상자.
ink_bbox() {
  magick "$1" -fuzz 8% -fill white +opaque "$FIELD_INK" \
    -fill black -opaque "$FIELD_INK" -format "%@" info:
}

result=0
for scale in 50 100 200; do
  label="measure-$scale"
  plan=$(python3 -c "
import json
p=json.load(open('$DIR/$label-plan.json'))
t=p['tiles'][0]
print(p['cols'], p['rows'], p['partWidthMm'], p['partHeightMm'],
      t['dstXMm'], t['dstYMm'], t['srcWMm'], t['srcHMm'],
      p['tileWidthMm']-p['overlapXMm'], p['tileHeightMm']-p['overlapYMm'])
")
  # 배열로 받는다 — zsh에서 `$10`은 열 번째 인수가 아니라 `${1}0`이다.
  v=(${(z)plan})
  COLS=$v[1] ROWS=$v[2] PART_W=$v[3] PART_H=$v[4]
  DST_X=$v[5] DST_Y=$v[6] SRC_W=$v[7] SRC_H=$v[8] STEP_X=$v[9] STEP_Y=$v[10]

  raster "$DIR/$label-tiles.pdf" "$WORK/$label-tile%d.png"
  raster "$DIR/$label-reference.pdf" "$WORK/$label-reference.png"

  cmd=(magick -size $(px $PART_W)x$(px $PART_H) xc:white)
  i=1
  for ((r = 0; r < ROWS; r++)); do
    for ((c = 0; c < COLS; c++)); do
      magick "$WORK/$label-tile$i.png" \
        -crop $(px $SRC_W)x$(px $SRC_H)+$(px $DST_X)+$(px $DST_Y) +repage \
        "$WORK/$label-crop$i.png"
      cmd+=("$WORK/$label-crop$i.png"
            -geometry +$(px "$c*$STEP_X")+$(px "$r*$STEP_Y") -composite)
      ((i++))
    done
  done
  cmd+=("$WORK/$label-assembled.png")
  "${cmd[@]}"

  echo "== 배율 $scale% · A4 ${COLS}×${ROWS}장"
  python3 - "$(ink_bbox "$WORK/$label-reference.png")" \
            "$(ink_bbox "$WORK/$label-assembled.png")" \
            "$PX_PER_MM" "$scale" \
            "$TARGET_X" "$TARGET_Y" "$TARGET_W" "$TARGET_H" "$TARGET_LINE" <<'PY' || result=1
import re, sys
ref, asm, ppm, scale = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4])
tx, ty, tw, th, line = (float(v) for v in sys.argv[5:10])
parse = lambda v: [int(x) for x in re.match(r'(\d+)x(\d+)\+(\d+)\+(\d+)', v).groups()]
rw, rh, rx, ry = parse(ref)
aw, ah, ax, ay = parse(asm)
# 잉크는 선 굵기의 절반만큼 라인 바깥으로 번진다.
k = scale / 100
want_w, want_h = (tw + line) * k, (th + line) * k
want_x, want_y = (tx - line / 2) * k, (ty - line / 2) * k
size_err = max(abs(aw / ppm - want_w), abs(ah / ppm - want_h))
pos_err = max(abs(ax / ppm - want_x), abs(ay / ppm - want_y))
seam_err = max(abs(rw - aw), abs(rh - ah), abs(rx - ax), abs(ry - ay)) / ppm
print(f'   필드 실측  {aw/ppm:8.3f} × {ah/ppm:7.3f} mm   (도안이 말하는 값 {want_w:.3f} × {want_h:.3f})')
print(f'   배율 오차  {size_err:8.3f} mm      자리 오차 {pos_err:.3f} mm')
print(f'   이음 오차  {seam_err:8.3f} mm      (타일을 붙인 것 vs 한 장에 그린 것)')
ok = size_err <= 0.1 and pos_err <= 0.1 and seam_err == 0
print('   ' + ('통과' if ok else '실패 — verify/ 의 assembled·reference 를 비교한다'))
sys.exit(0 if ok else 1)
PY
done

echo
[[ $result -eq 0 ]] && echo "모든 배율에서 통과. 남은 것은 종이 실측이다." \
                    || echo "실패한 배율이 있다."
exit $result
