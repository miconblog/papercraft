-- 003 · 봇 신호와 집계 제외 (IDE-024)
--
-- 001 의 UA 정규식은 **줄을 아예 안 만든다.** 확실한 크롤러에는 맞는 처분이지만,
-- 위장한 자동화를 잡으려면 확률적인 신호를 봐야 하고 그런 판정으로 줄을 지우면
-- 진짜 사람을 조용히 지워 놓고 알아채지 못한다.
--
-- 그래서 여기서는 **줄을 남기고 점수를 매긴다.** 집계에서만 빼면 대시보드
-- 숫자는 깨끗해지고, 원본을 열어 무엇이 걸렸는지 감사할 수 있다.
--
-- 재실행 가능하다.

-- ── 새 칸 ────────────────────────────────────────────────────────────
-- lang 은 `Accept-Language` 의 **첫 태그의 언어 코드 하나**다(`ko` · `de`).
-- 지역까지(`de-AT`) 남기지 않는다 — 전체 문자열은 언어 목록과 가중치까지 실려
-- 오는 지문이라 IP 없이도 사람을 좁히는 데 쓰인다.
alter table daddys_craft.events
  add column if not exists lang text,
  add column if not exists bot_score smallint not null default 0,
  -- 왜 그 점수가 나왔는지. 점수만 남기면 기준을 조일 때 무엇을 보고 매긴
  -- 것인지 알 수 없어 감사가 되지 않는다.
  add column if not exists bot_reason text;

-- 집계가 매번 훑는 조건이다.
create index if not exists events_day_bot_idx
  on daddys_craft.events (day, bot_score);

-- ── 이벤트 기록 ──────────────────────────────────────────────────────
-- 인자가 둘 늘었다. 같은 이름에 인자만 다른 함수가 둘 남으면 호출이 어느 쪽으로
-- 갈지 이름만 보고 알 수 없으므로, **옛 서명을 먼저 지운다.**
drop function if exists daddys_craft.record_event(
  date, text, text, text, text, text, text, text,
  text, text, text, text, text, text);

create or replace function daddys_craft.record_event(
  p_day          date,
  p_type         text,
  p_visitor_id   text,
  p_path         text,
  p_channel      text,
  p_game_id      text default null,
  p_referrer_host text default null,
  p_utm_source   text default null,
  p_utm_medium   text default null,
  p_utm_campaign text default null,
  p_ua_browser   text default null,
  p_ua_os        text default null,
  p_ua_device    text default null,
  p_country      text default null,
  p_lang         text default null,
  p_bot_score    smallint default 0,
  p_bot_reason   text default null
) returns uuid
language plpgsql
security definer
set search_path = daddys_craft, pg_temp
as $$
declare
  v_session uuid;
begin
  -- 30분 무활동이면 새 세션이다.
  select e.session_id into v_session
  from daddys_craft.events e
  where e.visitor_id = p_visitor_id
    and e.occurred_at > now() - interval '30 minutes'
  order by e.occurred_at desc
  limit 1;

  if v_session is null then
    v_session := gen_random_uuid();
  end if;

  insert into daddys_craft.events (
    day, type, session_id, visitor_id, path, game_id, referrer_host,
    utm_source, utm_medium, utm_campaign, channel,
    ua_browser, ua_os, ua_device, country, lang, bot_score, bot_reason
  ) values (
    p_day, p_type, v_session, p_visitor_id, p_path, p_game_id, p_referrer_host,
    p_utm_source, p_utm_medium, p_utm_campaign, p_channel,
    p_ua_browser, p_ua_os, p_ua_device, p_country, p_lang,
    coalesce(p_bot_score, 0), p_bot_reason
  );

  return v_session;
end;
$$;

-- ── 집계 갱신 ────────────────────────────────────────────────────────
-- 문턱을 **인자로** 받는다. 앱에 박아 두고 `is_bot` 을 저장하면, 나중에 기준을
-- 바꿔도 이미 쌓인 줄의 판정이 옛 기준에 굳어 다시 계산해도 안 바뀐다.
-- 점수를 남기고 문턱을 여기서 쥐면, 기준을 고친 뒤 `rollup_daily` 를 다시
-- 돌리는 것만으로 지난 날짜까지 새 기준으로 따라온다.
drop function if exists daddys_craft.rollup_daily(date, date);

create or replace function daddys_craft.rollup_daily(
  p_from date,
  p_to   date,
  p_bot_threshold smallint default 2
) returns void
language plpgsql
security definer
set search_path = daddys_craft, pg_temp
as $$
declare
  v_days date[];
begin
  select coalesce(array_agg(distinct e.day), '{}')
    into v_days
  from daddys_craft.events e
  where e.day between p_from and p_to;

  if array_length(v_days, 1) is null then
    return;
  end if;

  -- 봇으로 매긴 줄은 여기서만 빠진다. 원본에는 그대로 남아 감사할 수 있다.
  delete from daddys_craft.daily_traffic where day = any(v_days);
  insert into daddys_craft.daily_traffic (day, pageviews, visitors, sessions, downloads)
  select e.day,
         count(*) filter (where e.type = 'pageview'),
         count(distinct e.visitor_id),
         count(distinct e.session_id),
         count(*) filter (where e.type = 'download')
  from daddys_craft.events e
  where e.day = any(v_days) and e.bot_score < p_bot_threshold
  group by e.day;

  delete from daddys_craft.daily_channel where day = any(v_days);
  insert into daddys_craft.daily_channel (day, channel, pageviews, visitors, sessions)
  select e.day, e.channel,
         count(*) filter (where e.type = 'pageview'),
         count(distinct e.visitor_id),
         count(distinct e.session_id)
  from daddys_craft.events e
  where e.day = any(v_days) and e.bot_score < p_bot_threshold
  group by e.day, e.channel;

  delete from daddys_craft.daily_game where day = any(v_days);
  insert into daddys_craft.daily_game (day, game_id, views, downloads)
  select e.day, e.game_id,
         count(*) filter (where e.type = 'pageview'),
         count(*) filter (where e.type = 'download')
  from daddys_craft.events e
  where e.day = any(v_days) and e.game_id is not null
    and e.bot_score < p_bot_threshold
  group by e.day, e.game_id;
end;
$$;

-- ── 다시 여는 권한 ───────────────────────────────────────────────────
-- 위에서 옛 서명을 지웠으므로 권한도 함께 사라졌다. 새 서명으로 다시 연다.
grant execute on function
  daddys_craft.record_event(date, text, text, text, text, text, text, text,
                            text, text, text, text, text, text, text, smallint,
                            text),
  daddys_craft.rollup_daily(date, date, smallint)
  to service_role;

revoke all on all functions in schema daddys_craft from anon, authenticated;
