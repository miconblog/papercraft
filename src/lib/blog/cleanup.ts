import 'server-only';

/**
 * 글에서 빠진 사진 파일 치우기 (IDE-028)
 *
 * 사용자 요청(2026-09-10) — "삭제된 채로 저장하면 실제 스토리지에서 삭제된 해당
 * 이미지를 제거해 주면 좋겠어."
 *
 * 파일을 지우는 일은 **되돌릴 수 없다.** 그래서 지워도 되는 것을 좁게 잡는다.
 *
 * 1. **저장이 성공한 뒤에만** 부른다. 실패한 저장 뒤에 지우면 글은 옛 모습인데
 *    사진만 사라진다.
 * 2. **우리 버킷에 우리가 붙인 이름**만 후보가 된다(`pathFromPublicUrl`). 밖에서
 *    가져온 주소나 이름 꼴이 다른 파일은 손대지 않는다.
 * 3. **어느 글도 쓰지 않는 것**만 지운다. 같은 사진을 다른 글이나 대표 사진이 쓸
 *    수 있고, 옛 마크다운 원문이 가리키고 있을 수도 있다(`referencedText`).
 * 4. **글 목록을 못 읽으면 아무것도 지우지 않는다.** 읽기 실패를 "아무도 안
 *    쓴다"로 읽으면 쓰고 있는 사진까지 지운다.
 *
 * 무엇이 후보인지는 부르는 쪽(저장 액션)이 정한다 — 저장 전 글에 있던 사진,
 * 대표 사진, 이 화면에서 올린 사진. **절대 던지지 않는다.** 정리에 실패해도 글은
 * 이미 저장됐다.
 */
import { supabaseConnection } from '@/lib/analytics/config';
import { deleteStoredImages, pathFromPublicUrl } from './images';
import { referencedText } from './posts';

/** 후보 주소 가운데 어느 글도 쓰지 않는 우리 파일을 지운다. 지운 경로를 돌려준다. */
export async function removeUnusedImages(
  candidateUrls: readonly string[],
): Promise<string[]> {
  try {
    const config = supabaseConnection();
    if (!config) return [];

    const paths = [
      ...new Set(
        candidateUrls
          .map((url) => pathFromPublicUrl(url, config.url))
          .filter((path): path is string => path !== null),
      ),
    ];
    if (paths.length === 0) return [];

    const referenced = await referencedText();
    if (referenced === null) {
      console.warn('[blog] 글 목록을 못 읽어 사진 파일을 치우지 않는다');
      return [];
    }

    const unused = paths.filter((path) => !referenced.includes(path));
    if (unused.length === 0) return [];

    return await deleteStoredImages(unused);
  } catch (cause) {
    console.warn('[blog] 사진 파일을 치우지 못했다:', cause);
    return [];
  }
}
