-- 002 · 일 1회 정리 일감 걸기 (IDE-013)
--
-- 이 파일만 daddys_craft 밖을 스친다 — pg_cron 의 일감 표에 우리 이름의 줄을
-- 하나 넣는다. 객체를 만들지도 남의 일감을 건드리지도 않는다.
--
-- **확장을 켜지는 않는다.** create extension 은 공유 프로젝트 전체에 걸리는
-- 변경이라 우리가 결정할 일이 아니다. pg_cron 이 아직 없으면 알림만 남기고
-- 넘어가고, 그동안은 daddys_craft.run_daily_maintenance() 를 밖에서 부르면
-- 된다(대시보드도 열 때마다 최근 사흘을 다시 집계한다).

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice
      'pg_cron 이 없어 정리 일감을 걸지 않았다. 켠 뒤 이 파일을 다시 적용하면 된다.';
    return;
  end if;

  -- 이름이 같은 우리 일감만 지우고 다시 건다. 몇 번을 돌려도 결과가 같다.
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'daddys_craft_daily_maintenance';

  -- 매일 15:10 UTC = KST 자정 10분 뒤. 그날치가 다 들어온 뒤에 돈다.
  perform cron.schedule(
    'daddys_craft_daily_maintenance',
    '10 15 * * *',
    'select daddys_craft.run_daily_maintenance()'
  );
end;
$$;
