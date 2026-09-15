'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PartGroup } from '@/lib/games/format';

/**
 * 파트 묶음 하나를 고르는 셀렉트 (IDE-030)
 *
 * 만들기 화면의 파트 줄은 파트마다 단추 하나다. 골프는 홀 판이 열여덟 장이라
 * 그 단추가 벽이 되었고, 사용자가 셀렉트로 바꿔 달라고 했다(2026-09-15).
 * 같은 `series`를 단 파트가 여기로 접힌다.
 *
 * **접히는 것은 화면뿐이다.** 인쇄 화면은 여전히 파트마다 한 줄이라 열여덟
 * 장을 한 번에 뽑을 수 있다 — 묶음은 고르는 편의이지 인쇄 단위가 아니다.
 *
 * 묶음이 지금 보고 있는 파트를 갖고 있지 않아도 셀렉트는 **첫 파트를 보여
 * 준다.** 빈칸을 두면 무엇을 고를 수 있는 자리인지 알 수 없고, 고르면 그때
 * 그 파트로 넘어간다.
 */
export function PartSeriesSelect({
  group,
  currentPartId,
  onSelect,
}: {
  group: PartGroup;
  currentPartId: string;
  onSelect: (partId: string) => void;
}) {
  const active = group.parts.some((part) => part.id === currentPartId);
  const value = active ? currentPartId : group.parts[0].id;

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        // 단일 선택이라 실제로는 null이 오지 않는다 — 값이 온 경우만 반영한다.
        if (next !== null) onSelect(String(next));
      }}
      items={group.parts.map((part) => ({
        value: part.id,
        label: part.title,
      }))}
    >
      <SelectTrigger
        size="sm"
        aria-label={`${group.label} 고르기`}
        // 단추 줄에 섞이므로 알약 모양과 글자 크기를 단추에 맞춘다. 지금 보고
        // 있는 파트가 이 묶음 안이면 단추와 같은 방식으로 눌린 티를 낸다.
        className={
          'rounded-full text-xs ' +
          (active
            ? 'border-primary bg-primary text-primary-foreground'
            : 'hover:border-primary')
        }
      >
        <SelectValue />
      </SelectTrigger>
      {/* 팝업은 **내용 폭**으로 편다. 기본값이 트리거 폭(`w-(--anchor-width)`)에
          가로 넘침을 자르는 것이라, 트리거보다 긴 제목이 오른쪽에서 잘렸다 —
          "15번 홀 · 짧고 야무지게 (파 3)"가 "(파"에서 끊겼다(2026-09-15 사용자
          제보). 트리거 폭은 하한으로만 남긴다. */}
      <SelectContent className="w-auto min-w-(--anchor-width)">
        {group.parts.map((part) => (
          <SelectItem key={part.id} value={part.id}>
            {part.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
