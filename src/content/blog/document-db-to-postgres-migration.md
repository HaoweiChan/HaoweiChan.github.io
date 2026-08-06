---
title: 'From a Document Database Back to PostgreSQL: A Six-Phase Data Layer Exit Playbook'
description: 'How to cut a migration that touches every read and write path into six independently shippable, independently reversible phases: same-interface swaps, the dual-write safety net, write-stop as the only irreversible point, and the fourteen production bombs adversarial review caught.'
lang: 'en'
pubDate: 'Aug 4 2026'
heroImage: '../../assets/blog/covers/cloud-exit.png'
---

> Series: "A Bill That Triggered a Cloud Exit", part 2 of 3
> Previous: [When the Cloud Bill Jumps 20x Overnight](/blog/cloud-bill-forensics/) · Next: [The Last Mile: Media Files and Secrets](/blog/media-secrets-cloud-exit/)

## Introduction

The previous post ended with the bill reduced to a cost model: monthly cost ≈ read count x unit price + read count x payload x egress price. The hotfix removed 98% of the reads, but the structure of the model did not change — as long as the data lived in a document database on another continent, every byte was billable.

The irony: the entire database was **under 1 GB**. Maintaining a billed intercontinental channel for a sub-gigabyte dataset does not add up under any assumption. So I decided to move the whole data layer back to PostgreSQL on the VPS — data where the compute is.

This post is about the **playbook**: how to cut a migration that touches every read and write path into six independently shippable, independently reversible phases, plus the two practices that genuinely saved me more than once.

---

## Architectural Overview

Topology before and after:

```
[before] FastAPI (EU VPS) ⇄ cross-continent API calls ⇄ document database (US)
[after]  FastAPI (EU VPS) ⇄ local network ⇄ PostgreSQL (container on the same VPS)
```

The core design is a **mirror table**: one schema in PostgreSQL where each content document is stored as a handful of promoted columns plus one whole JSONB column holding the original. That JSONB column is a byte-for-byte copy of the document as it exists in the document database. This decision shaped everything downstream: **during the migration, the data shape on both sides is identical**, so the read-layer swap can be extremely thin.

---

## Methodology Breakdown

### Look for the seam that already exists before writing new code

Taking inventory turned up an ace: months earlier, the content pipeline had already been mirroring every document into PostgreSQL on each write to the document database (originally for an unrelated feature). In other words, **dual-write already existed; nobody had treated it as a source of truth**.

That changed the shape of the whole migration. I did not need a new schema, a transformation layer, or a big-bang migration. I only needed to close the gaps in the mirror (two collections that were never mirrored, one field that was never written into the document body), then point the reads at it.

Lesson: **an inventory of what already exists is often worth more than a design document.**

### Same-interface swap: zero changes at the call sites

Every content read in the backend went through one data-access service class. My approach was to write a PostgreSQL version with **identical method signatures**: same names, same parameters, same return shape (whole document returned as a dict). The document store's subcollection reverse-index queries were translated into JSONB array containment queries backed by a GIN index; any method without an equivalent raised immediately rather than silently falling back to the old database.

The swap itself was two lines at the service assembly point. **Nineteen read call sites, not one line changed.** That collapsed the code review from "behavior changes scattered everywhere" to "the correctness of one translation layer" — an order of magnitude less risk surface.

### Feature flags and environment-by-environment promotion

The read cutover sat behind an environment-variable flag, off by default. Promotion order: enable in dev, run comparison checks, staging, observe, prod. Rollback is flipping the flag off, effective in seconds.

The verification was crude and effective: **hit both the old and new path with the same API and compare responses byte for byte**. Trending lists identical, boards in the same order, same-day content appearing immediately — all three green before promoting to the next environment.

### Six phases, each an independently reversible release

1. **Content reads → mirror** (flag-controlled, dual-write continues) — removes 99% of cross-continent reads
2. **Pipeline's own reads → mirror** (dedup checks, service-side API)
3. **User data → native PostgreSQL tables** (the only part needing a new schema: personalized lists, notifications, plus a one-time data migration)
4. **Stop all writes to the document database** — the irreversible point
5. **Media files leave object storage** (next post)
6. **Secrets leave the cloud secret manager** (next post)

The principle behind the split: **at the end of every phase the system is in a state you could happily live in indefinitely**. In fact the spend curve went to zero on the day phase 1 shipped — the remaining five phases were about exiting, not about saving money. That "take 95% of the value first, then tidy up slowly" rhythm meant the migration never spent a single day stuck half-done.

### Write-stop is the irreversible point and deserves different discipline

Through the first four phases, the document database kept receiving writes — it was an **always-fresh fallback copy**, and any phase could be undone by flipping a flag. After phase 4 (write-stop), that insurance expires: the old data starts going stale and "roll back" stops being an option.

So for the write-stop phase I did three things I did not do in any other phase: a soak period before shipping (letting the earlier phases run an extra day in prod); a **final full snapshot** immediately after writes stopped (the source is frozen at that moment, so the snapshot is logically perfect); and a written cutover-day checklist executed by the document rather than from memory.

### Adversarial review: a contrarian second pair of eyes per phase

