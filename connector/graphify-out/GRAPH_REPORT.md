# Graph Report - connector  (2026-08-27)

## Corpus Check
- 11 files · ~7,873 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 128 nodes · 213 edges · 9 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `34629b29`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `processEvent()` - 14 edges
2. `normalizeMessage()` - 10 edges
3. `Sia Watcher Runbook` - 10 edges
4. `processMessages()` - 9 edges
5. `compilerOptions` - 9 edges
6. `start()` - 8 edges
7. `seedGroups()` - 7 edges
8. `normalizeJid()` - 7 edges
9. `Sia Connector — the WhatsApp watcher` - 7 edges
10. `drainLoop()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `start()` --calls--> `upsertContact()`  [EXTRACTED]
  src/index.ts → src/db.ts
- `drainLoop()` --calls--> `jsonSafe()`  [EXTRACTED]
  src/index.ts → src/normalize.ts
- `processMessages()` --calls--> `enqueueMediaDownload()`  [EXTRACTED]
  src/index.ts → src/media.ts
- `processMessages()` --calls--> `normalizeMessage()`  [EXTRACTED]
  src/index.ts → src/normalize.ts
- `processEvent()` --calls--> `isGroupJid()`  [EXTRACTED]
  src/index.ts → src/normalize.ts

## Import Cycles
- None detected.

## Communities (9 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.18
Nodes (24): insertMediaRow(), insertRawEvents(), markRevoked(), memberJoined(), memberLeft(), memberRoleChanged(), upsertContact(), upsertContactBridges() (+16 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (19): dependencies, @aws-sdk/client-s3, baileys, pino, qrcode-terminal, @supabase/supabase-js, description, devDependencies (+11 more)

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (16): config, CONNECTOR_DIR, env, fileEnv, HERE, REPO_ROOT, markMediaAttempt(), markMediaDone() (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.20
Nodes (8): readKey(), revive(), usePostgresAuthState(), wipeAuthState(), db, start(), startMediaBackfill(), setMediaSocket()

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (10): Known-empty by design, Media, Outage arithmetic (what downtime costs), Pairing (linking the WhatsApp number), Session inspection & reset (SQL), Sia Watcher Runbook, The number itself, THE ONE LAW (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (10): contextInfoOf(), extractText(), isGroupJid(), jsonSafe(), MEDIA_CONTENT, Normalized, normalizeMessage(), tsToIso() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, resolveJsonModule, skipLibCheck, strict (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (7): Architecture (the thin-handler discipline), Contracts, Deploy (later — Sia W1), Env, Run (pilot — one number, local machine), Sia Connector — the WhatsApp watcher, What it captures

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (5): BYTE_FIELDS, fetchRawMessage(), PendingRow, quietLogger, reviveBuffers()

## Knowledge Gaps
- **58 isolated node(s):** `name`, `private`, `version`, `type`, `description` (+53 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `normalizeMessage()` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _58 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1368421052631579 - nodes in this community are weakly interconnected._