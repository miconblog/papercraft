-- 006 · 게임을 지금 당장 내리는 스위치 (IDE-022)
--
-- 005 가 담은 것은 "언제 열리는가" 한 칸뿐이었다. 그것만으로는 **이미 열려
-- 있는 게임을 급히 내리는 일**이 어색하다 — 사용자 지적(2026-09-09): 날짜를
-- 잘못 넣어 게임이 열린 것을 뒤늦게 알았을 때, 날짜를 다시 계산해 미래로
-- 밀어 넣는 것보다 스위치를 끄는 쪽이 빠르고 실수가 적다.
--
-- 그래서 칸을 하나 더 둔다. **날짜와 서로 간섭하지 않는다** — 내려도 잡아 둔
-- 오픈 시각은 그대로 남고, 다시 올리면 그 예약이 이어진다.
--
-- `publish_at` 의 not null 도 푼다. "예약은 없지만 내려 둠"이 있어야 하는데,
-- 그 상태에 억지로 날짜를 채워 넣으면 화면에 뜻 없는 시각이 뜬다.
--
-- 재실행 가능하다.

alter table daddys_craft.game_release
  add column if not exists hidden boolean not null default false;

alter table daddys_craft.game_release
  alter column publish_at drop not null;
