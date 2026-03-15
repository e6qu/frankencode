# Frankencode — Do Next

## All 4 Phases Complete

### Implementation done:
- [x] Phase 1: CAS (SQLite) + Part Editing (EditMeta, filterEdited, context_edit, context_deref)
- [x] Phase 2: Conversation Graph (edit_graph DAG, context_history with log/tree/checkout/fork)
- [x] Phase 3: Focus Agent + Side Threads (side_thread table, thread_park, thread_list, focus agent, objective tracker)
- [x] Phase 4: Integration (system prompt injection, plugin hooks)

### Remaining (polish & testing):
- [ ] Write unit tests for CAS (store, get, dedup via ON CONFLICT)
- [ ] Write unit tests for filterEdited (hidden parts stripped, superseded parts stripped, empty messages dropped)
- [ ] Write unit tests for EditGraph (commit chain, log walk, checkout restore, fork branch)
- [ ] Write unit tests for SideThread CRUD
- [ ] Write unit tests for ContextEdit validation (ownership, budget, recency)
- [ ] Manual end-to-end test: enable `OPENCODE_EXPERIMENTAL_FOCUS_AGENT=1`, run a session, verify:
  - context_edit(hide) removes part from next LLM call
  - context_edit(externalize) replaces with summary, context_deref retrieves original
  - context_history(log) shows edit chain
  - thread_park creates a project-level thread
  - Focus agent runs post-turn and parks side threads
  - System prompt includes focus status + thread summary

### Future enhancements (from design docs):
- [ ] Threshold refocus mode (configurable %, proactive context rewrite)
- [ ] Background curator mode (between-turn cleanup)
- [ ] Pin & decay scoring (relevance decay per turn)
- [ ] Handoff artifacts (cross-session persistence)
- [ ] thread_investigate (spawn subagent with pre-loaded CAS context)
- [ ] thread_promote (swap side thread into main objective)
- [ ] TUI rendering (toggle edit indicators, sidebar thread panel)
- [ ] Focus intensity levels (relaxed/moderate/strict)
- [ ] CAS garbage collection (orphan cleanup)
