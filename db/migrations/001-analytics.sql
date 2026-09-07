-- 001 · 자체 웹 분석 (IDE-013)
--
-- 이 Supabase 프로젝트는 다른 서비스와 함께 쓴다. 여기 있는 모든 객체는
-- daddys_craft 스키마 안에만 만든다 — 남의 스키마는 읽지도 고치지도 않는다.
-- 마이그레이션 러너(scripts/db-migrate.mts)가 이 규칙을 파일 내용으로 강제한다.
--
-- 전부 재실행 가능하다(create ... if not exists / create or replace).

create schema if not exists daddys_craft;

-- ── 적용 이력 ────────────────────────────────────────────────────────
-- 이력을 우리 스키마 안에 둔다. 이 프로젝트의 supabase_migrations 는 다른
-- 저장소가 주인이라 두 저장소가 같은 표를 다투게 두면 안 된다.
create table if not exists daddys_craft.migrations (
  filename    text primary key,
  checksum    text        not null,
  applied_at  timestamptz not null default now()
);

-- ── 원본 이벤트 ──────────────────────────────────────────────────────
-- 한 줄 = 방문/행동 하나. 365일 뒤 지운다(daddys_craft.purge_events).
--
-- 개인을 특정할 수 있는 값은 넣지 않는다 — IP 원본도, 전체 UA 문자열도
-- 저장하지 않는다. visitor_id 는 그날치 salt 로 만든 해시라 날이 바뀌면
-- 같은 사람이라도 다른 값이 된다.
create table if not exists daddys_craft.events (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  -- KST 기준 날짜. 앱이 넣는다(방문자 해시의 salt 도 같은 경계로 돈다).
  day           date        not null,
  type          text        not null check (type in ('pageview', 'download')),
  session_id    uuid        not null,
  visitor_id    text        not null,
  path          text        not null,
  game_id       text,
  -- referrer 는 호스트만 남긴다. 전체 URL 은 남의 사이트 경로까지 끌고 온다.
  referrer_host text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  channel       text        not null
                  check (channel in ('direct','organic','social','referral','campaign')),
  -- UA 요약. 원본이 아니라 세 칸으로 줄인 값이다.
  ua_browser    text,
  ua_os         text,
  ua_device     text
                  check (ua_device is null or ua_device in ('desktop','mobile','tablet')),
  country       text
);

create index if not exists events_day_type_idx
  on daddys_craft.events (day, type);

-- 세션 이어붙이기(같은 방문자의 30분 안 마지막 이벤트)에 쓴다.
create index if not exists events_visitor_recent_idx
  on daddys_craft.events (visitor_id, occurred_at desc);

create index if not exists events_occurred_at_idx
  on daddys_craft.events (occurred_at);

-- ── 일자별 집계 ──────────────────────────────────────────────────────
-- 뷰가 아니라 표다. 원본을 365일 뒤 지워도 추이는 남아야 하기 때문이다
-- (수용 기준: "365일 지난 원본이 지워져도 일자별 집계 수치는 그대로다").
create table if not exists daddys_craft.daily_traffic (
  day        date primary key,
  pageviews  integer not null default 0,
  visitors   integer not null default 0,  -- 일간 순방문자. 주·월 합계는 대략치다
  sessions   integer not null default 0,
  downloads  integer not null default 0
);

create table if not exists daddys_craft.daily_channel (
  day        date    not null,
  channel    text    not null,
  pageviews  integer not null default 0,
  visitors   integer not null default 0,
  sessions   integer not null default 0,
  primary key (day, channel)
);

create table if not exists daddys_craft.daily_game (
  day        date    not null,
  game_id    text    not null,
  views      integer not null default 0,
  downloads  integer not null default 0,
  primary key (day, game_id)
);

-- ── 잠금 ─────────────────────────────────────────────────────────────
-- 이 스키마는 PostgREST 의 Exposed schemas 에 들어간다. 그래서 RLS 가
-- 보험이 아니라 본선이다 — 켜고 정책을 **하나도** 만들지 않는다. 정책이
-- 없으면 RLS 를 우회하는 서비스 롤 외에는 전부 막힌다.
alter table daddys_craft.migrations    enable row level security;
alter table daddys_craft.events        enable row level security;
alter table daddys_craft.daily_traffic enable row level security;
alter table daddys_craft.daily_channel enable row level security;
alter table daddys_craft.daily_game    enable row level security;

-- 이중 잠금 — 스키마 권한 자체를 회수한다. RLS 는 행을 막고 이쪽은 스키마에
-- 닿는 것 자체를 막는다. 둘 중 하나가 실수로 풀려도 나머지가 버틴다.
revoke all on schema daddys_craft from anon, authenticated;
revoke all on all tables    in schema daddys_craft from anon, authenticated;
-- ── 서버에게만 열어 준다 ─────────────────────────────────────────────
-- 새 스키마는 만든 롤 말고 아무에게도 권한이 없다 — `service_role` 도 그렇다.
-- 그래서 여기서 **필요한 만큼만** 연다.
--
-- 표에 직접 쓰는 권한은 주지 않는다. 이벤트는 `record_event` 로만 들어가고,
-- 원본 `events` 는 서버조차 직접 읽지 못한다 — 서비스 롤 키가 새어 나가도
-- 할 수 있는 일이 "이벤트를 한 줄 넣는 것"에 그친다. 함수를 `security definer`
-- 로 둔 것이 이걸 가능하게 한다.
grant usage on schema daddys_craft to service_role;

-- 대시보드가 읽는 것은 집계뿐이다(원본이 365일 뒤 사라져도 수치가 남아야 해서).
grant select on
  daddys_craft.daily_traffic,
  daddys_craft.daily_channel,
  daddys_craft.daily_game
  to service_role;

