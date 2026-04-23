import type { AiProvider, AiProviderConfig } from '@introspect/core-types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
  };
}

function buildBody(model: string, systemPrompt: string, userPrompt: string, stream: boolean) {
  return JSON.stringify({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    stream,
  });
}

export function createAnthropicProvider(config: AiProviderConfig): AiProvider {
  const model = config.model || 'claude-sonnet-4-20250514';

  return {
    name: 'anthropic',

    async chat(systemPrompt: string, userPrompt: string): Promise<string> {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: buildHeaders(config.apiKey),
        body: buildBody(model, systemPrompt, userPrompt, false),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${error}`);
      }

      const data = await response.json() as { content?: { type: string; text?: string }[] };
      const textBlock = data.content?.find((b) => b.type === 'text');
      return textBlock?.text?.trim() || '';
    },

    async *chatStream(systemPrompt: string, userPrompt: string): AsyncIterable<string> {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: buildHeaders(config.apiKey),
        body: buildBody(model, systemPrompt, userPrompt, true),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);

          try {
            const event = JSON.parse(payload);
            if (event.type === 'content_block_delta' && event.delta?.text) {
              yield event.delta.text;
            }
          } catch {
            // skip non-JSON lines (e.g. event: type lines)
          }
        }
      }
    },
  };
}
