# Frankencode — Do Next

## Implemented

- [x] CAS (SQLite) + Part Editing (EditMeta, LifecycleMeta, filterEdited, context_edit, context_deref)
- [x] Conversation Graph (edit_graph DAG, context_history with log/tree/checkout/fork)
- [x] Focus Agent + Side Threads (side_thread table, thread_park, thread_list, classifier, focus agents)
- [x] Integration (system prompt injection, plugin hooks, lifecycle sweeper)
- [x] v2: query/toolName targeting, classifier_threads, distill_threads, /btw, /focus, /reset-context
- [x] Config-based control (no feature toggles)
- [x] Documentation (README, docs/context-editing, docs/schema, docs/agents, AGENTS.md)

## Next

- [ ] Unit tests for CAS (store, get, dedup via ON CONFLICT)
- [ ] Unit tests for filterEdited (hidden parts stripped, empty messages dropped)
- [ ] Unit tests for EditGraph (commit chain, log walk, checkout restore)
- [ ] Unit tests for SideThread CRUD
- [ ] Unit tests for ContextEdit validation (ownership, budget, recency, privileged agents)
- [ ] Unit tests for lifecycle sweeper (discardable auto-hide, ephemeral auto-externalize)
- [ ] Test classifier_threads + distill_threads with a real session
- [ ] Test /btw command (verify it forks, doesn't pollute main thread)
- [ ] Explore: make /btw use Session.fork() for true message-level isolation
- [ ] Explore: CAS garbage collection (orphan cleanup, size limits)
- [ ] Explore: TUI rendering of edit indicators (hidden/replaced/annotated parts)