grant execute on function
  daddys_craft.record_event(date, text, text, text, text, text, text, text,
                            text, text, text, text, text, text),
  daddys_craft.rollup_daily(date, date)
  to service_role;

revoke all on all functions in schema daddys_craft from anon, authenticated;
revoke all on all sequences in schema daddys_craft from anon, authenticated;

-- ── 이벤트 기록 ──────────────────────────────────────────────────────
-- 세션 이어붙이기를 SQL 안에서 한다. 앱에서 "마지막 이벤트 조회 → 삽입"
-- 두 번으로 나누면 왕복이 늘고, 동시에 들어온 두 요청이 각자 새 세션을
-- 만든다.
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
  p_country      text default null
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
    ua_browser, ua_os, ua_device, country
  ) values (
    p_day, p_type, v_session, p_visitor_id, p_path, p_game_id, p_referrer_host,
    p_utm_source, p_utm_medium, p_utm_campaign, p_channel,
    p_ua_browser, p_ua_os, p_ua_device, p_country
  );

  return v_session;
end;
$$;

-- ── 집계 갱신 ────────────────────────────────────────────────────────
-- 주어진 날짜 구간을 원본에서 다시 계산해 덮어쓴다. 몇 번을 돌려도 결과가
-- 같다. 원본이 이미 지워진 날은 손대지 않는다 — 지워진 날을 다시 계산하면
-- 남아 있던 집계가 0으로 덮인다.
create or replace function daddys_craft.rollup_daily(
  p_from date,
  p_to   date
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
         count(*) filter (where e.type = 'pageview'),
         count(distinct e.visitor_id),
         count(distinct e.session_id),
         count(*) filter (where e.type = 'download')
  from daddys_craft.events e
  where e.day = any(v_days)
  group by e.day;

  delete from daddys_craft.daily_channel where day = any(v_days);
  insert into daddys_craft.daily_channel (day, channel, pageviews, visitors, sessions)
  select e.day, e.channel,
         count(*) filter (where e.type = 'pageview'),
         count(distinct e.visitor_id),
         count(distinct e.session_id)
  from daddys_craft.events e
  where e.day = any(v_days)
  group by e.day, e.channel;

  delete from daddys_craft.daily_game where day = any(v_days);
  insert into daddys_craft.daily_game (day, game_id, views, downloads)
  select e.day, e.game_id,
         count(*) filter (where e.type = 'pageview'),
         count(*) filter (where e.type = 'download')
  from daddys_craft.events e
  where e.day = any(v_days) and e.game_id is not null
  group by e.day, e.game_id;
end;
$$;

-- ── 원본 정리 ────────────────────────────────────────────────────────
-- 지우기 전에 지울 구간을 반드시 한 번 더 집계한다. 순서가 뒤바뀌면 그날의
-- 수치가 통째로 사라진다.
create or replace function daddys_craft.purge_events(
  p_keep_days integer default 365
) returns bigint
language plpgsql
-- **일부러 security definer 가 아니다.** Postgres 는 새 함수의 실행 권한을
-- 누구에게나 열어 두는데, 정의자 권한까지 얹으면 서비스 롤 키가 새어 나갔을 때
-- 원본을 통째로 지울 수 있게 된다. 호출자 권한이면 표에 delete 권한이 있는
-- 소유자(= pg_cron 이 도는 그 롤)만 실제로 지운다.
as $$
declare
  v_cutoff  date;
  v_deleted bigint;
begin
  v_cutoff := (now() at time zone 'Asia/Seoul')::date - p_keep_days;

  perform daddys_craft.rollup_daily(
    coalesce((select min(day) from daddys_craft.events), v_cutoff),
    v_cutoff
  );

  delete from daddys_craft.events where day < v_cutoff;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- 하루 한 번 도는 일감. pg_cron 이 켜져 있으면 002 가 이걸 건다.
create or replace function daddys_craft.run_daily_maintenance()
returns void
language plpgsql
-- purge_events 와 같은 이유로 호출자 권한이다.
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  -- 최근 사흘만 다시 계산한다. 늦게 도착한 이벤트와 자정 근처를 덮는다.
  perform daddys_craft.rollup_daily(v_today - 2, v_today);
  perform daddys_craft.purge_events(365);
end;
$$;

-- ── 서버에게만 열어 준다 ─────────────────────────────────────────────
-- 새 스키마는 만든 롤 말고 아무에게도 권한이 없다 — `service_role` 도 그렇다.
-- 그래서 여기서 **필요한 만큼만** 연다.
--
-- 표에 직접 쓰는 권한은 주지 않는다. 이벤트는 `record_event` 로만 들어가고,
-- 원본 `events` 는 서버조차 직접 읽지 못한다 — 서비스 롤 키가 새어 나가도
-- 할 수 있는 일이 "이벤트를 한 줄 넣는 것"에 그친다. 함수를 `security definer`
-- 로 둔 것이 이걸 가능하게 한다.
grant usage on schema daddys_craft to service_role;

-- 대시보드가 읽는 것은 집계뿐이다(원본이 365일 뒤 사라져도 수치가 남아야 해서).
grant select on
  daddys_craft.daily_traffic,
  daddys_craft.daily_channel,
  daddys_craft.daily_game
  to service_role;

grant execute on function
  daddys_craft.record_event(date, text, text, text, text, text, text, text,
                            text, text, text, text, text, text),
  daddys_craft.rollup_daily(date, date)
  to service_role;

revoke all on all functions in schema daddys_craft from anon, authenticated;
