<!-- gitnexus:start -->
# GitNexus — Primary & Default Context Engine

This project is indexed by GitNexus as **AceMail** (2623 symbols, 5779 relationships, 217 execution flows). GitNexus is the **default and mandatory context engine** for all codebase exploration, comprehension, impact assessment, and refactoring to conserve context tokens and maximize accuracy.

> Re-indexing is managed from the GitNexus Hub dashboard.

## Context Engine Rules (Always Enforced)

- **Default to GitNexus for All Context**: NEVER perform broad workspace searches, blind greps, or full-file context dumps without first querying GitNexus. Use `gitnexus_query` to locate execution flows and relevant symbol references with minimal token usage.
- **Precision File Reads**: Use `gitnexus_context` to identify exact symbol boundaries (file paths and line numbers) and only read the specific line slices required, avoiding loading unnecessary code into context.
- **Mandatory Pre-Edit Impact Analysis**: Before modifying ANY function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report blast radius (direct callers, affected processes, risk level) to the user.
- **Risk Escalation**: MUST warn the user if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.

## When Debugging & Exploring

1. **Find Flows**: `gitnexus_query({query: "<error, symptom, or feature concept>"})` — discover processes and execution flows ranked by relevance.
2. **Inspect Callers & Callees**: `gitnexus_context({name: "<suspect or target symbol>"})` — inspect 360-degree symbol dependencies.
3. **Trace Execution**: `READ gitnexus://repo/AceMail/process/{processName}` — step through the precise execution path without searching manually.

## When Refactoring or Modifying

- **Extracting/Splitting/Moving**: Run `gitnexus_context({name: "target"})` followed by `gitnexus_impact({target: "target", direction: "upstream"})` to identify all d=1, d=2, d=3 callers before touching code.
- **Git Diff Impact**: Run `gitnexus_detect_changes({changed_files: [...]})` after making edits to evaluate affected processes and verify zero broken execution flows.

## Prohibitions

- NEVER edit a function, class, or method without first running `gitnexus_impact`.
- NEVER bypass GitNexus in favor of recursive file reads or indiscriminate regex searches when exploring architecture.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/AceMail/context` | Codebase overview, check index freshness |
| `gitnexus://repo/AceMail/clusters` | All functional areas |
| `gitnexus://repo/AceMail/processes` | All execution flows |
| `gitnexus://repo/AceMail/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. All d=1 (WILL BREAK) dependents were updated

<!-- gitnexus:end -->
