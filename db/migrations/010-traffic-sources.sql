-- 010 · 유입 출처 — 세션 귀속 · 소스별 집계 · 인앱 브라우저 (IDE-033)
--
-- 001 부터 utm 과 referrer 호스트를 **저장은 해 왔다.** 그런데 대시보드는 다섯
-- 갈래 합계만 보여 줬고, 그 합계마저 틀려 있었다(2026-09-17 원본으로 확인).
--
-- 1. **세션이 쪼개진다.** utm 은 첫 화면 주소에만 붙어 있다. 사이트 안에서
--    옮겨 가면 주소에서 사라지고 referrer 도 비므로, 페이스북으로 들어와 일곱
--    화면을 본 세션이 "소셜 1 + 직접 6"으로 잡혔다. 그래서 **utm 도 외부
--    referrer 도 없는 줄은 같은 세션의 직전 줄에서 출처를 물려받는다.** 새
--    출처(다른 utm·외부 referrer)가 오면 그때부터는 그쪽이다 — 웹 분석에서
--    last non-direct click 이라 부르는 규칙이다.
-- 2. **소스별 표가 없다.** `daily_source` 를 만든다. 채널 안에서 페이스북과
--    네이버 카페가, 캠페인끼리가 갈려 보인다.
-- 3. **인앱 브라우저가 사라진다.** 카카오톡 안에서 누른 링크는 referrer 없이
--    온다. UA 에서 앱 이름만 뽑아 `in_app` 에 남긴다(UA 원본은 여전히 안 남긴다).
--
-- 재실행 가능하다.

-- ── 새 칸 ────────────────────────────────────────────────────────────
alter table daddys_craft.events
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  -- `kakaotalk` · `instagram` 같은 앱 이름 하나. 일반 브라우저면 비어 있다.
  add column if not exists in_app text,
  -- 출처 칸을 세션의 직전 줄에서 물려받았나. 원본에서 무엇이 스스로 밝힌
  -- 출처이고 무엇이 이어받은 것인지 가려 볼 수 있어야 규칙을 감사할 수 있다.
  add column if not exists attribution_inherited boolean not null default false;

-- ── 소스별 집계 ──────────────────────────────────────────────────────
-- `source` 는 utm_source → referrer 호스트 → `app:<앱>` 순서로 채운다. 기본키에
-- 들어가므로 비어 있으면 null 이 아니라 빈 문자열이다.
create table if not exists daddys_craft.daily_source (
  day        date    not null,
  channel    text    not null,
  source     text    not null default '',
  medium     text    not null default '',
  campaign   text    not null default '',
  pageviews  integer not null default 0,
  visitors   integer not null default 0,
  sessions   integer not null default 0,
  downloads  integer not null default 0,
  primary key (day, channel, source, medium, campaign)
);

-- 어느 채널이 **도안을 받게 했는지**가 이 사이트에서 가장 궁금한 것이다.
alter table daddys_craft.daily_channel
  add column if not exists downloads integer not null default 0;

alter table daddys_craft.daily_source enable row level security;
revoke all on daddys_craft.daily_source from anon, authenticated;
grant select on daddys_craft.daily_source to service_role;

-- ── 이벤트 기록 ──────────────────────────────────────────────────────
-- 인자가 셋 늘었다. 옛 서명을 먼저 지운다(003 과 같은 이유).
--
-- 새 인자는 전부 기본값이 있다 — PostgREST 는 이름으로 부르므로, 이 파일을 먼저
-- 적용하고 앱을 나중에 배포해도 그 사이 옛 앱의 호출이 그대로 들어온다.
drop function if exists daddys_craft.record_event(
  date, text, text, text, text, text, text, text,
  text, text, text, text, text, text, text, smallint, text);

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
  p_in_app       text default null
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
    repeat_view, in_app, attribution_inherited
  ) values (
    p_day, p_type, v_session, p_visitor_id, p_path, p_game_id, p_referrer_host,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term,
    p_channel,
    p_ua_browser, p_ua_os, p_ua_device, p_country, p_lang,
    coalesce(p_bot_score, 0), p_bot_reason, v_repeat, p_in_app, v_inherited
  );

  return v_session;
end;
$$;

-- ── 집계 갱신 ────────────────────────────────────────────────────────
-- 서명이 그대로라 권한을 다시 열 것이 없다. 더한 것은 `daily_channel.downloads`
-- 와 `daily_source` 둘이다.
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

-- ── 다시 여는 권한 ───────────────────────────────────────────────────
grant execute on function
  daddys_craft.record_event(date, text, text, text, text, text, text, text,
                            text, text, text, text, text, text, text, smallint,
                            text, text, text, text)
  to service_role;

revoke all on all functions in schema daddys_craft from anon, authenticated;

-- ── 이미 쌓인 원본 바로잡기 ──────────────────────────────────────────
-- 한 번만 하는 일이지만 다시 돌려도 결과가 같다.
--
-- (가) 옛 분류가 카페·블로그 utm 을 검색으로 넣은 줄. 새 규칙(`channel.ts` 의
-- SOCIAL_MEDIUM · SOCIAL_SOURCES)과 같은 조건이다. 앱의 규칙을 SQL 로 옮겨 적은
-- 것은 여기 한 곳뿐이고, 새로 들어오는 줄은 앱이 매긴다.
update daddys_craft.events
set channel = 'social'
where channel = 'organic'
  and (utm_medium ~ '^(social|sns|sm$|community|cafe|blog|messenger)'
       or utm_source ~ '(cafe|blog|community)');

-- (나) 세션 귀속. 출처가 없는 줄마다 같은 세션에서 **그보다 앞선 가장 가까운
-- 출처 있는 줄**을 찾아 물려받는다. 앞에 그런 줄이 없으면(직접 들어온 세션)
-- 그대로 둔다. `in_app` 은 UA 원본이 없어 지난 줄에는 채울 수 없다.
update daddys_craft.events e
set (channel, referrer_host, utm_source, utm_medium, utm_campaign,
     utm_content, utm_term, attribution_inherited) = (
  select p.channel, p.referrer_host, p.utm_source, p.utm_medium,
         p.utm_campaign, p.utm_content, p.utm_term, true
  from daddys_craft.events p
  where p.session_id = e.session_id
    and p.occurred_at < e.occurred_at
    and (p.utm_source is not null or p.utm_medium is not null
         or p.referrer_host is not null)
  order by p.occurred_at desc
  limit 1
)
where e.utm_source is null and e.utm_medium is null
  and e.referrer_host is null
  and not e.attribution_inherited
  and exists (
    select 1 from daddys_craft.events p
    where p.session_id = e.session_id
      and p.occurred_at < e.occurred_at
      and (p.utm_source is not null or p.utm_medium is not null
           or p.referrer_host is not null)
  );

-- (다) 바로잡은 원본으로 모든 날을 다시 접는다.
select daddys_craft.rollup_daily(min(day), max(day)) from daddys_craft.events;
