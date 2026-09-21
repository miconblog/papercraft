'use client';

import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PAGE_SIZES } from '@/lib/blog/adminListView';

type Props = {
  /** 화면 읽기 도구가 읽을 이름 — 초안·발행 중 어느 쪽 것인지. */
  label: string;
  value: number;
  /** 크기마다 갈 주소. 서버가 만들어 준다 — 여기서 주소를 조립하지 않는다. */
  hrefs: Record<string, string>;
};

const ITEMS = PAGE_SIZES.map((size) => ({
  value: String(size),
  label: `${size}개씩`,
}));

/** 한 쪽에 몇 개 보일지 고른다. 고르면 그 섹션은 1쪽으로 돌아간다. */
export function PageSizeSelect({ label, value, hrefs }: Props) {
  const router = useRouter();

  return (
    <Select
      value={String(value)}
      onValueChange={(next) => {
        const href = next !== null ? hrefs[next] : undefined;
        if (href) router.push(href, { scroll: false });
      }}
      items={ITEMS}
    >
      <SelectTrigger size="sm" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
