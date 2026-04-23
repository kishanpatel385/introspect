import type { AiProvider, AiProviderConfig } from '@introspect/core-types';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAiChoice {
  message: { content: string };
  delta?: { content?: string };
}

function buildBody(model: string, messages: OpenAiMessage[], stream: boolean) {
  return JSON.stringify({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 4096,
    stream,
  });
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

export function createOpenAiProvider(config: AiProviderConfig): AiProvider {
  const model = config.model || 'gpt-4o';

  return {
    name: 'openai',

    async chat(systemPrompt: string, userPrompt: string): Promise<string> {
      const messages: OpenAiMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: buildHeaders(config.apiKey),
        body: buildBody(model, messages, false),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${error}`);
      }

      const data = await response.json() as { choices?: OpenAiChoice[] };
      const choice = data.choices?.[0];
      return choice?.message?.content?.trim() || '';
    },

    async *chatStream(systemPrompt: string, userPrompt: string): AsyncIterable<string> {
      const messages: OpenAiMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: buildHeaders(config.apiKey),
        body: buildBody(model, messages, true),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${error}`);
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
          if (payload === '[DONE]') return;

          try {
            const chunk = JSON.parse(payload);
            const content = chunk.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // skip malformed JSON chunks
          }
        }
      }
    },
  };
}
