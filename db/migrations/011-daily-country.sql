-- 011 · 나라별 집계 — 방문 통계 지도
--
-- 나라 코드는 001 부터 **저장은 해 왔다**(`events.country`, 배포 플랫폼이
-- 붙여 주는 `x-vercel-ip-country`). 대시보드가 원본을 직접 세지 않으므로
-- (`report.ts` — 원본은 365일 뒤 사라진다) 다른 표와 같이 일자별 집계를 만든다.
--
-- 재실행 가능하다.

-- ── 나라별 집계 ──────────────────────────────────────────────────────
-- 코드를 모르는 줄(로컬·플랫폼 밖 요청)은 빈 문자열이다. 기본키에 들어가므로
-- null 이 아니다 — `daily_source.source` 와 같은 규칙이다.
create table if not exists daddys_craft.daily_country (
  day        date    not null,
  country    text    not null default '',
  pageviews  integer not null default 0,
  visitors   integer not null default 0,
  sessions   integer not null default 0,
  downloads  integer not null default 0,
  primary key (day, country)
);

alter table daddys_craft.daily_country enable row level security;
revoke all on daddys_craft.daily_country from anon, authenticated;
grant select on daddys_craft.daily_country to service_role;

-- ── 집계 갱신 ────────────────────────────────────────────────────────
-- 010 의 본문에 `daily_country` 한 덩이를 더했다. 서명이 그대로라 권한을 다시
-- 열 것이 없다.
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
  insert into daddys_craft.daily_channel (day, channel, pageviews, visitors, sessions, downloads)
  select e.day, e.channel,
         count(*) filter (where e.type = 'pageview' and not e.repeat_view),
         count(distinct e.visitor_id),
         count(distinct e.session_id),
         count(*) filter (where e.type = 'download')
  from daddys_craft.events e
  where e.day = any(v_days) and e.bot_score < p_bot_threshold
  group by e.day, e.channel;

  delete from daddys_craft.daily_source where day = any(v_days);
  insert into daddys_craft.daily_source (
    day, channel, source, medium, campaign,
    pageviews, visitors, sessions, downloads
  )
  select e.day, e.channel,
         coalesce(e.utm_source, e.referrer_host, 'app:' || e.in_app, ''),
         coalesce(e.utm_medium, ''),
         coalesce(e.utm_campaign, ''),
         count(*) filter (where e.type = 'pageview' and not e.repeat_view),
         count(distinct e.visitor_id),
         count(distinct e.session_id),
         count(*) filter (where e.type = 'download')
  from daddys_craft.events e
  where e.day = any(v_days) and e.bot_score < p_bot_threshold
  group by 1, 2, 3, 4, 5;

  delete from daddys_craft.daily_country where day = any(v_days);
  insert into daddys_craft.daily_country (
    day, country, pageviews, visitors, sessions, downloads
  )
  select e.day, coalesce(e.country, ''),
         count(*) filter (where e.type = 'pageview' and not e.repeat_view),
         count(distinct e.visitor_id),
         count(distinct e.session_id),
         count(*) filter (where e.type = 'download')
  from daddys_craft.events e
  where e.day = any(v_days) and e.bot_score < p_bot_threshold
  group by 1, 2;

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

revoke all on all functions in schema daddys_craft from anon, authenticated;

-- ── 이미 쌓인 원본으로 채우기 ────────────────────────────────────────
-- 다시 돌려도 결과가 같다. 원본이 남아 있는 날(최근 365일)만 접힌다.
select daddys_craft.rollup_daily(min(day), max(day)) from daddys_craft.events;
