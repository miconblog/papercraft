/**
 * 인쇄 가능 영역 탐침 시트 내려받기 (IDE-007)
 *
 * 인쇄 불가 여백은 프린터마다 다르고, 사람이 실제로 뽑아 봐야만 알 수 있다.
 * 기본값 6mm를 쓰는 사람은 손해를 볼 수도 있어(더 좁은 프린터인데 한 장을 더
 * 뽑는다) 재는 수단을 함께 낸다 — `docs/print-spec.md` §4.
 */
import { probeDocument } from '@/lib/print/probe';
import {
  DEFAULT_PRINTER_MARGIN_MM,
  MAX_PRINTER_MARGIN_MM,
  MIN_PRINTER_MARGIN_MM,
} from '@/lib/print/geometry';
import { contentDisposition } from '@/lib/print/filename';
import { renderPdf } from '@/lib/print/pdf';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get('margin'));
  const currentMarginMm =
    Number.isFinite(raw) &&
    raw >= MIN_PRINTER_MARGIN_MM &&
    raw <= MAX_PRINTER_MARGIN_MM
      ? raw
      : DEFAULT_PRINTER_MARGIN_MM;

  const pdf = await renderPdf(probeDocument({ currentMarginMm }));
  return new Response(pdf as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition('printer-margin-probe.pdf'),
      'Content-Length': String(pdf.length),
      'Cache-Control': 'no-store',
    },
  });
}