Throughout the migration I kept one practice: every phase's changes went to an independent review **explicitly instructed to refute the change** — not "take a look" but "find the concrete scenario where this blows up in production, with file and line numbers."

Within three days that practice surfaced fourteen must-fix issues. A representative few:

- **Shallow merge eating nested fields**: the JSONB merge operator is a shallow merge, while the document database's merge writes are deep merges. The divergence only shows up when partially updating a nested object — tests will not hit it, production eventually will.
- **A type error swallowed by a legacy exception handler**: the mirror-write SQL had a type mismatch, but an outer best-effort try/except swallowed it, so it failed silently for days. The bug only surfaced the moment the swallow was removed. Lesson: **best-effort writes plus authoritative reads is a time bomb**.
- **DDL inside a write transaction**: index creation was wrapped in the same transaction as a locking write, so two concurrent writers could deadlock each other.
- **A deploy/backfill timing race**: if a user logged in during the window where the new tables existed but the backfill had not run, a blank row would be minted, and the later backfill would skip that user on a unique-key conflict — permanent data loss. The fix was to let the backfill script adopt rows produced by that race.

None of the fourteen were caught by the test suite, because all of them lived in semantic differences between two systems and in concurrency timing — exactly where unit tests are weakest and adversarial human reasoning is strongest.

---

## Production Optimization

**Documentation lies; only the live environment tells the truth.** During the infrastructure inventory, the docs said the pipeline and backend shared one database instance. SSHing in showed **two** PostgreSQL instances on the VPS — one host-native, one containerized, each with a database of the same name, and the mirror was being written to the one the backend could not reach. Had I trusted the docs and flipped the flag, every read would have 404'd on release. My rule since: **for migration work, verify topology live and treat documentation as a lead, not a fact.**

**The document database's invisible contracts must be rebuilt in SQL, one by one.** Deep-merge semantics on merge writes, field-deletion sentinels, immutable creation timestamps (a downstream consumer used it as the trigger signal for new content) — these are default API behaviors in a document store, and every one of them has to be explicitly reconstructed on the SQL side, each deserving its own test.

**Implicit semantic coupling surfaces during migration.** The notification system's high-water mark was anchored to a "published at" field; only during the migration did I discover this meant late-ingested older content would never trigger a notification. It was re-anchored on an "ingested at" field (database default, never updated on conflict). One of the underrated benefits of a migration is that it forces couplings like this into the open.

**JSONB as a document store is good enough and pleasant to use.** Promoted columns for sorting and joins, JSONB for flexibility, GIN indexes for containment queries. For a gigabyte-scale dataset, query performance was never the bottleneck; the real work was semantic alignment, not tuning.

---

## Visual Plan

### 1. Six-Phase Roadmap
* **Purpose**: One diagram for the phase split and the "you can stop at any phase" property.
* **Placement**: In the six-phase section of the methodology.
* **Caption**: `Phase one takes 95% of the value; the remaining five are about exiting, not saving.`
* **Inspiration**: The migration checkpoint diagrams on the **AWS Architecture Blog**.

### 2. Same-Interface Swap
* **Purpose**: Show the swap surface — nineteen call sites untouched, two lines changed at assembly.
* **Placement**: In the same-interface swap section.
* **Caption**: `Collapse the review from nineteen sites to one translation layer.`
* **Inspiration**: The diagrams in **Uber Engineering**'s strangler-fig migration write-ups.

### 3. Cutover State Machine
* **Purpose**: Mark where the irreversible point sits and what rollback means in each state.
* **Placement**: In the write-stop section.
* **Caption**: `Before write-stop, rollback is a flag. After it, the word does not exist.`

### 4. Adversarial Review Findings
* **Purpose**: Categorize the fourteen must-fixes (semantic divergence / concurrency / timing races / typing) and explain why tests missed them.
* **Placement**: After the adversarial review section.
* **Caption**: `All of them hid in the seam between two systems — weakest ground for unit tests, strongest for adversarial reasoning.`

---

## Conclusion

The migration compresses into three reusable patterns:

1. **Strangler-fig plus same-interface swap**: do not rewrite callers; write a new implementation with the same signatures and swap it at assembly. Risk surface equals one translation layer.
2. **The dual-write window is your only safety net, and write-stop is the only irreversible point**: concentrate all the discipline — soak, snapshot, checklist — on that single point, and every other phase can move fast.
3. **Adversarial review pays for itself**: instructing a reviewer to refute rather than to review produces a completely different output. Fourteen production-grade bombs, none of them found by tests.

The last mile — media files and secrets — is [the next post](/blog/media-secrets-cloud-exit/).

---

## Reference

- **[StranglerFigApplication (Martin Fowler)](https://martinfowler.com/bliki/StranglerFigApplication.html)**: The archetype for incremental same-interface replacement and when it applies.
- **[PostgreSQL JSON Types](https://www.postgresql.org/docs/current/datatype-json.html)**: JSONB containment queries, merge operator semantics, and GIN indexing.
- **[Firestore Data Model](https://firebase.google.com/docs/firestore/manage-data/add-data)**: Deep-merge writes and field-deletion semantics — the invisible contracts most easily missed in a migration.
- **[Stripe Engineering — Online Migrations at Scale](https://stripe.com/blog/online-migrations)**: The classic dual-write / backfill / cutover phased framework.
