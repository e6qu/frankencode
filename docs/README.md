# Frankencode Documentation

> **Frankencode** is a fork of [OpenCode](https://github.com/anomalyco/opencode) that adds context editing, content-addressable storage, an edit graph, focus agents, side threads, and a verification/refinement loop.

## Documentation Map

| Document | Description |
|----------|-------------|
| [FRANKENCODE_DIFFERENCES.md](FRANKENCODE_DIFFERENCES.md) | All differences between Frankencode and upstream OpenCode |
| [context-editing.md](context-editing.md) | Context editing tools, lifecycle markers, and deterministic sweeper |
| [agents.md](agents.md) | Frankencode-specific agents (classifier, focus, evaluator, optimizer) |
| [schema.md](schema.md) | Database schema changes (4 new tables, PartBase extensions) |
| [EFFECTIFICATION.md](EFFECTIFICATION.md) | Effect-TS architecture, 22 services, LayerMap, dual-layer context |
| [AGENT_CLIENT_PROTOCOL.md](AGENT_CLIENT_PROTOCOL.md) | ACP v1 protocol support for IDE integration |
| [API_PROVIDERS.md](API_PROVIDERS.md) | 21+ LLM providers, models.dev API, transform pipeline |

## Architecture at a Glance

```
  User / IDE Client
       |
  ACP (JSON-RPC/stdio) or TUI or HTTP API
       |
  InstanceLifecycle.boot(directory)
       |
  InstanceALS + InstanceContext (dual context)
       |
  +----+----+----+----+----+----+
  |    |    |    |    |    |    |
 Session  Provider  Tools  Agents  Bus  Config
  |         |         |      |
 Prompt   21+ LLM   40+   classifier
 Pipeline  SDKs    tools   focus
  |                   |    evaluator
 context_edit      verify
 filterEdited      refine
 sweeper          thread_park
  |
 CAS + EditGraph
  |
 SQLite (Drizzle ORM)
```

## Tracking Documents (repo root)

| File | Purpose |
|------|---------|
| `BUGS.md` | Bug tracker (51 fixed, 0 open, 1 deferred) |
| `PLAN.md` | Feature roadmap and current work plan |
| `STATUS.md` | Project status snapshot |
| `WHAT_WE_DID.md` | Session work log |
| `GAP_ANALYSIS.md` | Target state vs current state |
