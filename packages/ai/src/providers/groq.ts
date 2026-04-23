import type { AiProvider, AiProviderConfig } from '@introspect/core-types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

function buildBody(model: string, messages: GroqMessage[], stream: boolean) {
  return JSON.stringify({
    model,
    messages,
    temperature: 0.3,
    max_tokens: 4096,
    stream,
  });
}

export function createGroqProvider(config: AiProviderConfig): AiProvider {
  const model = config.model || 'llama-3.3-70b-versatile';

  return {
    name: 'groq',

    async chat(systemPrompt: string, userPrompt: string): Promise<string> {
      const messages: GroqMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: buildHeaders(config.apiKey),
        body: buildBody(model, messages, false),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error (${response.status}): ${error}`);
      }

      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content?.trim() || '';
    },

    async *chatStream(systemPrompt: string, userPrompt: string): AsyncIterable<string> {
      const messages: GroqMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: buildHeaders(config.apiKey),
        body: buildBody(model, messages, true),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Groq API error (${response.status}): ${error}`);
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
