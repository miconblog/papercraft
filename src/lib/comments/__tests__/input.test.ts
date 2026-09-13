/**
 * 댓글 입력 다듬기 (IDE-029)
 *
 * 지키는 것이 넷이다. **보이지 않는 글자는 남지 않는다** · **빈 댓글은 거절한다**
 * · **길이는 다듬은 뒤에 센다** · **이름은 비워도 된다**.
 */
import { describe, expect, it } from 'vitest';
import {
  ANONYMOUS_NICKNAME,
  BODY_MAX,
  NICKNAME_MAX,
  parseCommentInput,
} from '../input';

const ok = (nickname: string, body: string) => {
  const result = parseCommentInput({ nickname, body });
  if (!result.ok) throw new Error(`거절당했다: ${result.message}`);
  return result.value;
};

const rejected = (nickname: string, body: string) => {
  const result = parseCommentInput({ nickname, body });
  if (result.ok) throw new Error('통과했다');
  return result.message;
};

describe('본문', () => {
  it('공백뿐이면 거절한다', () => {
    expect(rejected('아빠', '   \n\n  ')).toContain('내용');
  });

  it('폭이 없는 글자만 채운 것도 빈 댓글이다', () => {
    // 사람 눈에는 빈칸인데 길이 검사는 통과하던 값이다.
    expect(rejected('아빠', '\u200B\u200B\uFEFF')).toContain('내용');
  });

  it('글자를 뒤집는 표식을 버린다', () => {
    // `U+202E` 가 남아 있으면 뒤 글자가 거꾸로 보인다.
    expect(ok('아빠', '축구\u202E판').body).toBe('축구판');
  });

  it('줄바꿈은 살리고 빈 줄이 셋 이상이면 둘로 접는다', () => {
    expect(ok('아빠', '첫 줄\n\n\n\n\n끝 줄').body).toBe('첫 줄\n\n끝 줄');
  });

  it('줄 끝 공백과 앞뒤 공백을 뗀다', () => {
    expect(ok('아빠', '  잘 만들었어요   \n  고마워요  ').body).toBe(
      '잘 만들었어요\n  고마워요',
    );
  });

  it('윈도 줄바꿈을 한 줄로 읽는다', () => {
    expect(ok('아빠', '가\r\n나').body).toBe('가\n나');
  });

  it('길이는 다듬은 뒤에 센다 — 공백까지 세어 거절하지 않는다', () => {
    const body = `${' '.repeat(50)}${'가'.repeat(BODY_MAX)}${' '.repeat(50)}`;
    expect(ok('아빠', body).body).toHaveLength(BODY_MAX);
    expect(rejected('아빠', '가'.repeat(BODY_MAX + 1))).toContain(
      String(BODY_MAX),
    );
  });
});

describe('이름', () => {
  it('비우면 «이름 없음» 이다 — 익명 자리에서 이름을 강제하지 않는다', () => {
    expect(ok('', '고마워요').nickname).toBe(ANONYMOUS_NICKNAME);
    expect(ok('   ', '고마워요').nickname).toBe(ANONYMOUS_NICKNAME);
  });

  it('한 줄로 눕힌다 — 줄바꿈이 들어오면 목록 배치가 깨진다', () => {
    expect(ok('아빠\n\n뭐해', '고마워요').nickname).toBe('아빠 뭐해');
  });

  it('너무 길면 거절한다 — 잘라 넣지 않는다', () => {
    // 조용히 자르면 쓴 사람이 자기 이름이 바뀐 것을 나중에 안다.
    expect(rejected('가'.repeat(NICKNAME_MAX + 1), '고마워요')).toContain(
      String(NICKNAME_MAX),
    );
  });
});

describe('서식을 해석하지 않는다', () => {
  it('태그와 마크다운을 글자 그대로 담는다', () => {
    const body = '<script>alert(1)</script> **굵게**';
    expect(ok('아빠', body).body).toBe(body);
  });
});
