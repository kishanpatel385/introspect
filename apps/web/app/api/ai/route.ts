import { NextRequest, NextResponse } from 'next/server';
import {
  createProvider,
  generateNarrativeReport,
  generateCodeReview,
  generateShadowCtoAdvice,
  generateBlameTherapy,
  generateMigrationPlan,
  generateOnboardingGuide,
  generateReleaseNotes,
  generateChatResponse,
  generatePrSummary,
  generateCodeDna,
  generateInterviewQuestions,
  generatePostmortem,
} from '@introspect/ai';
import type { ChatMessage } from '@introspect/ai';
import type { AiProviderName, ScanResult, Issue } from '@introspect/core-types';

export const maxDuration = 60;

const VALID_ACTIONS = [
  'narrative', 'review', 'shadow-cto', 'blame-therapy',
  'migration-plan', 'onboarding-guide', 'release-notes',
  'chat', 'pr-summary', 'code-dna', 'interview-questions', 'postmortem',
] as const;

type AiAction = typeof VALID_ACTIONS[number];

interface AiRequestBase {
  apiKey: string;
  provider: AiProviderName;
  model?: string;
  action: AiAction;
}

interface NarrativeRequest extends AiRequestBase {
  action: 'narrative';
  scanResult: ScanResult;
}

interface ReviewRequest extends AiRequestBase {
  action: 'review';
  file: { path: string; content: string };
  issues: Issue[];
}

interface ShadowCtoRequest extends AiRequestBase {
  action: 'shadow-cto';
  scanResult: ScanResult;
}

interface BlameTherapyRequest extends AiRequestBase {
  action: 'blame-therapy';
  file: { path: string; content: string };
  issues: Issue[];
}

interface MigrationPlanRequest extends AiRequestBase {
  action: 'migration-plan';
  scanResult: ScanResult;
  targetFramework: string;
}

interface OnboardingGuideRequest extends AiRequestBase {
  action: 'onboarding-guide';
  scanResult: ScanResult;
}

interface ReleaseNotesRequest extends AiRequestBase {
  action: 'release-notes';
  scanResult: ScanResult;
}

interface ChatRequest extends AiRequestBase {
  action: 'chat';
  scanResult: ScanResult;
  message: string;
  history?: ChatMessage[];
}

interface PrSummaryRequest extends AiRequestBase {
  action: 'pr-summary';
  scanResult: ScanResult;
}

interface CodeDnaRequest extends AiRequestBase {
  action: 'code-dna';
  scanResult: ScanResult;
}

interface InterviewQuestionsRequest extends AiRequestBase {
  action: 'interview-questions';
  scanResult: ScanResult;
}

interface PostmortemRequest extends AiRequestBase {
  action: 'postmortem';
  scanResult: ScanResult;
}

type AiRequest =
  | NarrativeRequest
  | ReviewRequest
  | ShadowCtoRequest
  | BlameTherapyRequest
  | MigrationPlanRequest
  | OnboardingGuideRequest
  | ReleaseNotesRequest
  | ChatRequest
  | PrSummaryRequest
  | CodeDnaRequest
  | InterviewQuestionsRequest
  | PostmortemRequest;

function validateBase(body: unknown): body is AiRequestBase {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.apiKey === 'string' &&
    b.apiKey.length > 0 &&
    typeof b.provider === 'string' &&
    ['openai', 'anthropic', 'groq'].includes(b.provider) &&
    typeof b.action === 'string' &&
    (VALID_ACTIONS as readonly string[]).includes(b.action)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AiRequest;

    if (!validateBase(body)) {
      return NextResponse.json(
        { error: `Invalid request. Required: apiKey, provider (openai|anthropic|groq), action (${VALID_ACTIONS.join('|')})` },
        { status: 400 },
      );
    }

    const provider = createProvider({
      name: body.provider,
      apiKey: body.apiKey,
      model: body.model,
    });

    switch (body.action) {
      case 'narrative': {
        if (!body.scanResult) {
          return NextResponse.json({ error: 'scanResult is required for narrative action' }, { status: 400 });
        }
        const report = await generateNarrativeReport(provider, body.scanResult);
        return NextResponse.json({ result: report });
      }

      case 'review': {
        if (!body.file?.content || !body.file?.path) {
          return NextResponse.json({ error: 'file.path and file.content are required for review action' }, { status: 400 });
        }
        const review = await generateCodeReview(provider, body.file.content, body.file.path, body.issues || []);
        return NextResponse.json({ result: review });
      }

      case 'shadow-cto': {
        if (!body.scanResult) {
          return NextResponse.json({ error: 'scanResult is required for shadow-cto action' }, { status: 400 });
        }
        const advice = await generateShadowCtoAdvice(provider, body.scanResult);
        return NextResponse.json({ result: advice });
      }

      case 'blame-therapy': {
        if (!body.file?.content || !body.file?.path) {
          return NextResponse.json({ error: 'file.path and file.content are required for blame-therapy action' }, { status: 400 });
        }
        const therapy = await generateBlameTherapy(provider, body.file.content, body.file.path, body.issues || []);
        return NextResponse.json({ result: therapy });
      }

      case 'migration-plan': {
        if (!body.scanResult || !body.targetFramework) {
          return NextResponse.json({ error: 'scanResult and targetFramework are required for migration-plan action' }, { status: 400 });
        }
        const plan = await generateMigrationPlan(provider, body.scanResult, body.targetFramework);
        return NextResponse.json({ result: plan });
      }

      case 'onboarding-guide': {
        if (!body.scanResult) {
          return NextResponse.json({ error: 'scanResult is required for onboarding-guide action' }, { status: 400 });
        }
        const guide = await generateOnboardingGuide(provider, body.scanResult);
        return NextResponse.json({ result: guide });
      }

      case 'release-notes': {
        if (!body.scanResult) {
          return NextResponse.json({ error: 'scanResult is required for release-notes action' }, { status: 400 });
        }
        const notes = await generateReleaseNotes(provider, body.scanResult);
        return NextResponse.json({ result: notes });
      }

      case 'chat': {
        if (!body.scanResult || !body.message) {
          return NextResponse.json({ error: 'scanResult and message are required for chat action' }, { status: 400 });
        }
        const chatResponse = await generateChatResponse(provider, body.scanResult, body.message, body.history);
        return NextResponse.json({ result: chatResponse });
      }

      case 'pr-summary': {
        if (!body.scanResult) {
          return NextResponse.json({ error: 'scanResult is required for pr-summary action' }, { status: 400 });
        }
        const prSummary = await generatePrSummary(provider, body.scanResult);
        return NextResponse.json({ result: prSummary });
      }

      case 'code-dna': {
        if (!body.scanResult) {
          return NextResponse.json({ error: 'scanResult is required for code-dna action' }, { status: 400 });
        }
        const dna = await generateCodeDna(provider, body.scanResult);
        return NextResponse.json({ result: dna });
      }

      case 'interview-questions': {
        if (!body.scanResult) {
          return NextResponse.json({ error: 'scanResult is required for interview-questions action' }, { status: 400 });
        }
        const questions = await generateInterviewQuestions(provider, body.scanResult);
        return NextResponse.json({ result: questions });
      }

      case 'postmortem': {
        if (!body.scanResult) {
          return NextResponse.json({ error: 'scanResult is required for postmortem action' }, { status: 400 });
        }
        const postmortem = await generatePostmortem(provider, body.scanResult);
        return NextResponse.json({ result: postmortem });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
