/**
 * 마이그레이션 적용기 (IDE-013)
 *
 * `db/migrations/NNN-*.sql` 을 번호 순서대로 `psql` 로 적용하고, 적용 이력을
 * `daddys_craft.migrations` 에 남긴다.
 *
 * **Supabase CLI 를 쓰지 않는다.** 이 Postgres 는 다른 서비스와 함께 쓴다 —
 * `supabase db reset` 은 남의 데이터를 통째로 날리고, `supabase db push` 는
 * 이력의 주인이 다른 저장소인 `supabase_migrations` 를 두 저장소가 다투게
 * 만든다.
 *
 *   npm run db:migrate                     적용
 *   npm run db:migrate -- --dry            무엇이 적용될지만 본다
 *   npm run db:migrate -- --redo <파일명>  이미 적용한 파일을 한 번 더 돌린다
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');

/** SQL 문자열에 그대로 끼워 넣으므로 이름 글자를 좁게 잡는다. */
const FILENAME = /^\d{3}-[a-z0-9-]+\.sql$/;

/**
 * 우리 것이 아닌 스키마. 공유 DB 에서 실수 한 번의 대가가 우리 쪽에만 그치지
 * 않아서, 이름을 **언급하기만 해도** 적용을 거부한다. 정교하게 "위험한
 * 문장만" 가려내려 들면 가려내지 못한 한 가지가 사고가 된다.
 *
 * 낱말 경계로 본다 — `authenticated` 롤 이름은 `auth` 에 걸리지 않아야 한다.
 */
const FORBIDDEN = /\b(public|auth|storage)\b/gi;

/** 남의 스키마를 언급하면 그 낱말들을 돌려준다. 비어 있으면 통과다. */
export const forbiddenMentions = (sql: string): string[] => [
  ...new Set((sql.match(FORBIDDEN) ?? []).map((word) => word.toLowerCase())),
];

type Migration = { filename: string; sql: string; checksum: string };

const load = (): Migration[] =>
  readdirSync(MIGRATIONS_DIR)
    .filter((name) => FILENAME.test(name))
    .sort()
    .map((filename) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
      return {
        filename,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex').slice(0, 16),
      };
    });

const psql = (dbUrl: string, args: string[], input?: string): string =>
  execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', ...args], {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'inherit'],
  });

function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error(
      'SUPABASE_DB_URL 이 없다. .env.example 을 .env.local 로 복사하고 값을 채운다.',
    );
    process.exit(1);
  }

  const migrations = load();
  if (migrations.length === 0) {
    console.log('적용할 마이그레이션이 없다.');
    return;
  }

  // 먼저 전부 검사한다. 하나라도 걸리면 한 줄도 적용하지 않는다.
  const violations = migrations.flatMap((m) => {
    const words = forbiddenMentions(m.sql);
    return words.length > 0 ? [`${m.filename}: ${words.join(', ')}`] : [];
  });
  if (violations.length > 0) {
    console.error('우리 스키마 밖을 언급하는 마이그레이션이 있다 — 적용 중단:');
    for (const v of violations) console.error(`  ✗ ${v}`);
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry');

  /**
   * 바깥 상태에 따라 하는 일이 달라지는 파일이 있다 — `002` 는 pg_cron 이
   * 있을 때만 일감을 건다. 나중에 확장을 켜면 그 파일을 **한 번 더** 돌려야
   * 하는데, 이력에 있으면 그냥 건너뛴다.
   *
   * 이력 표에서 줄을 손으로 지우라고 안내하는 것보다 낫다 — 공유 DB 에서
   * `delete` 를 손으로 치게 만드는 안내는 언젠가 `where` 절을 빠뜨린다.
   */
  const redoAt = process.argv.indexOf('--redo');
  const redo = redoAt >= 0 ? process.argv[redoAt + 1] : undefined;
  if (redoAt >= 0 && !migrations.some((m) => m.filename === redo)) {
    console.error(`--redo 에 준 파일이 없다: ${redo ?? '(빈 값)'}`);
    process.exit(1);
  }

  // 이력 표는 001 이 만든다. 첫 적용 때는 아직 없다.
  const historyExists =
    psql(dbUrl, [
      '-Atc',
      "select to_regclass('daddys_craft.migrations') is not null",
    ]).trim() === 't';

  const applied = new Map<string, string>();
  if (historyExists) {
    for (const line of psql(dbUrl, [
      '-Atc',
      'select filename, checksum from daddys_craft.migrations',
    ]).split('\n')) {
      const [filename, checksum] = line.split('|');
      if (filename) applied.set(filename, checksum ?? '');
    }
  }

  // 이미 적용한 파일이 그 뒤로 바뀌었으면 알려 준다. 조용히 넘어가면 DB 와
  // 저장소가 어긋난 채로 굳는다.
  for (const m of migrations) {
    const seen = applied.get(m.filename);
    if (seen && seen !== m.checksum) {
      console.warn(
        `  ⚠︎ ${m.filename} 은 적용 뒤에 내용이 바뀌었다 (DB ${seen} ≠ 파일 ${m.checksum}).\n` +
          '     새 파일로 나누는 편이 낫다 — 이 파일은 다시 적용되지 않는다.',
      );
    }
  }

  const pending = migrations.filter(
    (m) => !applied.has(m.filename) || m.filename === redo,
  );
  if (pending.length === 0) {
    console.log(`이미 최신이다 (적용된 ${applied.size}건).`);
    return;
  }

  for (const m of pending) {
    if (dryRun) {
      console.log(`· ${m.filename} (적용 예정)`);
      continue;
    }
    console.log(`· ${m.filename} 적용 중…`);
    // 한 파일 = 한 트랜잭션. 중간에 실패하면 그 파일은 통째로 되돌아간다.
    psql(
      dbUrl,
      ['-q', '-f', '-'],
      `begin;\n${m.sql}\n` +
        `insert into daddys_craft.migrations (filename, checksum)\n` +
        `values ('${m.filename}', '${m.checksum}')\n` +
        `on conflict (filename) do update set checksum = excluded.checksum;\ncommit;\n`,
    );
    console.log(`  ✓ ${m.filename}`);
  }
  console.log(dryRun ? '검사만 했다.' : `${pending.length}건 적용 완료.`);
}

main();
