-- 004 · 순 페이지뷰 — 한 세션에서 같은 경로는 한 번만 (IDE-025)
--
-- 새로고침할 때마다 PV 가 올라가면 그 숫자로는 아무것도 판단할 수 없다. F5 를
-- 몇 번 눌렀느냐가 "사람들이 얼마나 봤느냐"를 덮어 버린다.
--
-- **세션당 경로 하나에 한 번만 센다.** 세션 전체에 한 번이 아니다 — 그러면
-- PV 가 세션 수와 같아져서, 카탈로그에서 상세로, 상세에서 만들기로 들어가는
-- **깊이가 통째로 사라진다.** 그 깊이가 이 사이트에서 가장 보고 싶은 것이다.
--
-- 줄은 그대로 남기고 표시만 한다(003 과 같은 방식이다). 집계에서만 빠지므로,
-- 새로고침을 몇 번 했는지는 원본에 남아 있다 — 그 자체가 봇 신호이기도 하다.
--
-- 재실행 가능하다.

alter table daddys_craft.events
  add column if not exists repeat_view boolean not null default false;

-- ── 이벤트 기록 ──────────────────────────────────────────────────────
-- 서명은 그대로다. 판정은 **앱이 아니라 여기서** 한다 — 앱이 판단하려면 "이
-- 세션에 이 경로가 있었나"를 물어보는 왕복이 한 번 더 들고, 동시에 들어온 두
-- 요청이 서로를 못 보고 둘 다 처음이라고 답한다.
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
  v_repeat  boolean := false;
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
  else
    -- 이어지는 세션일 때만 볼 것이 있다. 새 세션이면 물어볼 것도 없다.
    --
    -- **다운로드는 세지 않는다.** 같은 도안을 두 번 받는 것은 새로고침과 달리
    -- 사람이 두 번 마음먹은 것이다.
    if p_type = 'pageview' then
      select exists (
        select 1 from daddys_craft.events e
        where e.session_id = v_session
          and e.type = 'pageview'
          and e.path = p_path
      ) into v_repeat;
    end if;
  end if;

  insert into daddys_craft.events (
    day, type, session_id, visitor_id, path, game_id, referrer_host,
    utm_source, utm_medium, utm_campaign, channel,
    ua_browser, ua_os, ua_device, country, lang, bot_score, bot_reason,
    repeat_view
  ) values (
    p_day, p_type, v_session, p_visitor_id, p_path, p_game_id, p_referrer_host,
    p_utm_source, p_utm_medium, p_utm_campaign, p_channel,
    p_ua_browser, p_ua_os, p_ua_device, p_country, p_lang,
    coalesce(p_bot_score, 0), p_bot_reason, v_repeat
  );

  return v_session;
end;
$$;

-- 위 exists 가 매번 훑는 조건이다.
create index if not exists events_session_path_idx
  on daddys_craft.events (session_id, path);

-- ── 집계 갱신 ────────────────────────────────────────────────────────
-- 서명이 그대로라 권한을 다시 열 것이 없다. 바뀐 것은 pageviews 를 세는
-- 조건 하나뿐이다 — **되짚은 것은 빼고 센다.**
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

  delete from daddys_craft.daily_traffic where day = any(v_days);
  insert into daddys_craft.daily_traffic (day, pageviews, visitors, sessions, downloads)
  select e.day,
         count(*) filter (where e.type = 'pageview' and not e.repeat_view),
         count(distinct e.visitor_id),
         count(distinct e.session_id),
         count(*) filter (where e.type = 'download')
  from daddys_craft.events e
  where e.day = any(v_days) and e.bot_score < p_bot_threshold
  group by e.day;

  delete from daddys_craft.daily_channel where day = any(v_days);
  insert into daddys_craft.daily_channel (day, channel, pageviews, visitors, sessions)
  select e.day, e.channel,
         count(*) filter (where e.type = 'pageview' and not e.repeat_view),
         count(distinct e.visitor_id),
         count(distinct e.session_id)
  from daddys_craft.events e
  where e.day = any(v_days) and e.bot_score < p_bot_threshold
  group by e.day, e.channel;

  delete from daddys_craft.daily_game where day = any(v_days);
  insert into daddys_craft.daily_game (day, game_id, views, downloads)
  select e.day, e.game_id,
         count(*) filter (where e.type = 'pageview' and not e.repeat_view),
         count(*) filter (where e.type = 'download')
  from daddys_craft.events e
  where e.day = any(v_days) and e.game_id is not null
    and e.bot_score < p_bot_threshold
  group by e.day, e.game_id;
end;
$$;
