---
title: 'When the Cloud Bill Jumps 20x Overnight: A Full Forensic Trail of a Database Traffic Leak'
description: 'The bill went from a few hundred NTD to over forty thousand, and nobody broke in — every cent was spent by my own code. A five-layer drill-down from invoice total to function name, and why payload x distance costs more than read count.'
lang: 'en'
pubDate: 'Aug 3 2026'
heroImage: '../../assets/blog/covers/cloud-exit.png'
---

> Series: "A Bill That Triggered a Cloud Exit", part 1 of 3
> Next: [A Six-Phase Playbook for Migrating from a Document Database Back to PostgreSQL](/blog/document-db-to-postgres-migration/)

## Introduction

At the start of one month I opened the cloud bill and found a project that normally costs a few hundred NTD sitting at over forty thousand.

The first reaction was, of course, "my card got skimmed." But I quickly landed on a more embarrassing fact: nobody broke in. Every cent was spent by code I wrote myself. The side project is a content platform for financial podcasts — it turns audio streams into transcripts and summaries, then links them to market ticker data. Traffic is small, users number in the single to double digits, and by any reasonable estimate it should be impossible to burn that much.

What I want to record here is not how bad it felt, but the investigation itself: how to go from a single invoice total down to "which two functions, at what frequency, burned which billing line item." Looking back, the procedure is more valuable than the conclusion, because it transfers to any situation where a bill looks wrong.

---

## Architectural Overview

Here is what the system looked like when it happened:

```
Users → Edge frontend (CDN hosted)
      → FastAPI gateway (Docker on a European VPS, three stacks: dev / staging / prod)
      → Redis cache (local to the VPS)
      → Document database (cloud managed, data center in the central US)
      → Async content pipeline (uv workspace: transcription, summarization, entity extraction)
```

The critical geographic fact: **compute in Europe, data in the US**. That layout was an accident of history — the document database was chosen early for development speed, the VPS came later for cost reasons, and the two were never examined on the same map. Every backend request for data dragged a payload across the Atlantic.

There was also an easily missed multiplier: dev, staging, and prod all ran on the same VPS and **shared one cloud document database**. Any "do this every N minutes" background loop effectively ran at three times its nominal frequency.

---

## Methodology Breakdown

A five-layer drill-down, from invoice total to function name.

### Layer 1: from service-level to SKU-level billing

The billing page groups by service by default, which can only tell you "the document database is 99% of it." The informative move is to slice to the **SKU level** (individual billing line items). My breakdown looked roughly like this:

| Billing line item | Share | What I expected |
|---|---|---|
| Internet data transfer out | ~78% | Never crossed my mind |
| Document read operations | ~17% | Assumed this was the cause |
| Everything else (storage, writes, secrets) | under 1% | As expected |

This single step falsified my first hypothesis. I assumed "too many reads" was the problem; in reality **bytes moved per read x intercontinental distance was the body of the bill**. Reads cost a few NTD per hundred thousand operations, while egress costs a bit over three NTD per GiB — when documents average a dozen-plus KB and you read twenty million times a day, egress lands at four to five times the read cost.

### Layer 2: the monitoring time series

A bill has amounts, not behavior. The next step was pulling the **daily operation-count time series** from cloud monitoring:

- Document reads: a steady ~20+ million per day
- Document writes: roughly twenty to thirty thousand per day
- Read/write ratio: close to 1000:1

Then I dropped the granularity to hourly: **reads were flat around the clock**, with 3am nearly as high as 8pm.

That was the single most diagnostic signal in the whole investigation. Human traffic has a day/night rhythm; timers do not. A read curve that is level across 24 hours is close to a verdict on its own: **the culprit is a schedule, not a person**.

### Layer 3: read/write ratio versus data volume

How big is the database itself? Under 1 GB. Twenty million reads a day means **re-reading the entire database more than ten thousand times daily**. No legitimate product behavior produces that ratio; only a "recompute everything every few minutes" loop does.

### Layer 4: code scan — an inventory of every read path

Next I went back to the code and inventoried **every database read call site** across both tiers, backend and pipeline: what triggers it (a request? a timer?), does it scan a whole collection or fetch a single document, is there a cache in front, and how many documents does one execution read.

The inventory pointed at two refresh-ahead cache warming loops:

1. **Trending tags board**: every 10 minutes, with a force-refresh flag that skipped the cache read, it scanned the entire tag collection (which had accumulated thousands of legacy noise tags), then did up to several hundred N+1 document fetches per valid tag — and the same document was refetched by different tags with no deduplication.
2. **Topic sector board**: a full scan of several thousand content documents every 5 minutes.

Two loops x three environments x round the clock matched the flat shape of the monitoring curve precisely, and the estimated read volume matched the twenty-million-per-day figure. Case closed.

### Layer 5: build a cost model, then order the fixes

