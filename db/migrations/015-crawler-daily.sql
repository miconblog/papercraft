-- 015 · 누가 읽어 가나 — AI · 검색 크롤러 (IDE-040)
--
-- AI 검색에 인용되려면 먼저 읽혀야 한다. 크롤러는 자바스크립트를 돌리지 않아
-- 방문 통계에는 한 줄도 안 남는다 — 문지기(`proxy.ts`)가 UA 를 보고 센다.
--
-- **센 것만 남긴다.** 날짜 · 크롤러 · 경로마다 횟수 하나다. IP 도 UA 원본도
-- 없다(IDE-013 의 원칙). 크롤러 이름은 앱의 목록(`lib/analytics/crawlers.ts`)이
-- 정한다.
--
-- 쓰기는 `record_crawl` 하나로만 — `record_event` 와 같은 이유로 표에 직접 쓰는
-- 권한을 주지 않는다. 서비스 롤 키가 새도 할 수 있는 일이 "횟수 하나 올리기"다.
--
-- 재실행 가능하다.

create table if not exists daddys_craft.crawler_daily (
  day       date        not null,
  crawler   text        not null,
  path      text        not null,
  hits      integer     not null default 0,
  last_seen timestamptz not null default now(),
  primary key (day, crawler, path)
);

alter table daddys_craft.crawler_daily enable row level security;
revoke all on daddys_craft.crawler_daily from anon, authenticated;
grant select on daddys_craft.crawler_daily to service_role;

create or replace function daddys_craft.record_crawl(
  p_day     date,
  p_crawler text,
  p_path    text
) returns void
language sql
security definer
set search_path = daddys_craft, pg_temp
as $$
  insert into daddys_craft.crawler_daily (day, crawler, path, hits, last_seen)
  values (p_day, left(p_crawler, 64), left(p_path, 200), 1, now())
  on conflict (day, crawler, path)
  do update set hits = daddys_craft.crawler_daily.hits + 1,
                last_seen = now();
$$;

revoke all on function daddys_craft.record_crawl(date, text, text) from anon, authenticated;
grant execute on function daddys_craft.record_crawl(date, text, text) to service_role;
