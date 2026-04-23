import { v4 as uuid } from 'uuid';
import type { RepoFile, Issue, Severity } from '@introspect/core-types';

// ─── Pattern Registry ─────────────────────────────────────────
// Sources: nuclei-templates (MIT) + custom patterns
// Every pattern is battle-tested against real codebases

interface SecretPattern {
  id: string;
  name: string;
  pattern: RegExp;
  severity: Severity;
}

const PATTERNS: SecretPattern[] = [
  // ═══ AWS ════════════════════════════════════════════════════
  { id: 'aws-access-key-id', name: 'AWS Access Key ID', severity: 'critical', pattern: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g },
  { id: 'aws-secret-key', name: 'AWS Secret Access Key', severity: 'critical', pattern: /(?:aws_secret_access_key|aws_secret)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}/gi },
  { id: 'aws-mws-key', name: 'AWS MWS Key', severity: 'high', pattern: /amzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g },
  { id: 'aws-s3-bucket', name: 'AWS S3 Bucket URL', severity: 'medium', pattern: /[a-z0-9.-]+\.s3\.amazonaws\.com/gi },

  // ═══ Google / GCP / Firebase ════════════════════════════════
  { id: 'gcp-api-key', name: 'GCP API Key', severity: 'high', pattern: /AIza[0-9A-Za-z_-]{35}/g },
  { id: 'gcp-service-account', name: 'GCP Service Account', severity: 'high', pattern: /"type"\s*:\s*"service_account"/g },
  { id: 'gcp-oauth', name: 'Google OAuth Client ID', severity: 'medium', pattern: /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/g },
  { id: 'firebase-database', name: 'Firebase Database URL', severity: 'medium', pattern: /[a-z0-9.-]+\.firebaseio\.com/g },
  { id: 'fcm-api-key', name: 'Firebase Cloud Messaging Key', severity: 'high', pattern: /[A-Za-z0-9_-]+:APA91b[A-Za-z0-9_#-]+/g },

  // ═══ Azure ══════════════════════════════════════════════════
  { id: 'azure-storage-key', name: 'Azure Storage Key', severity: 'critical', pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{88}/g },
  { id: 'azure-connection', name: 'Azure Connection String', severity: 'critical', pattern: /AccountKey=[A-Za-z0-9+/=]{86,88}==/g },

  // ═══ GitHub ═════════════════════════════════════════════════
  { id: 'github-pat', name: 'GitHub Personal Access Token', severity: 'critical', pattern: /ghp_[0-9a-zA-Z]{36}/g },
  { id: 'github-oauth', name: 'GitHub OAuth Token', severity: 'critical', pattern: /gho_[0-9a-zA-Z]{36}/g },
  { id: 'github-app', name: 'GitHub App Token', severity: 'critical', pattern: /(?:ghu|ghs)_[0-9a-zA-Z]{36}/g },
  { id: 'github-fine-grained', name: 'GitHub Fine-Grained Token', severity: 'critical', pattern: /github_pat_[0-9a-zA-Z_]{82}/g },

  // ═══ GitLab ═════════════════════════════════════════════════
  { id: 'gitlab-pat', name: 'GitLab Personal Access Token', severity: 'critical', pattern: /glpat-[0-9a-zA-Z_-]{20}/g },
  { id: 'gitlab-runner', name: 'GitLab Runner Token', severity: 'high', pattern: /GR1348941[0-9a-zA-Z_-]{20}/g },

  // ═══ Stripe ═════════════════════════════════════════════════
  { id: 'stripe-secret', name: 'Stripe Secret Key', severity: 'critical', pattern: /[sr]k_live_[0-9a-zA-Z]{24,99}/g },
  { id: 'stripe-restricted', name: 'Stripe Restricted Key', severity: 'high', pattern: /rk_live_[0-9a-zA-Z]{24,99}/g },

  // ═══ Slack ══════════════════════════════════════════════════
  { id: 'slack-token', name: 'Slack API Token', severity: 'high', pattern: /xox[baprs]-[0-9a-zA-Z]{10,48}/g },
  { id: 'slack-webhook', name: 'Slack Webhook URL', severity: 'high', pattern: /hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/g },

  // ═══ Twilio ═════════════════════════════════════════════════
  { id: 'twilio-api-key', name: 'Twilio API Key', severity: 'high', pattern: /SK[0-9a-f]{32}/g },
  { id: 'twilio-account-sid', name: 'Twilio Account SID', severity: 'medium', pattern: /AC[a-z0-9]{32}/g },

  // ═══ SendGrid ═══════════════════════════════════════════════
  { id: 'sendgrid-api', name: 'SendGrid API Key', severity: 'high', pattern: /SG\.[a-zA-Z0-9]{22}\.[a-zA-Z0-9]{43}/g },

  // ═══ Mailgun / Mailchimp ════════════════════════════════════
  { id: 'mailgun-api', name: 'Mailgun API Key', severity: 'high', pattern: /key-[0-9a-zA-Z]{32}/g },
  { id: 'mailchimp-api', name: 'Mailchimp API Key', severity: 'high', pattern: /[0-9a-f]{32}-us[0-9]{1,2}/g },

  // ═══ Shopify ════════════════════════════════════════════════
  { id: 'shopify-access-token', name: 'Shopify Access Token', severity: 'high', pattern: /shpat_[a-fA-F0-9]{32}/g },
  { id: 'shopify-secret', name: 'Shopify Shared Secret', severity: 'high', pattern: /shpss_[a-fA-F0-9]{32}/g },

  // ═══ Payment ════════════════════════════════════════════════
  { id: 'razorpay-key', name: 'Razorpay Key', severity: 'high', pattern: /rzp_(live|test)_.{14}/g },
  { id: 'paypal-braintree', name: 'PayPal/Braintree Token', severity: 'high', pattern: /access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}/g },
  { id: 'square-access-token', name: 'Square Access Token', severity: 'high', pattern: /sq0atp-[0-9A-Za-z_-]{22}/g },
  { id: 'square-oauth', name: 'Square OAuth Secret', severity: 'high', pattern: /sq0csp-[0-9A-Za-z_-]{43}/g },

  // ═══ AI Providers ═══════════════════════════════════════════
  { id: 'openai-api-key', name: 'OpenAI API Key', severity: 'critical', pattern: /sk-[a-zA-Z0-9]{48}/g },
  { id: 'openai-project-key', name: 'OpenAI Project Key', severity: 'critical', pattern: /sk-proj-[a-zA-Z0-9_-]{48,}/g },
  { id: 'anthropic-api-key', name: 'Anthropic API Key', severity: 'critical', pattern: /sk-ant-[a-zA-Z0-9_-]{90,}/g },
  { id: 'groq-api-key', name: 'Groq API Key', severity: 'critical', pattern: /gsk_[a-zA-Z0-9]{48}/g },
  { id: 'openrouter-key', name: 'OpenRouter API Key', severity: 'high', pattern: /sk-or-v1-[a-f0-9]{64}/g },

  // ═══ DevOps / CI-CD ═════════════════════════════════════════
  { id: 'heroku-key', name: 'Heroku API Key', severity: 'high', pattern: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g },
  { id: 'npm-token', name: 'NPM Access Token', severity: 'critical', pattern: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { id: 'pypi-token', name: 'PyPI Token', severity: 'high', pattern: /pypi-AgEIcHlwaS5vcmc[a-zA-Z0-9_-]{50,}/g },
  { id: 'nuget-key', name: 'NuGet API Key', severity: 'high', pattern: /oy2[a-z0-9]{43}/g },
  { id: 'rubygems-key', name: 'RubyGems API Key', severity: 'high', pattern: /rubygems_[a-f0-9]{48}/g },
  { id: 'clojars-token', name: 'Clojars API Token', severity: 'high', pattern: /CLOJARS_[a-z0-9]{60}/g },
  { id: 'crates-io-token', name: 'Crates.io API Token', severity: 'high', pattern: /cio[a-zA-Z0-9]{32}/g },
  { id: 'jenkins-token', name: 'Jenkins Token', severity: 'high', pattern: /(?:jenkins).{0,10}(?:crumb)?.{0,10}\b[0-9a-f]{32,36}\b/gi },
  { id: 'databricks-token', name: 'Databricks API Token', severity: 'high', pattern: /dapi[a-h0-9]{32}/g },
  { id: 'dynatrace-token', name: 'Dynatrace Token', severity: 'high', pattern: /dt0c01\.[A-Z0-9]{24}\.[A-Z0-9]{64}/g },

  // ═══ Analytics / Monitoring ═════════════════════════════════
  { id: 'datadog-api-key', name: 'Datadog API Key', severity: 'high', pattern: /(?:datadog).{0,20}(?:api[_-]?key)\s*[=:]\s*['"]?[a-f0-9]{32}/gi },
  { id: 'algolia-key', name: 'Algolia API Key', severity: 'high', pattern: /(?:algolia).{0,20}[=:].{0,5}[a-z0-9]{32}/gi },
  { id: 'codecov-token', name: 'Codecov Token', severity: 'medium', pattern: /(?:codecov).{0,20}[=:].{0,5}[a-f0-9]{32}/gi },
  { id: 'code-climate-token', name: 'Code Climate Token', severity: 'medium', pattern: /(?:codeclimate).{0,20}[=:].{0,5}[a-f0-9]{40}/gi },

  // ═══ Communication ══════════════════════════════════════════
  { id: 'telegram-bot-token', name: 'Telegram Bot Token', severity: 'high', pattern: /\b\d+:AA[a-zA-Z0-9_-]{32,33}\b/g },
  { id: 'discord-webhook', name: 'Discord Webhook', severity: 'high', pattern: /discord(?:app)?\.com\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9_-]+/g },

  // ═══ SaaS / Productivity ════════════════════════════════════
  { id: 'postman-api-key', name: 'Postman API Key', severity: 'medium', pattern: /\bPMAK-[a-zA-Z0-9]{24}-[a-zA-Z0-9]{34}\b/g },
  { id: 'airtable-key', name: 'Airtable API Key', severity: 'medium', pattern: /(?:airtable).{0,20}[=:].{0,5}[a-z0-9]{17}/gi },
  { id: 'contentful-token', name: 'Contentful API Token', severity: 'medium', pattern: /(?:contentful).{0,20}[=:].{0,5}[a-zA-Z0-9_-]{43}/gi },
  { id: 'freshbooks-token', name: 'Freshbooks Access Token', severity: 'medium', pattern: /(?:freshbooks).{0,20}[=:].{0,5}[a-z0-9]{64}/gi },
  { id: 'gocardless-token', name: 'GoCardless API Token', severity: 'high', pattern: /(?:gocardless).{0,20}[=:].{0,5}live_[a-zA-Z0-9_-]{40}/gi },

  // ═══ Cloud / Hosting ════════════════════════════════════════
  { id: 'vercel-token', name: 'Vercel Token', severity: 'high', pattern: /vercel_[a-zA-Z0-9]{24}/g },
  { id: 'supabase-key', name: 'Supabase Key', severity: 'high', pattern: /sbp_[a-f0-9]{40}/g },
  { id: 'digitalocean-token', name: 'DigitalOcean Token', severity: 'critical', pattern: /dop_v1_[a-f0-9]{64}/g },
  { id: 'cloudflare-api-key', name: 'Cloudflare API Key', severity: 'high', pattern: /(?:cloudflare).{0,20}(?:api[_-]?key)\s*[=:]\s*['"]?[a-f0-9]{37}/gi },
  { id: 'fastly-api-token', name: 'Fastly API Token', severity: 'high', pattern: /(?:fastly).{0,20}[=:].{0,5}[a-zA-Z0-9_-]{32}/gi },
  { id: 'hashicorp-vault', name: 'HashiCorp Vault Token', severity: 'critical', pattern: /[a-z0-9]{14}\.atlasv1\.[a-z0-9_=-]{60,70}/gi },
  { id: 'doppler-api-token', name: 'Doppler API Token', severity: 'high', pattern: /dp\.pt\.[a-zA-Z0-9]{43}/gi },
  { id: 'cloudinary-url', name: 'Cloudinary URL', severity: 'high', pattern: /cloudinary:\/\/[0-9]{15}:[0-9A-Za-z_-]+@[0-9A-Za-z_-]+/g },

  // ═══ Maps / Location ════════════════════════════════════════
  { id: 'mapbox-public', name: 'Mapbox Public Token', severity: 'low', pattern: /pk\.eyJ1Ijoi\w+\.[\w-]*/g },
  { id: 'mapbox-secret', name: 'Mapbox Secret Token', severity: 'high', pattern: /sk\.eyJ1Ijoi\w+\.[\w-]*/g },

  // ═══ Finance / Commerce ═════════════════════════════════════
  { id: 'zendesk-secret', name: 'Zendesk Secret Key', severity: 'high', pattern: /(?:zendesk).{0,20}[=:].{0,5}[a-z0-9]{40}/gi },
  { id: 'coinbase-token', name: 'Coinbase Access Token', severity: 'critical', pattern: /(?:coinbase).{0,20}[=:].{0,5}[a-z0-9]{64}/gi },
  { id: 'finnhub-token', name: 'Finnhub Access Token', severity: 'medium', pattern: /(?:finnhub).{0,20}[=:].{0,5}[a-zA-Z0-9]{20}/gi },

  // ═══ Private Keys ═══════════════════════════════════════════
  { id: 'rsa-private-key', name: 'RSA Private Key', severity: 'critical', pattern: /-----BEGIN RSA PRIVATE KEY-----/g },
  { id: 'private-key', name: 'Private Key', severity: 'critical', pattern: /-----BEGIN PRIVATE KEY-----/g },
  { id: 'openssh-private-key', name: 'OpenSSH Private Key', severity: 'critical', pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g },
  { id: 'ec-private-key', name: 'EC Private Key', severity: 'critical', pattern: /-----BEGIN EC PRIVATE KEY-----/g },
  { id: 'dsa-private-key', name: 'DSA Private Key', severity: 'critical', pattern: /-----BEGIN DSA PRIVATE KEY-----/g },
  { id: 'pgp-private-key', name: 'PGP Private Key Block', severity: 'critical', pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g },

  // ═══ Database / Connection ══════════════════════════════════
  { id: 'db-connection-string', name: 'Database Connection String', severity: 'critical', pattern: /(?:mysql|postgres|postgresql|mongodb|redis|amqp|mssql):\/\/[^:]+:[^@]+@[^\s'"]+/gi },
  { id: 'basic-auth-url', name: 'Basic Auth in URL', severity: 'high', pattern: /https?:\/\/[a-zA-Z0-9][^\s:@]{2,19}:[^\s:@]{3,50}@[a-zA-Z0-9.-]{3,100}/g },

  // ═══ JWT ════════════════════════════════════════════════════
  { id: 'jwt-token', name: 'JWT Token', severity: 'medium', pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },

  // ═══ Webhooks ═══════════════════════════════════════════════
  { id: 'zapier-webhook', name: 'Zapier Webhook', severity: 'medium', pattern: /hooks\.zapier\.com\/hooks\/catch\/[0-9]+\/[a-zA-Z0-9]+/g },

  // ═══ Atlassian ═══════════════════════════════════════════════
  { id: 'atlassian-api-token', name: 'Atlassian API Token', severity: 'high', pattern: /(?:atlassian|jira|confluence).{0,20}[=:].{0,5}[A-Za-z0-9]{24}/gi },
  { id: 'bitbucket-client-secret', name: 'Bitbucket Client Secret', severity: 'high', pattern: /(?:bitbucket).{0,20}(?:secret)\s*[=:]\s*['"]?[A-Za-z0-9]{32,}/gi },

  // ═══ Auth0 ══════════════════════════════════════════════════
  { id: 'auth0-client-secret', name: 'Auth0 Client Secret', severity: 'high', pattern: /(?:auth0).{0,20}(?:client[_-]?secret)\s*[=:]\s*['"]?[A-Za-z0-9_-]{32,}/gi },
  { id: 'auth0-mgmt-token', name: 'Auth0 Management API Token', severity: 'critical', pattern: /(?:auth0).{0,20}(?:mgmt|management).{0,10}(?:token)\s*[=:]\s*['"]?[A-Za-z0-9_-]{30,}/gi },

  // ═══ Okta ═══════════════════════════════════════════════════
  { id: 'okta-api-token', name: 'Okta API Token', severity: 'high', pattern: /(?:okta).{0,20}[=:].{0,5}00[A-Za-z0-9_-]{40}/gi },

  // ═══ Sentry ═════════════════════════════════════════════════
  { id: 'sentry-dsn', name: 'Sentry DSN', severity: 'medium', pattern: /https:\/\/[a-f0-9]{32}@[a-z0-9.-]+\.ingest\.sentry\.io\/[0-9]+/g },

  // ═══ CircleCI ═══════════════════════════════════════════════
  { id: 'circleci-token', name: 'CircleCI Token', severity: 'high', pattern: /(?:circle).{0,20}[=:].{0,5}[a-f0-9]{40}/gi },

  // ═══ Travis CI ══════════════════════════════════════════════
  { id: 'travis-token', name: 'Travis CI Token', severity: 'high', pattern: /(?:travis).{0,20}[=:].{0,5}[A-Za-z0-9]{22}/gi },

  // ═══ Netlify ════════════════════════════════════════════════
  { id: 'netlify-token', name: 'Netlify Access Token', severity: 'high', pattern: /(?:netlify).{0,20}[=:].{0,5}[A-Za-z0-9_-]{40,}/gi },

  // ═══ Linear ═════════════════════════════════════════════════
  { id: 'linear-api-key', name: 'Linear API Key', severity: 'medium', pattern: /lin_api_[a-zA-Z0-9]{40}/g },

  // ═══ Notion ═════════════════════════════════════════════════
  { id: 'notion-integration', name: 'Notion Integration Token', severity: 'high', pattern: /secret_[a-zA-Z0-9]{43}/g },

  // ═══ Pulumi ═════════════════════════════════════════════════
  { id: 'pulumi-access-token', name: 'Pulumi Access Token', severity: 'high', pattern: /pul-[a-f0-9]{40}/g },

  // ═══ Terraform ══════════════════════════════════════════════
  { id: 'terraform-cloud-token', name: 'Terraform Cloud Token', severity: 'high', pattern: /[a-zA-Z0-9]{14}\.atlasv1\.[a-zA-Z0-9_-]{60,}/g },

  // ═══ Age encryption key ═════════════════════════════════════
  { id: 'age-secret-key', name: 'Age Secret Key', severity: 'critical', pattern: /AGE-SECRET-KEY-[A-Z0-9]{59}/g },

  // ═══ Grafana ════════════════════════════════════════════════
  { id: 'grafana-api-key', name: 'Grafana API Key', severity: 'high', pattern: /eyJrIjoi[A-Za-z0-9+/=]{28,}/g },

  // ═══ Vault ══════════════════════════════════════════════════
  { id: 'vault-batch-token', name: 'Vault Batch Token', severity: 'critical', pattern: /hvb\.[A-Za-z0-9_-]{24,}/g },
  { id: 'vault-service-token', name: 'Vault Service Token', severity: 'critical', pattern: /hvs\.[A-Za-z0-9_-]{24,}/g },

  // ═══ Hugging Face ═══════════════════════════════════════════
  { id: 'huggingface-token', name: 'Hugging Face Token', severity: 'high', pattern: /hf_[a-zA-Z0-9]{34}/g },

  // ═══ Replicate ══════════════════════════════════════════════
  { id: 'replicate-api-token', name: 'Replicate API Token', severity: 'high', pattern: /r8_[a-zA-Z0-9]{40}/g },

  // ═══ Cohere ═════════════════════════════════════════════════
  { id: 'cohere-api-key', name: 'Cohere API Key', severity: 'high', pattern: /(?:cohere).{0,20}[=:].{0,5}[a-zA-Z0-9]{40}/gi },

  // ═══ Plaid ══════════════════════════════════════════════════
  { id: 'plaid-client-id', name: 'Plaid Client ID', severity: 'medium', pattern: /(?:plaid).{0,20}(?:client[_-]?id)\s*[=:]\s*['"]?[a-f0-9]{24}/gi },
  { id: 'plaid-secret', name: 'Plaid Secret', severity: 'high', pattern: /(?:plaid).{0,20}(?:secret)\s*[=:]\s*['"]?[a-f0-9]{30}/gi },

  // ═══ Twitch ═════════════════════════════════════════════════
  { id: 'twitch-client-secret', name: 'Twitch Client Secret', severity: 'high', pattern: /(?:twitch).{0,20}(?:secret)\s*[=:]\s*['"]?[a-z0-9]{30}/gi },

  // ═══ Flutterwave ════════════════════════════════════════════
  { id: 'flutterwave-secret', name: 'Flutterwave Secret Key', severity: 'critical', pattern: /FLWSECK-[a-f0-9]{32}-X/g },
  { id: 'flutterwave-public', name: 'Flutterwave Public Key', severity: 'low', pattern: /FLWPUBK-[a-f0-9]{32}-X/g },

  // ═══ Paystack ═══════════════════════════════════════════════
  { id: 'paystack-secret', name: 'Paystack Secret Key', severity: 'critical', pattern: /sk_live_[a-f0-9]{40}/g },

  // ═══ Generic (catch-all, lower confidence) ══════════════════
  { id: 'generic-api-key', name: 'Generic API Key', severity: 'high', pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"][A-Za-z0-9_\-/.]{20,}['"]/gi },
  { id: 'generic-secret', name: 'Generic Secret', severity: 'high', pattern: /(?:secret|secret[_-]?key)\s*[=:]\s*['"][A-Za-z0-9_\-/.]{20,}['"]/gi },
  { id: 'generic-password', name: 'Hardcoded Password', severity: 'high', pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{8,}['"]/gi },
  { id: 'generic-token', name: 'Generic Token', severity: 'high', pattern: /(?:access[_-]?token|auth[_-]?token|bearer)\s*[=:]\s*['"][A-Za-z0-9_\-/.]{20,}['"]/gi },
  { id: 'generic-private-key', name: 'Generic Private Key', severity: 'high', pattern: /(?:private[_-]?key)\s*[=:]\s*['"][A-Za-z0-9_\-/.+=]{20,}['"]/gi },
];

// ─── Skip Lists ───────────────────────────────────────────────

const SKIP_FILES = new Set([
  '.env.example', '.env.sample', '.env.template', '.env.test',
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'composer.lock', 'Gemfile.lock', 'poetry.lock', 'Pipfile.lock',
]);

const SKIP_PATHS = [
  'node_modules', '__test__', '__tests__', '__mock__', '__mocks__',
  '.test.', '.spec.', 'test/', 'tests/', 'fixtures/', 'mocks/',
  'vendor/', 'dist/', 'build/', '.min.',
];

const FALSE_POSITIVES = /example|placeholder|your[_-]|xxx|yyy|000|test[_-]?key|dummy|fake|sample|changeme|replace|insert[_-]|todo|fixme|mock/i;

// ─── Analyzer ─────────────────────────────────────────────────

export function runSecretsAnalyzer(files: RepoFile[]): Issue[] {
  const issues: Issue[] = [];

  for (const file of files) {
    const fileName = file.path.split('/').pop() ?? '';
    if (SKIP_FILES.has(fileName)) continue;
    if (SKIP_PATHS.some((p) => file.path.includes(p))) continue;

    const lines = file.content.split('\n');

    for (const pat of PATTERNS) {
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        if (found) break;
        const line = lines[i] ?? '';
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('<!--')) continue;

        pat.pattern.lastIndex = 0;
        if (pat.pattern.test(line)) {
          if (FALSE_POSITIVES.test(line)) continue;

          issues.push({
            id: uuid(),
            ruleId: pat.id,
            type: 'security',
            severity: pat.severity,
            title: `${pat.name} detected — remove and rotate immediately`,
            description: `Hardcoded ${pat.name.toLowerCase()} found in source code. Move to environment variables and rotate the exposed credential.`,
            file: file.path,
            line: i + 1,
            badCode: `[redacted — ${pat.name}]`,
            goodCode: `process.env.${pat.id.toUpperCase().replace(/-/g, '_')}`,
            language: file.language,
          });
          found = true;
        }
      }
    }
  }

  return issues;
}