Finally I turned the unit prices into a rough model:

> Monthly cost ≈ read count x read unit price + read count x average document size x egress unit price

Plugging in numbers produced two conclusions. First, **cutting the payload per read matters as much as cutting the read count**, because the egress term carries the larger coefficient. Second, as long as data and compute live in different places, the second term never goes away — which is the seed of the entire data-layer migration that followed (the subject of the next post).

---

## Production Optimization

**Refresh-ahead backfiring.** Both loops were well intentioned: move expensive recomputation off the request path so users always hit a warm cache. The failure was in three implementation details. The loops used a force-refresh flag that bypassed the cache read (so the cache only ever got written, never read — decorative at that point); the refresh interval (5–10 minutes) was far shorter than the interval at which the data actually changed (content arrives in a few batches per day); and the loops ran in **every environment**, including dev and staging where nobody was looking. The fix was the inverse of all three: turn them off outside production, drop the frequency to hourly, and make the cache TTL exceed the refresh interval so "warming" means something again.

**"How often does the data change" is the only anchor for a refresh interval.** The rule I gave myself afterwards: before scheduling any recomputation, answer how often the upstream data changes. My content arrived in a few batches a day while the board recomputed every 5 minutes — 287 out of every 288 runs were pure spend.

**Empty results must not be cached for long.** This one was caught by a second pair of eyes doing an adversarial review during the fix: when upstream has a brief outage, the recomputation returns an empty set, and writing that empty set into a long-TTL cache turns one blip into a blank board for an hour or two. The fix is to skip caching empty results and let the next request retry naturally.

**Budget alerts belong on day one.** This leak ran for a full month before the monthly invoice exposed it. Afterwards I added budget alerts at 50%, 90%, and 100%. On a burn-rate basis, alerting turns "found it a month later" into "found it within two days" — a 20x difference in the bill.

**Quantify the fix from monitoring, not the bill.** After the hotfix shipped, reads per 6-hour window fell from roughly six million to a hundred and ten thousand, a 98% reduction. The lesson is to verify against **monitoring metrics** rather than billing: billing lags by a day or two, monitoring is hourly.

---

## Visual Plan

### 1. Failure Mode Map
* **Purpose**: One diagram for the whole loop — timer, cache bypass, full scan, intercontinental egress — plus the x3 environment multiplier.
* **Placement**: After layer 4 of the methodology.
* **Caption**: `Two well-meaning cache warming loops, multiplied by three environments and one Atlantic Ocean.`
* **Inspiration**: The request-flow annotation style used in **Netflix Tech Blog** caching articles, drawn with an Excalidraw hand-sketched feel.

### 2. Investigation Funnel
* **Purpose**: Show the convergence across five layers (invoice total, SKU, time series, read/write ratio, call-site inventory).
* **Placement**: At the top of the methodology section.
* **Caption**: `Every layer halves the suspect list.`
* **Inspiration**: The funnel and staircase charts common on the **Stripe Engineering Blog**.

### 3. Before / After Read Volume
* **Purpose**: A 6-hour-granularity read time series with the hotfix and the read migration marked.
* **Placement**: Next to the quantified verification paragraph.
* **Caption**: `Six million to a hundred and ten thousand: two deploys, one order of magnitude each.`
* **Inspiration**: **Grafana** dashboard screenshots, redrawn after de-identification.

### 4. Cost Composition
* **Purpose**: Break the intuition that read count is what costs money, and highlight payload x distance.
* **Placement**: After layer 1 of the methodology.
* **Caption**: `The body of the bill is not how often bytes are read, but how far they travel.`

---

## Conclusion

Three portable lessons from this incident:

1. **A bill only carries information at the SKU level.** Service-level grouping tells you "the database is expensive"; SKU-level tells you "egress is expensive, not reads" — and those two have completely different fixes.
2. **A flat usage curve means suspect the timers.** Any resource curve uncorrelated with human waking hours: check schedules first, traffic second.
3. **The cost model is an input to architecture decisions.** The `payload x distance` term does not disappear while data and compute sit on different continents. Stopping the bleeding only shrinks a coefficient; moving house removes the term — which is the story of [the next post](/blog/document-db-to-postgres-migration/).

---

## Reference

- **[Firestore Pricing](https://cloud.google.com/firestore/pricing)**: The billing model and price magnitudes for document reads, writes, and network egress.
- **[Google Cloud VPC Network Pricing](https://cloud.google.com/vpc/network-pricing)**: Intercontinental egress price tiers, and why they often exceed operation-count charges.
- **[AWS Caching Best Practices](https://aws.amazon.com/caching/best-practices/)**: Trade-offs and failure modes of refresh-ahead versus cache-aside.
- **[Google SRE Workbook — Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)**: How to treat runaway spend as an SLO violation when designing alert thresholds.
