/**
 * 나가도 되는 주소인가 (IDE-046)
 *
 * 멘션을 받으면 **남이 적어 보낸 주소로 우리 서버가 요청을 건다** — 그 글이
 * 정말 우리를 가리키는지 봐야 하니까. 그 주소가 `http://169.254.169.254/` 나
 * `http://localhost:5432/` 면 우리 서버가 바깥사람 대신 안쪽을 두드리게 된다
 * (SSRF). 보낼 때도 같다 — 받는 주소는 남의 글이 알려 준 값이다.
 *
 * 그래서 밖으로 나가는 요청은 전부 여기를 지난다. **세상에 열린 주소만**
 * 통과한다.
 *
 * 범위는 손으로 비트를 따지지 않고 Node 의 `BlockList` 에 맡긴다. `::ffff:` 로
 * 감싼 IPv4 도 그쪽이 풀어서 본다.
 */
import { BlockList, isIP } from 'node:net';

/** IPv4 — 사설 · 루프백 · 링크 로컬 · 문서용 · 멀티캐스트 · 예약. */
const V4: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // 통신사 NAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // 링크 로컬 — 클라우드 메타데이터가 여기 산다
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

/**
 * IPv6 — 위와 같은 것들에 **IPv4 를 품은 주소**를 더한다.
 *
 * `64:ff9b::` · `2002::` · `2001::` 는 안에 IPv4 가 들어 있어서, 겉만 보면 열린
 * 주소인데 닿는 곳은 사설망일 수 있다. 품은 주소를 꺼내 다시 따지는 대신
 * **통째로 막는다** — 블로그가 그런 주소에 살 일이 없다.
 *
 * **`::ffff:0:0/96` 은 여기 적지 않는다.** `BlockList` 는 IPv4 를 그 범위 안의
 * 주소로 보기 때문에, 적는 순간 IPv4 가 전부 막힌다. 감싼 주소
 * (`::ffff:10.0.0.1`)는 적지 않아도 위의 IPv4 규칙으로 따진다 — 시험이 둘 다
 * 지킨다.
 */
const V6: ReadonlyArray<readonly [string, number]> = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];

const blocked = new BlockList();
for (const [net, prefix] of V4) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of V6) blocked.addSubnet(net, prefix, 'ipv6');

/**
 * 세상에 열린 IP 인가. **IP 가 아니면 `false` 다** — 이름은 여기 오기 전에
 * 풀려 있어야 한다. 모르는 모양을 통과시키는 쪽으로 틀리면 안 된다.
 */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  return !blocked.check(address, family === 6 ? 'ipv6' : 'ipv4');
}
