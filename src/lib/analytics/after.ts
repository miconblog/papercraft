/**
 * 응답 뒤로 미루기 (IDE-013)
 *
 * `after` 는 **요청 스코프 밖에서 불리면 던진다.** 응답을 만드는 길목에서
 * 그렇게 되면 분석 하나 때문에 PDF 가 안 나간다 — 수집 실패가 응답을 절대
 * 깨뜨리지 않는다는 약속이 여기서 무너진다.
 *
 * 그래서 감싼다. 스코프가 없으면 그냥 지금 띄워 보내고, 그것마저 실패하면
 * 삼킨다.
 */
import { after } from 'next/server';

export function afterResponse(task: () => Promise<unknown>): void {
  const detached = () => {
    void task().catch((cause) => {
      console.warn('[analytics] 뒤처리 실패:', cause);
    });
  };

  try {
    after(detached);
  } catch {
    detached();
  }
}
