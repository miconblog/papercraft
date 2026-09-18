-- 012 · PDF 다운로드 퍼널 — 편집 시작 · 출력 창 · 내보내기 실패 (IDE-035)
--
-- 2026-09-19 PDF 가 0 이었다. 수집은 멀쩡했다 — 받은 사람이 없었을 뿐이다. 그런데
-- **왜 0 인지에는 답할 수 없었다.** 인쇄는 게임 화면 안의 모달이라, 페이지뷰로는
-- 게임 화면과 다운로드 사이가 통째로 비어 있다.
--
-- 그 사이에 이벤트 셋을 더한다.
--
--   edit_start   값을 처음 바꾼 순간(브라우저가 보낸다)
--   print_open   "출력하기" 창을 연 순간(브라우저가 보낸다)
--   export_fail  내보내기가 400 으로 막힌 순간(서버가 적는다). 사유는 `detail`
--
-- **이 셋은 기존 숫자에 한 줄도 섞이지 않는다.** PV·세션·방문자·PDF 표는 여전히
-- 페이지뷰와 다운로드만 센다 — 30분 넘게 편집하다 창을 열면 그 줄이 새 세션을
-- 여는데, 그걸 세션 수에 넣으면 방문이 한 번 더 온 것처럼 보인다. 퍼널은 따로
-- `daily_funnel` 에 접는다.
--
-- 재실행 가능하다.

-- ── 새 칸 · 새 타입 ──────────────────────────────────────────────────
alter table daddys_craft.events
  -- 짧은 사유 하나. 지금은 `export_fail` 만 쓴다(`customization:<슬롯>` 처럼).
  add column if not exists detail text;

alter table daddys_craft.events drop constraint if exists events_type_check;
alter table daddys_craft.events add constraint events_type_check
  check (type in ('pageview', 'download', 'edit_start', 'print_open', 'export_fail'));

-- ── 퍼널 집계 ────────────────────────────────────────────────────────
-- 세션 하나가 **어느 단계까지 닿았나**를 센다. 줄 수가 아니라 세션 수다 — 편집을
-- 열 번 해도, PDF 를 세 번 받아도 그 세션은 한 번 닿은 것이다.
--
-- `game_id` 가 빈 문자열인 줄이 사이트 전체다. 그 줄의 `sessions` 는 모든
-- 세션이고, 단계는 **어느 게임에서든** 닿은 세션이다. 게임 줄의 `sessions` 는 그
-- 게임에 한 번이라도 닿은 세션이다.
--
-- 기기와 채널은 세션의 것이다 — 기기는 세션에서 처음 보인 값, 채널은 세션 첫
-- 줄의 값(`record_event` 가 뒤 줄에 물려주므로 대개 같다).
create table if not exists daddys_craft.daily_funnel (
  day           date    not null,
  game_id       text    not null default '',
  device        text    not null default '',
  channel       text    not null,
  sessions      integer not null default 0,
  game_views    integer not null default 0,
  edits         integer not null default 0,
  print_opens   integer not null default 0,
  export_fails  integer not null default 0,
  downloads     integer not null default 0,
  primary key (day, game_id, device, channel)
);

alter table daddys_craft.daily_funnel enable row level security;
revoke all on daddys_craft.daily_funnel from anon, authenticated;
grant select on daddys_craft.daily_funnel to service_role;

-- ── 이벤트 기록 ──────────────────────────────────────────────────────
-- 인자가 하나 늘었다. 옛 서명을 먼저 지운다(010 과 같은 이유). 새 인자에 기본값이
-- 있어 이 파일을 먼저 적용하면 그 사이 옛 앱의 호출도 그대로 들어온다.
drop function if exists daddys_craft.record_event(
  date, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, smallint,
  text, text, text, text);

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
  p_bot_reason   text default null,
  p_utm_content  text default null,
  p_utm_term     text default null,
  p_in_app       text default null,
  p_detail       text default null
) returns uuid
language plpgsql
security definer
set search_path = daddys_craft, pg_temp
as $$
declare
  v_last      daddys_craft.events%rowtype;
  v_session   uuid;
  v_repeat    boolean := false;
  v_inherited boolean := false;
begin
  -- 30분 무활동이면 새 세션이다. 직전 줄을 통째로 가져온다 — 세션 id 와 함께
  -- 물려받을 출처도 거기 있다.
  select e.* into v_last
  from daddys_craft.events e
  where e.visitor_id = p_visitor_id
    and e.occurred_at > now() - interval '30 minutes'
  order by e.occurred_at desc
  limit 1;

  v_session := v_last.session_id;

  if v_session is null then
    v_session := gen_random_uuid();
  else
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

    -- 퍼널의 중간 단계는 세션·게임마다 **한 줄이면 된다.** 브라우저도 한 번만
    -- 보내려 하지만 탭을 둘 열면 둘이 서로를 모른다. 여기서 막으면 확실하다.
    -- 실패는 막지 않는다 — 몇 번 막혔는지가 그 자체로 보고 싶은 것이다.
    if p_type in ('edit_start', 'print_open') and exists (
      select 1 from daddys_craft.events e
      where e.session_id = v_session
        and e.type = p_type
        and e.game_id is not distinct from p_game_id
    ) then
      return v_session;
    end if;

    -- 스스로 밝힌 출처가 없으면 세션을 따른다. 직전 줄도 이미 이 규칙을 거쳤으니
    -- 한 줄만 보면 세션의 출처다.
    if p_utm_source is null and p_utm_medium is null
       and p_referrer_host is null then
      p_channel      := v_last.channel;
      p_referrer_host := v_last.referrer_host;
      p_utm_source   := v_last.utm_source;
      p_utm_medium   := v_last.utm_medium;
      p_utm_campaign := v_last.utm_campaign;
      p_utm_content  := v_last.utm_content;
      p_utm_term     := v_last.utm_term;
      v_inherited    := true;
    end if;
  end if;

  insert into daddys_craft.events (
    day, type, session_id, visitor_id, path, game_id, referrer_host,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, channel,
    ua_browser, ua_os, ua_device, country, lang, bot_score, bot_reason,
    repeat_view, in_app, attribution_inherited, detail
  ) values (
    p_day, p_type, v_session, p_visitor_id, p_path, p_game_id, p_referrer_host,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term,
    p_channel,
    p_ua_browser, p_ua_os, p_ua_device, p_country, p_lang,
    coalesce(p_bot_score, 0), p_bot_reason, v_repeat, p_in_app, v_inherited,
    left(p_detail, 200)
  );

  return v_session;
