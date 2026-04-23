import { NextRequest } from 'next/server';
import { liveScan } from '@introspect/scanner';

export const maxDuration = 120;

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('target');

  if (!target || typeof target !== 'string') {
    return new Response(
      JSON.stringify({ error: 'target query param is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try { controller.enqueue(encoder.encode(sseEvent(event, data))); } catch {}
      };

      try {
        const result = await liveScan(target, (step) => {
          send('step', { step });
        });
        send('complete', { result });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Live scan failed';
        send('error', { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
