# API Providers

## Overview

OpenCode supports 21+ LLM providers through the [Vercel AI SDK](https://sdk.vercel.ai/). Providers are loaded from a combination of bundled SDK packages, custom initialization logic, and the [models.dev](https://models.dev) model catalog API.

---

## Architecture

```
  opencode.json          models.dev API          Environment
  (user config)          (model catalog)         Variables
       |                      |                      |
       +----------+-----------+----------+-----------+
                  |                      |
            Config.load()          ModelsDev.refresh()
                  |                      |
                  +----------+-----------+
                             |
                    Provider.initProvider()
                             |
              +--------------+--------------+
              |              |              |
        BUNDLED_         CUSTOM_        Plugin
        PROVIDERS        LOADERS        Auth
              |              |              |
              +------+-------+------+------+
                     |              |
               SDK Instance    Provider.Info
               (createOpenAI,     (models,
                createAnthropic,   options,
                etc.)              variants)
                     |
              LanguageModelV2
                     |
              Session.prompt()
```

---

## Bundled Providers

These SDK packages are imported at build time and available without runtime installation:

| Provider | Package | Environment Variable |
|----------|---------|---------------------|
| Amazon Bedrock | `@ai-sdk/amazon-bedrock` | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` or `AWS_BEARER_TOKEN` |
| Anthropic | `@ai-sdk/anthropic` | `ANTHROPIC_API_KEY` |
| Azure OpenAI | `@ai-sdk/azure` | `AZURE_OPENAI_API_KEY` + `AZURE_RESOURCE_NAME` |
| Cerebras | `@ai-sdk/cerebras` | `CEREBRAS_API_KEY` |
| Cohere | `@ai-sdk/cohere` | `COHERE_API_KEY` |
| DeepInfra | `@ai-sdk/deepinfra` | `DEEPINFRA_API_KEY` |
| Gateway | `@ai-sdk/gateway` | `GATEWAY_API_KEY` |
| GitHub Copilot | Custom (`./sdk/copilot`) | Copilot OAuth token |
| GitLab Duo | `@gitlab/gitlab-ai-provider` | `GITLAB_API_TOKEN` or OAuth |
| Google AI | `@ai-sdk/google` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Google Vertex | `@ai-sdk/google-vertex` | `GOOGLE_CLOUD_PROJECT` |
| Google Vertex (Anthropic) | `@ai-sdk/google-vertex/anthropic` | `GOOGLE_CLOUD_PROJECT` |
| Groq | `@ai-sdk/groq` | `GROQ_API_KEY` |
| Mistral | `@ai-sdk/mistral` | `MISTRAL_API_KEY` |
| OpenAI | `@ai-sdk/openai` | `OPENAI_API_KEY` |
| OpenAI Compatible | `@ai-sdk/openai-compatible` | Provider-specific |
| OpenRouter | `@openrouter/ai-sdk-provider` | `OPENROUTER_API_KEY` |
| Perplexity | `@ai-sdk/perplexity` | `PERPLEXITY_API_KEY` |
| Together AI | `@ai-sdk/togetherai` | `TOGETHER_AI_API_KEY` |
| Vercel | `@ai-sdk/vercel` | `VERCEL_API_KEY` |
| XAI (Grok) | `@ai-sdk/xai` | `XAI_API_KEY` |

---

## Custom Loaders

These providers have custom initialization logic beyond the standard SDK constructor. Defined in `src/provider/provider.ts` `CUSTOM_LOADERS`:

### Anthropic
- **Custom headers:** `claude-code-20250219`, `interleaved-thinking-2025-05-14`, `fine-grained-tool-streaming-2025-05-14`
- **Autoload:** false (requires API key)

### OpenAI
- **Custom model routing:** Uses `sdk.responses(modelID)` for the OpenAI Responses API
- **Autoload:** false

### GitHub Copilot
- **Custom model routing:** Routes to `responses()` or `chat()` based on model version (GPT-5+ uses Responses API)
- **Custom SDK:** Built-in `./sdk/copilot` implementation
- **Auth:** Copilot OAuth token flow
- **Autoload:** false

### Azure OpenAI
- **Custom model routing:** Routes to `responses()` or `chat()`
- **Custom vars:** Resolves `AZURE_RESOURCE_NAME` from config or environment
- **Autoload:** false

### Amazon Bedrock
- **Complex credential handling:** Bearer token > credential chain > profiles > IAM roles > web identity tokens
- **Region-specific model prefixes:** `us.`, `eu.`, `jp.`, `au.`, `global.`, `apac.` based on region and model
- **Autoload:** true (if AWS credentials configured)

### Google Vertex
- **Custom authentication:** Google Cloud Auth library for service account credentials
- **Custom vars:** Resolves `GOOGLE_CLOUD_PROJECT`, `GOOGLE_VERTEX_LOCATION`
- **Autoload:** true (if project configured)

### GitLab Duo
- **Complex auth:** OAuth or API token, instance URL resolution
- **Feature flags:** `duo_agent_platform_agentic_chat`, `duo_agent_platform`
- **Custom headers:** User-Agent, anthropic-beta for extended context
- **Autoload:** true (if API key available)

### Cloudflare Workers AI
- **Custom auth:** From environment or Auth storage
- **Custom vars:** Resolves `CLOUDFLARE_ACCOUNT_ID`
- **Autoload:** conditional

### Cloudflare AI Gateway
- **Dynamic import:** `ai-gateway-provider` package (loaded at runtime, not bundled)
- **Features:** Metadata, cache settings (TTL, key, skip), unified API format
- **Autoload:** true

### SAP AI Core
- **Service key auth:** From environment or Auth storage
- **Autoload:** conditional

### OpenRouter, Vercel, Zenmux, Kilo, Cerebras
- **Custom headers:** HTTP-Referer, X-Title, or integration identifiers
- **Autoload:** false

---

## Model Discovery

### models.dev API

Models are fetched from the [models.dev](https://models.dev) API:
- **Endpoint:** `${OPENCODE_MODELS_URL}/api.json` (default: `https://models.dev/api.json`)
- **Fallback:** Bundled snapshot at `./models-snapshot` if fetch fails
- **Cache:** Stored at `~/.opencode/cache/models.json`
- **Refresh:** On startup + hourly interval

### Model schema

Each model from models.dev includes:
- Identity: `id`, `name`, `family`, `release_date`
- Capabilities: `temperature`, `reasoning`, `tool_call`, `attachment`, `interleaved`
- Cost: `input`, `output`, `cache` (per million tokens)
- Limits: `context`, `input`, `output` token counts
- Modalities: input/output support for `text`, `audio`, `image`, `video`, `pdf`
- Status: `alpha`, `beta`, `deprecated`, or active
- Provider info: `npm` package, `api` endpoint
- Variants: named configuration presets (e.g., "fast", "extended-thinking")

### Model loading flow

1. Fetch models from models.dev API (or fallback snapshot)
2. Apply `CUSTOM_LOADERS` transformations (custom auth, headers, model routing)
3. Merge with user config overrides (`opencode.json` provider settings)
4. Filter by enabled/disabled provider lists
5. Apply per-provider model blacklist/whitelist
6. Apply variant transformations per model

---

## Transform Pipeline

`src/provider/transform.ts` handles message and schema transformations:

| Transform | Purpose |
|-----------|---------|
| `normalizeMessages()` | Converts messages to provider-expected format (reasoning part extraction, content structure) |
| `schema()` | Converts Zod JSON Schema to provider-compatible format (Gemini sanitization, strict mode) |
| `options()` | Builds provider-specific options (store, reasoning config, cache keys, prompt caching) |
| `variants()` | Maps variant names to provider option overrides (e.g., "extended-thinking" → reasoning budget) |
| `providerOptions()` | Restructures flat options into nested provider option namespaces |
| `smallOptions()` | Builds minimal options for small/fast model calls (evaluator, title generation) |

---

## Adding Custom Providers

Users can add providers via `opencode.json`:

```json
{
  "provider": {
    "my-provider": {
      "npm": "@ai-sdk/openai-compatible",
      "api": {
        "url": "https://api.my-provider.com/v1"
      },
      "env": ["MY_PROVIDER_API_KEY"],
      "models": {
        "my-model": {
          "name": "My Model",
          "attachment": true,
          "tool_call": true
        }
      }
    }
  }
}
```

Alternatively, providers can register through the plugin system (`plugin.auth.loader`).

---

## Frankencode Differences

The provider system is identical to upstream OpenCode — all 21+ providers, custom loaders, models.dev integration, and transform pipeline are upstream-compatible.

Frankencode adds features at the **session/tool layer** that work with all providers:
- **Verify tool** (`src/tool/verify.ts`) — runs test/lint/typecheck with circuit breaker, uses session's current provider
- **Refine tool** (`src/tool/refine.ts`) — evaluator-optimizer loop, spawns child sessions on the same provider
- **Evaluator/optimizer agents** — use the session's model for code review scoring

See [FRANKENCODE_DIFFERENCES.md](FRANKENCODE_DIFFERENCES.md) for the complete list.

---

## See Also

- [EFFECTIFICATION.md](EFFECTIFICATION.md) — Effect architecture (ProviderAuthService, ConfigService are Effect services)
- [agents.md](agents.md) — agents that use providers (evaluator, optimizer inherit session model)
- [AGENT_CLIENT_PROTOCOL.md](AGENT_CLIENT_PROTOCOL.md) — model selection via ACP NewSessionRequest
- [FRANKENCODE_DIFFERENCES.md](FRANKENCODE_DIFFERENCES.md) — all Frankencode vs OpenCode differences
