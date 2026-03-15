# Deep Research: Post-Factum Context Editing — State of the Art

A literature review of published papers, tools, frameworks, and industry trends related to live context editing, conversation memory management, and agent self-modification.

---

## 1. Academic Papers

### 1.1 Virtual Memory & Demand Paging for Context

**"MemGPT: Towards LLMs as Operating Systems"**
- Packer, Wooders, Lin, Fang, Patil, Gonzalez — October 2023
- [arxiv.org/abs/2310.08560](https://arxiv.org/abs/2310.08560)
- The foundational paper on virtual context management. Draws from OS virtual memory: main context = RAM, external storage = disk. The LLM itself manages paging between tiers using function calls. Evaluated on document analysis (exceeding context window) and multi-session chat. Evolved into the **Letta** framework. Directly relevant: the agent moves content in and out of its own working context.

**"The Missing Memory Hierarchy: Demand Paging for LLM Context Windows"**
- Tony Mason — March 2026
- [arxiv.org/abs/2603.09023](https://arxiv.org/abs/2603.09023)
- Introduces **Pichay**, a transparent proxy that implements demand paging between client and inference API. Evicts stale content, detects "page faults" when the model needs evicted material, and pins working-set pages by fault history. In 681 production turns: **93% context reduction** (5,038KB → 339KB), fault rate only 0.025%. The closest analog to our CAS/Merkle externalization design — content is dynamically evicted/restored based on access patterns.

### 1.2 Hierarchical Memory Structures

**"MemTree: From Isolated Conversations to Hierarchical Schemas"**
- Rezazadeh, Li et al. — October 2024, ICLR 2025
- [arxiv.org/abs/2410.14052](https://arxiv.org/abs/2410.14052)
- Dynamic tree-structured memory where each node encapsulates aggregated text, embeddings, and varying abstraction levels. Unlike flat lookup tables, MemTree hierarchically organizes and dynamically adapts by traversing the tree. Directly relevant to our Merkle tree design: tree structures allow surgical editing at any abstraction level.

**"Memory OS of AI Agent" (MemoryOS)**
- BAI-LAB — June 2025, EMNLP 2025 Oral
- [arxiv.org/abs/2506.06326](https://arxiv.org/abs/2506.06326)
- Hierarchical storage with four modules (Storage, Updating, Retrieval, Generation). 49% improvement on F1 and 46% on BLEU-1 over baselines on LoCoMo benchmark for personalized dialogue agents.

**"MemOS: An Operating System for Memory-Augmented Generation"**
- MemTensor — May 2025
- [arxiv.org/abs/2505.22101](https://arxiv.org/abs/2505.22101)
- Treats memory as a manageable system resource with "MemCubes" encapsulating both content and metadata (provenance, versioning). Provides a unified API to **add, retrieve, edit, and delete** memory. Directly implements editable context at the infrastructure level.

**"H-MEM: Hierarchical Memory for High-Efficiency"**
- 2025
- [arxiv.org/abs/2507.22925](https://arxiv.org/abs/2507.22925)
- Uses hierarchical memory and position index to search layer by layer, removing influence of irrelevant memories.

### 1.3 Agent Self-Reflection & Self-Correction

**"Reflexion: Language Agents with Verbal Reinforcement Learning"**
- Shinn, Cassano et al. — March 2023, NeurIPS 2023
- [arxiv.org/abs/2303.11366](https://arxiv.org/abs/2303.11366)
- Seminal paper on agent self-reflection. Agents verbally reflect on task feedback, maintaining reflective text in episodic memory to improve subsequent decisions. The agent effectively **edits its own context** by writing self-corrections that persist. Key precursor to our `thread_edit(replace)` operation.

**"A-MEM: Agentic Memory for LLM Agents"**
- Xu, Liang et al. — February 2025, NeurIPS 2025
- [arxiv.org/abs/2502.12110](https://arxiv.org/abs/2502.12110)
- Memory system following the Zettelkasten method. Creates interconnected knowledge networks through dynamic indexing and linking. When new memory is added, the system generates structured notes with descriptions, keywords, and tags, then determines connections. Superior to baselines across six models.

**"Agentic Context Engineering (ACE): Evolving Contexts for Self-Improving Language Models"**
- Zhang et al. — October 2025
- [arxiv.org/abs/2510.04618](https://arxiv.org/abs/2510.04618)
- Treats contexts as evolving playbooks via three roles: **Generator** (produces reasoning), **Reflector** (distills insights), **Curator** (integrates into structured context). Addresses "brevity bias" and "context collapse." +10.6% on agent benchmarks. Directly implements self-editing context: the agent evolves its own system prompt and memory over time. Closest academic work to our Curator + Focus Agent design.

**"In Prospect and Retrospect: Reflective Memory Management for Long-term Personalized Dialogue Agents"**
- ACL 2025
- [aclanthology.org/2025.acl-long.413](https://aclanthology.org/2025.acl-long.413.pdf)
- Selective retention and updating of memories based on prospective and retrospective evaluation. Relevant to our Pin & Decay scoring.

### 1.4 Selective Context Compression

**"LLMLingua: Compressing Prompts for Accelerated Inference"**
- Microsoft Research (Jiang et al.) — EMNLP 2023
- [arxiv.org/abs/2310.05736](https://arxiv.org/abs/2310.05736)
- Uses a small model to identify and remove unimportant tokens. Up to **20x compression** with minimal loss. LLMLingua-2 (ACL 2024) uses GPT-4 distillation for task-agnostic compression with a BERT-level encoder. Integrated into LangChain and LlamaIndex.

**"LongLLMLingua: Accelerating LLMs in Long Context Scenarios"**
- Microsoft Research — October 2023
- [arxiv.org/abs/2310.06839](https://arxiv.org/abs/2310.06839)
- Extends LLMLingua for long contexts. +21.4% RAG performance using 1/4 tokens. Mitigates the "lost in the middle" problem.

**"Prompt Compression for Large Language Models: A Survey"**
- Li et al. — NAACL 2025 Oral
- [aclanthology.org/2025.naacl-long.368](https://aclanthology.org/2025.naacl-long.368.pdf)
- Comprehensive survey categorizing methods into token pruning, abstractive compression, and extractive compression.

**"ACON: Agent Context Optimization"**
- OpenReview submission
- [openreview.net/pdf?id=7JbSwX6bNL](https://openreview.net/pdf?id=7JbSwX6bNL)
- Framework for compressing both environment observations and interaction histories. Uses failure-driven, task-aware compression guideline optimization.

### 1.5 Temporal Knowledge & Context Editing

**"Zep: A Temporal Knowledge Graph Architecture for Agent Memory"**
- Rasmussen et al. — January 2025
- [arxiv.org/abs/2501.13956](https://arxiv.org/abs/2501.13956)
- Introduces **Graphiti**, a temporally-aware knowledge graph. Facts have **validity periods** and can be **updated/overwritten** — a form of post-factum context editing. Outperforms MemGPT on Deep Memory Retrieval (94.8% vs 93.4%), 18.5% accuracy improvement on LongMemEval with 90% latency reduction.

### 1.6 Context Distillation

**"Learning by Distilling Context"**
- 2022
- [arxiv.org/abs/2209.15189](https://arxiv.org/abs/2209.15189)
- Internalizes context performance gains into model weights via fine-tuning. Distills instructions, reasoning chains, and examples.

**"Efficient LLM Context Distillation"**
- September 2024
- [arxiv.org/abs/2409.01930](https://arxiv.org/abs/2409.01930)
- Reduces cost of internalizing system prompts into model behavior.

### 1.7 RAG on Conversation History

**"ReadAgent: A Human-Inspired Reading Agent with Gist Memory"**
- Google DeepMind — 2023
- [deepmind.google/research/publications/74917](https://deepmind.google/research/publications/74917/)
- Decides what to compress into "gist memories" and what to look up when needed. 3-20x effective context extension while outperforming baselines. Similar to our CAS externalize + summary approach.

### 1.8 Infinite Context Approaches

**"Infini-attention: Leave No Context Behind"**
- Google (Munkhdalai et al.) — April 2024
- [arxiv.org/abs/2404.07143](https://arxiv.org/abs/2404.07143)
- Compressive memory storing summaries of past history in a fixed-size matrix. 114x less memory, lower perplexity.

**"InfiniteHiP: Context Up to 3 Million Tokens on a Single GPU"**
- February 2025
- [arxiv.org/abs/2502.08910](https://arxiv.org/abs/2502.08910)
- Hierarchical token pruning for 3M tokens on a single L40s 48GB GPU without permanent loss.

**"ReAttention: Training-Free Infinite Context with Finite Attention"**
- January 2025
- [openreview.net/forum?id=KDGP8yAz5b](https://openreview.net/forum?id=KDGP8yAz5b)
- Expands LLaMA3.2-3B-chat by 128x to 4M tokens without training.

### 1.9 Surveys

**"Memory in the Age of AI Agents: A Survey"**
- Hu et al. (47 authors) — December 2025
- [arxiv.org/abs/2512.13564](https://arxiv.org/abs/2512.13564)
- Definitive survey. Proposes "forms-functions-dynamics" taxonomy. Identifies frontiers: memory automation, RL integration, multimodal memory, multi-agent memory, trustworthiness.

**"A Survey on the Memory Mechanism of LLM-based Agents"**
- April 2024, ACM TOIS
- [arxiv.org/abs/2404.13501](https://arxiv.org/abs/2404.13501)
- Covers short-term, long-term, episodic, and semantic memory for LLM agents.

---

## 2. Engineering Articles & Blog Posts

### From AI Labs

**Anthropic: "Effective Context Engineering for AI Agents"** (2025)
- [anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Four strategies: system prompt optimization, tool design, strategic examples, dynamic retrieval. Defines **compaction** as summarizing conversation history while preserving architectural decisions.

**Anthropic: "Effective Harnesses for Long-Running Agents"** (November 2025)
- [anthropic.com/engineering/effective-harnesses-for-long-running-agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Multi-context-window workflows: initializer agent + coding agent leaving clear progress artifacts (`claude-progress.txt`) so fresh context windows quickly understand prior state. Relevant to our Handoff mode.

**OpenAI: "Memory and New Controls for ChatGPT"** (April 2025)
- [openai.com/index/memory-and-new-controls-for-chatgpt](https://openai.com/index/memory-and-new-controls-for-chatgpt/)
- Two-layer approach: saved memories (explicit) and chat history (implicit retrieval). Users can **edit and delete** memories. Consumer-facing editable context.

**Google: "Context Engineering: Sessions & Memory"** (November 2025)
- Agent intelligence comes not from the model but from context assembly. Session management, memory persistence, context assembly patterns.

### From Tool Companies

**Cursor: "Dynamic Context Discovery for Production Coding Agents"** (2025)
- [cursor.com/blog/dynamic-context-discovery](https://cursor.com/blog/dynamic-context-discovery)
- Five techniques: (1) long outputs written to files for selective retrieval, (2) chat history preserved as files during summarization, (3) Agent Skills standard, (4) selective MCP tool loading (**46.9% token reduction**), (5) terminal sessions as files. Philosophy: fewer details upfront, lazy-load.

**JetBrains Research: "Cutting Through the Noise"** (December 2025, NeurIPS DL4Code)
- [blog.jetbrains.com/research/2025/12/efficient-context-management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/)
- Empirical comparison: simple observation masking matched or exceeded LLM summarization while being **52% cheaper**. Summarization caused agents to run 15% longer. Developed a hybrid approach.

**LangChain: "Context Engineering for Agents"** (June 2025)
- [rlancemartin.github.io/2025/06/23/context_engineering](https://rlancemartin.github.io/2025/06/23/context_engineering/)
- Practical guide to retrieval, summarization, and memory management patterns.

**LangChain: "Context Management for Deep Agents"**
- [blog.langchain.com/context-management-for-deepagents](https://blog.langchain.com/context-management-for-deepagents/)
- Compression techniques: summarization, filtering stale information, retention decisions.

**Morphic LLM: "Context Engineering: Why More Tokens Makes Agents Worse"**
- [morphllm.com/context-engineering](https://www.morphllm.com/context-engineering)
- Overfilling context windows degrades performance. Case for selective, curated context.

---

## 3. Tools & Frameworks

### Agent Memory Platforms

| Tool | Approach | Key Feature | Relevance to Editable Context |
|------|----------|-------------|-------------------------------|
| **Letta** (ex-MemGPT) | OS-style virtual memory | Agents self-edit memory blocks via function calls | Direct: agent-initiated context editing |
| **Mem0** | Hybrid vector-graph | Sub-second retrieval, graph memory | Persistent editable memory across sessions |
| **Zep / Graphiti** | Temporal knowledge graph | Facts have validity periods, can be overwritten | Post-factum editing: update/supersede facts |
| **Cognee** | Cognitive science pipelines | Outperforms Mem0 + Graphiti on multi-hop | Knowledge structuring and editing |
| **CrewAI Memory** | LLM-scored importance | 4 memory types, ChromaDB + SQLite | Content scoring → our Pin & Decay |
| **AWS Bedrock AgentCore** | Managed service | Auto-extracts insights across sessions | Cross-session memory management |
| **Microsoft Agent Framework** | Mem0 integration | InMemoryHistoryProvider + persistent DB | Session persistence + editable memory |

### Conversation Branching

| Tool | Approach | Relevance |
|------|----------|-----------|
| **Forky** | Git-style DAG for LLM chats | Fork, explore alternatives, semantic merge |
| **GitChat** | Git metaphors for conversation | Branching conversations |
| **LibreChat** | Fork from any message | Creates independent sessions from shared history |
| **OpenCode** | Session fork (`Session.fork()`) | Copies messages up to a point into new session |

### Context Compression

| Tool | Approach | Compression | Relevance |
|------|----------|:-----------:|-----------|
| **LLMLingua** (Microsoft) | Small-model token pruning | 20x | Automated context trimming |
| **LLMLingua-2** | BERT encoder via GPT-4 distillation | Task-agnostic | Integrated in LangChain/LlamaIndex |
| **OpenCode DCP** | Dynamic context pruning plugin | Variable | Plugin for OpenCode specifically |
| **Pichay** | Demand paging proxy | 93% | Transparent evict/restore by access pattern |

---

## 4. Industry Trends

### "Context Engineering" as a Discipline

Term popularized by Tobi Lutke (Shopify CEO) in June 2025: *"The art of providing all the context for the task to be plausibly solvable by the LLM."* Endorsed by Andrej Karpathy. By 2026, context engineering is a recognized engineering discipline encompassing system prompts, tools, retrieval, compaction, and memory management.

### Convergence Points

The field is converging on several patterns directly relevant to editable context:

**1. Four-Type Memory Taxonomy.** Working (context window), Procedural (how-to), Semantic (facts), Episodic (experiences). Every major framework implements this. Our design maps: Manual editing = working memory, CAS = semantic, Handoff = episodic, Agent prompts = procedural.

**2. Self-Editing Agents.** Letta agents edit their own memory blocks. ACE agents evolve their system prompts. Reflexion agents write self-corrections. MemOS provides explicit edit/delete APIs. Our `thread_edit` tool fits squarely in this trend.

**3. Hierarchical/Tree Structures.** MemTree, H-MEM, and Merkle approaches use tree structures for multi-level abstraction. Our Merkle tree design (externalize → summarize → tree navigation) aligns with this direction but applies it to conversation context specifically.

**4. Temporal Validity.** Zep/Graphiti tracks when facts become stale and allows overwriting. Our Pin & Decay scoring is a simpler version of this — relevance decays over turns, pinned items are immune.

**5. Demand Paging.** Pichay's demand paging (93% reduction, 0.025% fault rate) validates the core CAS/externalize design. Content is evicted to backing store and paged back in on demand. Our `thread_externalize` + `thread_deref` tools implement the same pattern with agent-level control.

### The Gap Our Design Fills

The literature shows no unified framework that combines all of:
1. **Human-initiated edits** to conversation history (hide, replace, annotate)
2. **Agent-initiated self-edits** (retract, correct, summarize)
3. **Automated curation** (background curator, focus agent, decay scoring)
4. **Content-addressable externalization** (CAS/Merkle with on-demand deref)
5. **Cross-session persistence** (handoff artifacts, project-level side threads)
6. **Objective-aware focus management** (focus agent, side thread parking)

Individual pieces exist across Letta, Pichay, ACE, Zep, and others. The editable context design integrates them into a coherent system for coding agent workflows.

### What's Ahead

**Short-term (2026):** Context engineering tooling matures. Expect every major coding agent (Cursor, Windsurf, Claude Code, OpenCode) to ship some form of context pruning/compression beyond basic compaction. Memory frameworks (Mem0, Letta) will integrate more deeply into agent harnesses.

**Medium-term (2027):** Self-editing agents become standard. The agent-edits-its-own-context pattern (currently in Letta and ACE) will be expected behavior for production agents. Cross-session memory will be table stakes.

**Long-term:** Context windows become a managed resource like virtual memory — the developer never thinks about size, the system transparently pages content in and out based on access patterns and relevance. The "context engineering" discipline either gets absorbed into standard agent frameworks or becomes a specialized field like database query optimization.

---

## References

### Papers
1. Packer et al. "MemGPT: Towards LLMs as Operating Systems" (2023) — arxiv:2310.08560
2. Mason. "The Missing Memory Hierarchy: Demand Paging" (2026) — arxiv:2603.09023
3. Rezazadeh et al. "MemTree" (2024) — arxiv:2410.14052
4. BAI-LAB. "Memory OS of AI Agent" (2025) — arxiv:2506.06326
5. MemTensor. "MemOS" (2025) — arxiv:2505.22101
6. Shinn et al. "Reflexion" (2023) — arxiv:2303.11366
7. Xu et al. "A-MEM" (2025) — arxiv:2502.12110
8. Zhang et al. "ACE: Agentic Context Engineering" (2025) — arxiv:2510.04618
9. Jiang et al. "LLMLingua" (2023) — arxiv:2310.05736
10. "LongLLMLingua" (2023) — arxiv:2310.06839
11. Li et al. "Prompt Compression Survey" (NAACL 2025) — aclanthology.org/2025.naacl-long.368
12. "ACON: Agent Context Optimization" — openreview.net/pdf?id=7JbSwX6bNL
13. Rasmussen et al. "Zep: Temporal Knowledge Graph" (2025) — arxiv:2501.13956
14. Hu et al. "Memory in the Age of AI Agents: A Survey" (2025) — arxiv:2512.13564
15. "A Survey on Memory Mechanism of LLM-based Agents" (2024) — arxiv:2404.13501
16. Munkhdalai et al. "Infini-attention" (2024) — arxiv:2404.07143
17. "InfiniteHiP" (2025) — arxiv:2502.08910
18. "ReAttention" (2025) — openreview.net/forum?id=KDGP8yAz5b
19. "ReadAgent" (2023) — deepmind.google/research/publications/74917
20. "Learning by Distilling Context" (2022) — arxiv:2209.15189
21. "H-MEM" (2025) — arxiv:2507.22925
22. "Reflective Memory Management" (ACL 2025) — aclanthology.org/2025.acl-long.413
23. "Pretraining Context Compressor" (ACL 2025) — aclanthology.org/2025.acl-long.1394

### Blog Posts & Articles
24. Anthropic. "Effective Context Engineering" (2025)
25. Anthropic. "Effective Harnesses for Long-Running Agents" (2025)
26. OpenAI. "Memory and Controls for ChatGPT" (2025)
27. Cursor. "Dynamic Context Discovery" (2025)
28. JetBrains. "Smarter Context Management" (NeurIPS DL4Code 2025)
29. LangChain. "Context Engineering for Agents" (2025)
30. LangChain. "Context Management for Deep Agents"
31. Morphic LLM. "Why More Tokens Makes Agents Worse"
32. Google. "Context Engineering: Sessions & Memory" (2025)

### Tools & Frameworks
33. Letta (ex-MemGPT) — github.com/letta-ai/letta
34. Mem0 — mem0.ai
35. Zep / Graphiti — getzep.com
36. Cognee — github.com/topoteretes/cognee
37. CrewAI Memory — docs.crewai.com
38. LLMLingua — github.com/microsoft/LLMLingua
39. Forky — github.com/ishandhanani/forky
40. OpenCode DCP — github.com/Opencode-DCP/opencode-dynamic-context-pruning
41. AWS Bedrock AgentCore Memory
42. Microsoft Agent Framework Memory
