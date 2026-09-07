'use client';

/**
 * 공유 링크 만들기 (IDE-013)
 *
 * 어디에 올린 링크가 사람을 데려왔는지 보려면 utm 이 붙어 있어야 한다. 손으로
 * 조립하면 어느 날은 `facebook`, 어느 날은 `fb` 가 되어 **한 채널이 표에서
 * 둘로 쪼개진다.**
 *
 * 만든 링크가 어느 칸에 쌓일지를 그 자리에서 보여 준다 — 수집 쪽과 **같은
 * 함수**로 판정하므로 화면이 거짓말을 할 수 없다.
 */
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  buildShareUrl,
  channelOf,
  SHARE_PRESETS,
} from '@/lib/analytics/shareLinks';

const CUSTOM = 'custom';

const CHANNEL_LABEL: Record<string, string> = {
  direct: '직접 방문',
  organic: '검색',
  social: '소셜',
  referral: '다른 사이트',
  campaign: '캠페인(utm)',
};

export type ShareTarget = { path: string; label: string };

export interface ShareLinkBuilderProps {
  /** 링크의 앞부분. 서버가 정한다 — 미리보기 배포 주소를 공유하면 안 된다. */
  origin: string;
  /** 보낼 수 있는 곳. 게임 등록소에서 오므로 게임이 늘면 여기도 늘어난다. */
  targets: readonly ShareTarget[];
}

const field =
  'mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function ShareLinkBuilder({ origin, targets }: ShareLinkBuilderProps) {
  const ids = useId();
  const [path, setPath] = useState(targets[0]?.path ?? '/');
  const [presetId, setPresetId] = useState<string>(SHARE_PRESETS[0].id);
  const [customSource, setCustomSource] = useState('');
  const [customMedium, setCustomMedium] = useState('social');
  const [campaign, setCampaign] = useState('');
  const [copied, setCopied] = useState(false);

  const isCustom = presetId === CUSTOM;
  const preset = SHARE_PRESETS.find((item) => item.id === presetId);
  const source = isCustom ? customSource : (preset?.source ?? '');
  const medium = isCustom ? customMedium : (preset?.medium ?? '');

  const url = buildShareUrl({ origin, path, source, medium, campaign });
  // utm 이 하나도 안 붙었으면 채널 배지는 거짓말이 된다 — 그때는 안 보여 준다.
  const tagged = url.includes('utm_source=');

  const channelItems = [
    ...SHARE_PRESETS.map((item) => ({ value: item.id, label: item.label })),
    { value: CUSTOM, label: '직접 입력' },
  ];
  const targetItems = targets.map((item) => ({
    value: item.path,
    label: item.label,
  }));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드를 막아 둔 브라우저가 있다. 링크는 아래에 그대로 보이므로
      // 손으로 골라 복사하면 된다 — 실패를 알릴 것까지는 없다.
    }
  };

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">공유 링크 만들기</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        어디에 올린 링크가 사람을 데려왔는지 보려면 utm 이 붙어 있어야 합니다.
        손으로 적으면 같은 채널이 <code>facebook</code> · <code>fb</code> 로
        갈라져 표에서 둘로 쪼개집니다.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${ids}-target`} className="text-sm font-medium">
            어디로 보낼까
          </label>
          <Select
            value={path}
            onValueChange={(value) => value !== null && setPath(value)}
            items={targetItems}
          >
            <SelectTrigger id={`${ids}-target`} className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targetItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor={`${ids}-channel`} className="text-sm font-medium">
            채널
          </label>
          <Select
            value={presetId}
            onValueChange={(value) => value !== null && setPresetId(value)}
            items={channelItems}
          >
            <SelectTrigger id={`${ids}-channel`} className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {channelItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isCustom ? (
          <>
            <div>
              <label htmlFor={`${ids}-source`} className="text-sm font-medium">
                utm_source
              </label>
              <input
                id={`${ids}-source`}
                value={customSource}
                onChange={(event) => setCustomSource(event.target.value)}
                placeholder="threads · 뉴스레터 이름 · qr"
                className={field}
              />
            </div>
            <div>
              <label htmlFor={`${ids}-medium`} className="text-sm font-medium">
                utm_medium
              </label>
              <input
                id={`${ids}-medium`}
                value={customMedium}
                onChange={(event) => setCustomMedium(event.target.value)}
                placeholder="social · email · qr"
                className={field}
              />
            </div>
          </>
        ) : null}

        <div className={isCustom ? 'sm:col-span-2' : ''}>
          <label htmlFor={`${ids}-campaign`} className="text-sm font-medium">
            캠페인 <span className="text-muted-foreground">(선택)</span>
          </label>
          <input
            id={`${ids}-campaign`}
            value={campaign}
            onChange={(event) => setCampaign(event.target.value)}
            placeholder="개학맞이 · 여름방학"
            className={field}
          />
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border p-3">
        <div className="flex items-start gap-2">
          <output
            className="min-w-0 flex-1 font-mono text-xs break-all"
            aria-label="만들어진 공유 링크"
          >
            {url}
          </output>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copy}
            className="shrink-0"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? '복사했어요' : '복사'}
          </Button>
        </div>

        {tagged ? (
          <p className="mt-2 text-xs text-muted-foreground">
            이 링크로 온 방문은 위 표의{' '}
            <strong className="text-foreground">
              {CHANNEL_LABEL[channelOf(url)]}
            </strong>{' '}
            칸에 쌓입니다.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            <code>utm_source</code> 를 채우면 채널이 갈립니다. 비워 두면 그냥
            주소라서 <strong className="text-foreground">직접 방문</strong> 으로
            잡힙니다.
          </p>
        )}
      </div>
    </section>
  );
}
