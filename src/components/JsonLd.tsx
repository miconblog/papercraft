import type { JsonLdObject } from '@/lib/structured-data';

/**
 * 구조화 데이터 한 덩이를 `<script type="application/ld+json">` 로 싣는다.
 *
 * 글 제목·요약은 사람이 쓴 문자열이다. `JSON.stringify` 는 `</script>` 를
 * 그대로 두므로 `<` 를 유니코드 이스케이프로 바꿔 태그가 닫히지 않게 한다
 * (Next 문서의 JSON-LD 가이드가 권하는 방법이다).
 *
 * 실행할 코드가 아니라 데이터라서 `next/script` 가 아니라 맨 `<script>` 다.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
