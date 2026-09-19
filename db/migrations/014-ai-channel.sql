-- 014 · AI 채널 (IDE-039)
--
-- 사용자 요청(2026-09-19) — "요즘은 AI를 이용해 검색을 많이해서 AI 로 검색
-- 최적화도 하고 싶어." 고치려면 먼저 재야 한다. ChatGPT · Perplexity · Claude
-- 에서 온 방문은 **다른 사이트**에 섞였고, Gemini(`gemini.google.com`)는
-- `google.` 을 품어 **검색**으로 샜다. 여섯째 채널 `ai` 를 연다.
--
-- 판정은 앱이 한다(`lib/analytics/channel.ts`). 여기는 두 가지만 한다.
--
-- 1. 채널 제약에 `ai` 를 더한다 — 앱이 먼저 배포되면 새 값이 제약에 막혀
--    기록이 조용히 실패한다. **이 파일을 앱보다 먼저 적용한다.**
-- 2. 이미 쌓인 줄을 한 번 다시 매긴다. 호스트 목록은 `channel.ts` 의 `AI_HOSTS`
--    와 같다 — SQL 로 옮겨 적은 것은 여기 한 곳뿐이다. 광고(`cpc` 등)는 앱과
--    같이 건드리지 않는다.
--
-- 재실행 가능하다.

alter table daddys_craft.events
  drop constraint if exists events_channel_check;
alter table daddys_craft.events
  add constraint events_channel_check
  check (channel in ('direct', 'organic', 'social', 'referral', 'campaign', 'ai'));

-- ── 이미 쌓인 원본 바로잡기 ──────────────────────────────────────────
with ai_hosts(domain) as (
  values ('chatgpt.com'), ('chat.openai.com'), ('perplexity.ai'), ('claude.ai'),
         ('gemini.google.com'), ('bard.google.com'), ('copilot.microsoft.com'),
         ('chat.deepseek.com'), ('grok.com'), ('meta.ai'), ('chat.mistral.ai'),
         ('you.com'), ('phind.com'), ('poe.com'), ('wrtn.ai'), ('liner.com')
)
update daddys_craft.events e
set channel = 'ai'
where e.channel <> 'ai'
  and coalesce(e.utm_medium, '') !~ '^(cpc|ppc|paid|display|banner|retargeting)'
  and (
    e.utm_source ~ '^(chatgpt(\.com)?|openai|perplexity(\.ai)?|claude(\.ai)?|gemini|copilot|deepseek|grok|meta\.ai|mistral|you\.com|phind|poe|wrtn|liner)$'
    or exists (
      select 1 from ai_hosts h
      where e.utm_source = h.domain or e.utm_source like '%.' || h.domain
    )
    or (
      e.utm_source is null and e.utm_medium is null
      and exists (
        select 1 from ai_hosts h
        where e.referrer_host = h.domain or e.referrer_host like '%.' || h.domain
      )
    )
  );

-- 바로잡은 원본으로 모든 날을 다시 접는다(채널 · 소스 · 퍼널 표).
select daddys_craft.rollup_daily(min(day), max(day)) from daddys_craft.events;