end;
$$;

-- ── 집계 갱신 ────────────────────────────────────────────────────────
-- 011 의 본문에서 둘이 바뀌었다. 기존 표는 전부 `type in ('pageview', 'download')`
-- 로 거르고(위 머리말), `daily_funnel` 한 덩이를 더했다.
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
    and e.type in ('pageview', 'download')
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
    and e.type in ('pageview', 'download')
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
    and e.type in ('pageview', 'download')
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
    and e.type in ('pageview', 'download')
  group by 1, 2;

  delete from daddys_craft.daily_game where day = any(v_days);
  insert into daddys_craft.daily_game (day, game_id, views, downloads)
  select e.day, e.game_id,
         count(*) filter (where e.type = 'pageview' and not e.repeat_view),
         count(*) filter (where e.type = 'download')
  from daddys_craft.events e
  where e.day = any(v_days) and e.game_id is not null
    and e.bot_score < p_bot_threshold
    and e.type in ('pageview', 'download')
  group by e.day, e.game_id;

  -- 퍼널. 세션마다 기기·채널을 한 번 정하고(s), 세션×게임마다 닿은 단계를
  -- 표시한 뒤(g), 게임 줄과 사이트 전체 줄(`game_id = ''`)로 접는다.
  --
  -- "게임 화면"은 만들기 화면(`/games/<id>`)과 옛 인쇄 화면(`/games/<id>/print`)
  -- 이다. 규칙 화면은 도안을 만지는 자리가 아니라 넣지 않는다.
  delete from daddys_craft.daily_funnel where day = any(v_days);
  insert into daddys_craft.daily_funnel (
    day, game_id, device, channel,
    sessions, game_views, edits, print_opens, export_fails, downloads
  )
  with s as (
    select e.day, e.session_id,
           coalesce((array_agg(e.ua_device order by e.occurred_at)
                     filter (where e.ua_device is not null))[1], '') as device,
           (array_agg(e.channel order by e.occurred_at))[1] as channel
    from daddys_craft.events e
    where e.day = any(v_days) and e.bot_score < p_bot_threshold
    group by e.day, e.session_id
  ),
  g as (
    select e.day, e.session_id, e.game_id,
           bool_or(e.type = 'pageview'
                   and e.path ~ '^/games/[^/]+(/print)?$') as viewed,
           bool_or(e.type = 'edit_start')  as edited,
           bool_or(e.type = 'print_open')  as opened,
           bool_or(e.type = 'export_fail') as failed,
           bool_or(e.type = 'download')    as downloaded
    from daddys_craft.events e
    where e.day = any(v_days) and e.bot_score < p_bot_threshold
      and e.game_id is not null
    group by e.day, e.session_id, e.game_id
  ),
  per_session as (
    select s.day, s.session_id, s.device, s.channel,
           coalesce(bool_or(g.viewed), false)     as viewed,
           coalesce(bool_or(g.edited), false)     as edited,
           coalesce(bool_or(g.opened), false)     as opened,
           coalesce(bool_or(g.failed), false)     as failed,
           coalesce(bool_or(g.downloaded), false) as downloaded
    from s
    left join g on g.day = s.day and g.session_id = s.session_id
    group by s.day, s.session_id, s.device, s.channel
  )
  select day, '', device, channel,
         count(*),
         count(*) filter (where viewed),
         count(*) filter (where edited),
         count(*) filter (where opened),
         count(*) filter (where failed),
         count(*) filter (where downloaded)
  from per_session
  group by day, device, channel
  union all
  select g.day, g.game_id, s.device, s.channel,
         count(*),
         count(*) filter (where g.viewed),
         count(*) filter (where g.edited),
         count(*) filter (where g.opened),
         count(*) filter (where g.failed),
         count(*) filter (where g.downloaded)
  from g
  join s on s.day = g.day and s.session_id = g.session_id
  group by g.day, g.game_id, s.device, s.channel;
end;
$$;

-- ── 다시 여는 권한 ───────────────────────────────────────────────────
grant execute on function
  daddys_craft.record_event(date, text, text, text, text, text, text, text,
                            text, text, text, text, text, text, text, smallint,
                            text, text, text, text, text)
  to service_role;

revoke all on all functions in schema daddys_craft from anon, authenticated;

-- ── 이미 쌓인 원본으로 채우기 ────────────────────────────────────────
-- 지난 날은 게임 화면과 다운로드 두 단계만 채워진다 — 중간 단계는 이제부터 쌓인다.
select daddys_craft.rollup_daily(min(day), max(day)) from daddys_craft.events;
