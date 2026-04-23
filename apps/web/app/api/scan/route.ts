import { NextRequest, NextResponse } from 'next/server';
import { scan } from '@introspect/scanner';
import type { ScanRequest } from '@introspect/core-types';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    // ZIP upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }
      const buffer = await file.arrayBuffer();
      const scanRequest: ScanRequest = {
        source: { type: 'zip', buffer },
        mode: 'quick',
      };
      const result = await scan(scanRequest);
      return NextResponse.json(result);
    }

    // JSON body — GitHub URL
    const body = await request.json();
    const { repoUrl } = body;

    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 });
    }

    const scanRequest: ScanRequest = {
      source: { type: 'github', url: repoUrl, token: process.env.GITHUB_TOKEN },
      mode: 'quick',
    };

    const result = await scan(scanRequest);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
