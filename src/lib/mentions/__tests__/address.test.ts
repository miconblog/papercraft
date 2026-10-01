/**
 * 나가도 되는 주소인가 (IDE-046)
 *
 * 멘션은 남이 적어 준 주소로 우리 서버가 요청을 건다. 여기가 뚫리면 바깥사람이
 * 우리 서버를 시켜 안쪽을 두드린다 — 그래서 **막는 쪽으로 틀리는 것**을 지킨다.
 */
import { describe, expect, it } from 'vitest';
import { isPublicAddress } from '../address';

describe('isPublicAddress', () => {
  it('세상에 열린 주소는 통과한다', () => {
    for (const address of ['8.8.8.8', '1.1.1.1', '211.249.220.24']) {
      expect(isPublicAddress(address), address).toBe(true);
    }
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });

  it('루프백 · 사설 · 링크 로컬은 막는다', () => {
    for (const address of [
      '127.0.0.1',
      '127.8.8.8',
      '10.0.0.1',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      // 클라우드 메타데이터가 사는 곳이다.
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '255.255.255.255',
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it('사설 대역의 바로 바깥은 열려 있다 — 범위를 넓게 잡아 멀쩡한 곳을 막지 않는다', () => {
    for (const address of ['172.15.255.255', '172.32.0.1', '11.0.0.1']) {
      expect(isPublicAddress(address), address).toBe(true);
    }
  });

  it('IPv6 의 안쪽 주소를 막는다', () => {
    for (const address of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1']) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it('IPv4 를 감싼 IPv6 는 안의 주소로 따진다', () => {
    // 감싸기만 하면 통과한다면 `::ffff:127.0.0.1` 이 루프백으로 가는 뒷문이 된다.
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false);
    expect(isPublicAddress('::ffff:10.0.0.1')).toBe(false);
    expect(isPublicAddress('::ffff:7f00:1')).toBe(false);
    // 반대로 감쌌다는 이유만으로 열린 주소까지 막지는 않는다.
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true);
  });

  it('IPv4 를 품는 변환 대역은 통째로 막는다', () => {
    expect(isPublicAddress('64:ff9b::7f00:1')).toBe(false);
    expect(isPublicAddress('2002:7f00:1::')).toBe(false);
  });

  it('IP 가 아니면 통과시키지 않는다 — 이름은 풀린 뒤에 와야 한다', () => {
    for (const address of ['localhost', 'example.com', '', '999.1.1.1']) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });
});
