# Frankencode — Gap Analysis

**Date:** 2026-03-21

---

## Goal 1: Fix all remaining bugs (B47-B52) — DONE

## Goal 2: Eliminate weak typing — DONE

**~95 `any` eliminated.** Only 3 remain in upstream OpenAI SDK types (not our code).

### Strong Zod schemas defined

| Schema | Location | Purpose |
|--------|----------|---------|
| `JsonValue` | `message-v2.ts` | Recursive JSON-serializable value (string, number, boolean, null, object, array) |
| `ProviderMeta` | `message-v2.ts` | Provider metadata: `Record<string, Record<string, JsonValue>>` |
| `ToolInput` | `message-v2.ts` | Tool parameters: `Record<string, JsonValue>` |
| `ToolMeta` | `message-v2.ts` | Tool execution metadata: `Record<string, JsonValue>` |

### SDK boundary casts (~15 documented points)

| Location | Direction | Reason |
|----------|-----------|--------|
| `message-v2.ts:toModelMessages` | Our → AI SDK | `ProviderMeta` → `SharedV2ProviderMetadata` |
| `processor.ts` | AI SDK → Our | `value.providerMetadata` → `ProviderMeta` |
| `batch.ts` | AI SDK → Our | `call.parameters` → `ToolInput` |
| `prompt.ts` | Tool → AI SDK | `metadata` → `ToolMeta`; `id`/`schema` → AI SDK tool types |
| `provider.ts` | Config → SDK | Options accessed as specific types (string, number, object) |

### Documented exceptions (3 total)

| File | Reason |
|------|--------|
| `provider/sdk/copilot/openai-compatible-error.ts` | Upstream OpenAI `param` field |
| `provider/sdk/copilot/responses/openai-error.ts` | Upstream OpenAI `param` field |
| `provider/sdk/copilot/responses/openai-responses-language-model.ts` | Upstream OpenAI `metadata` field |
