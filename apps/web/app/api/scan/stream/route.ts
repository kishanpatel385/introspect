import { NextRequest } from 'next/server';
import { scan } from '@introspect/scanner';
import type { ScanRequest } from '@introspect/core-types';

export const maxDuration = 120;

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  const repoUrl = request.nextUrl.searchParams.get('repoUrl');

  if (!repoUrl || typeof repoUrl !== 'string') {
    return new Response(
      JSON.stringify({ error: 'repoUrl query param is required' }),
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
        const token = process.env.GITHUB_TOKEN;
        const scanRequest: ScanRequest = {
          source: { type: 'github', url: repoUrl, token },
          mode: 'quick',
        };

        const result = await scan(scanRequest, (step, meta) => {
          send('step', { step, ...meta });
        });

        send('complete', { result });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Scan failed';
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
