---
title: 'The Last Mile of a Cloud Exit: Moving 140GB of Media and Every Secret Onto My Own VPS'
description: 'Large immutable files and small highly sensitive config are the two poles a database migration never covers: an in-place storage-layer swap, a three-tier secret resolution order, half-finished-work archaeology, and the discipline of export, off-site backup, reconcile, only then delete.'
lang: 'en'
pubDate: 'Aug 5 2026'
tags: ['engineering']
heroImage: '../../assets/blog/covers/cloud-exit.png'
---

> Series: "A Bill That Triggered a Cloud Exit", part 3 of 3
> Previous: [A Six-Phase Data Layer Exit Playbook](/blog/document-db-to-postgres-migration/)

## Introduction

After the database move, two loose ends remained on the bill: roughly 140 GB of media files sitting in object storage (podcast audio, transcripts, summary cards) and fifty-odd secrets in the cloud secret manager. Both cost on the order of a hundred NTD a month — honestly, leaving them alone would have been fine.

I finished the last mile anyway, for two reasons. First, if the goal is to stop depending on that cloud, two live dependencies means the exit did not happen. Second, these two tails represent a very characteristic pair of migration problems — **large immutable files** and **small highly sensitive configuration** — precisely the two poles the database migration did not cover.

This post records both small migrations, and the deletion discipline at the end.

---

## Architectural Overview

Media serving, before and after:

```
[before] frontend → public object storage URL (files in the US, signed-URL expiry management)
[after]  frontend → reverse proxy (Caddy) /media route → local disk file_server on the VPS
```

Secret management, before and after:

```
[before] CI/CD and service startup each call the cloud secret manager API
[after]  CI secrets live in the CI platform's encrypted storage; runtime secrets live in a
         root-only env file on the VPS; resolution order in code:
         environment variable → env file → cloud (transitional fallback)
```

---

## Methodology Breakdown

### Media: swap the storage layer in place, touch no callers

The database migration used a same-interface swap; for media I used a variant of the same trick: **keep the object-storage service class name and method signatures, and replace the implementation with atomic writes to local disk** (write a temp file, then rename, which is atomic within one filesystem). The on-disk directory layout was deliberately made byte-for-byte identical to the original bucket paths — so migrated old files and freshly written new files land in the same structure, and the URL rewrite becomes a pure prefix replacement.

The transfer itself used rclone to pull from object storage to the VPS, resumable. Egress on 140 GB cost about five hundred NTD — the toll for leaving the cloud, paid once.

### URL rewrite: one-time surgery on the data layer

Media URLs in three thousand-odd content documents all pointed at the old object storage domain. The rewrite was conservative to the point of boring: back the whole table up into a backup table, then rewrite the JSONB with a single idempotent string prefix replacement, and immediately verify that the count of rows still containing the old domain equals zero.

Idempotence here was not fastidiousness but a lifeline — as described below, my own sequencing mistake meant that SQL ran three times in total.

### Half-finished-work archaeology: two naming conventions colliding

While wiring up the reverse proxy route I discovered Caddy **already had a /media route** — left over from an abandoned migration attempt six months earlier, along with a half-rsynced 43 GB tree of old files, using a different directory naming convention (abbreviated bucket name versus full bucket name).

That is a textbook half-finished trap: adopt the old convention and the new code has to accommodate it; adopt the new one and the old tree is 43 GB of dead weight hiding a stale script that would rewrite URLs to a path nobody serves. My call: **pick the full bucket name as the single convention, delete the stale script, delete the old tree, and add a bucket-name allowlist in code** (unknown bucket names raise instead of silently creating directories). It also brought disk usage from 93% back to 75%.

Lesson: on exit-shaped projects the main adversary is usually not the new code, but **the version of yourself who left something half-done**.

### Secrets: an ordered cutover, not a big-bang switch

The nightmare in a secrets migration is being halfway through and having a deploy die on a variable with no value. My fix was to make the resolution order in code **environment variable → env file → cloud fallback**, then move in three steps:

1. Move the nine secrets CI/CD needs into the CI platform's encrypted storage through a pipe (read from the source API, pipe straight into the target CLI, so values never touch disk or shell history).
2. For the forty-odd runtime secrets, run a script on the VPS that pulls from the cloud API and writes them directly into a root-only env file — the values never leave that machine.
3. Watch the source markers in the service startup log (which layer each secret resolved from, names only, never values) until fallback hits reach zero. That is when the cutover is complete.

The hardest thing to move was an automation that **writes** a secret: a third-party platform token that rotates every 60 days, with the rotation job writing the new value back into the cloud secret manager. The CI platform's secrets have no convenient programmatic write path, so that job had to stay in the cloud and became the last living dependency of the whole exit — a reminder that **when taking inventory of secrets, "who writes" is a more important question than "who reads."**

### Deletion discipline: export, off-site backup, reconcile, only then delete

The final deletion followed this order:

1. Take an official export of the document database (155 MB) into object storage.
2. Back up the entire object storage bundle (including that export) to **a different physical location** (a machine at home) — routed VPS → home, because VPS egress is not metered, saving a second cross-cloud toll.
3. Reconcile: compare **file counts one by one** between local and VPS (close to thirty thousand files on each side, counts identical), with the size difference confirmed as a filesystem accounting difference.
4. Only after reconciliation passes, delete in order: database, then the three buckets.
5. Confirm zero afterwards by listing through the API.

After that, the data exists in two physical locations (VPS as the live copy, home machine as the cold backup) and zero copies in the cloud.

---

## Production Optimization

**My own sequencing mistake: a frozen snapshot overwrote the URL rewrite.** After write-stop I ran a final full snapshot to sync the document database's frozen state into the mirror — but the URLs in that snapshot were the old domain, and in one shot it reverted three thousand-odd already-rewritten URLs. Luckily the old bucket was still alive at that point (no outage), and the rewrite SQL was idempotent, so a rerun restored it. Lesson: **the ordering between "data sync" and "data rewrite" operations belongs explicitly in the plan**, especially when the sync source is a frozen snapshot of the old world.

**Disk headroom management is the hidden cost of self-hosting.** The moment 140 GB landed, VPS disk usage hit 97% — and the database lives on the same volume. Cleanup order: container build cache (12 GB), dangling images, the duplicate six-month-old file tree (43 GB). Self-hosting removes the cloud default of effectively unlimited storage; watching headroom is now routine.

**A migration is the best security audit you will run.** While verifying listening ports host by host to draw the topology, I found services bound to 0.0.0.0 and reachable from outside — including a database and an internal API with write endpoints. All pulled back to loopback with the reverse proxy as the single ingress. This has nothing to do with the bill and may be the most valuable finding of the whole project: **a migration forces you to lay every port and every route back on the table**, which nothing else ever gives you a reason to do.

**Signed URLs to public URLs is a posture decision, not a technical one.** Moving to a file server turned media from expiring signed URLs into stable public URLs. For my content type — media that was going to be published anyway — that is acceptable, but it deserved to be stated and signed off rather than happening quietly inside a migration. This was a point the adversarial reviewer insisted I decide explicitly. The same review caught a related issue: the upload path discarded the validated Content-Type and trusted the extension in the client-supplied filename instead, which on a public domain is an open door to stored XSS. The fix was to always derive the extension from the validated MIME type.

---

## Visual Plan

### 1. Media Serving Before / After
* **Purpose**: Contrast signed URLs plus cross-continent object storage against reverse proxy plus local disk.
* **Placement**: After the architecture section.
* **Caption**: `Same URL field; an ocean behind it becomes a loopback.`
* **Inspiration**: The origin/edge topology diagrams on the **Cloudflare Blog**.

### 2. Deletion Checklist
* **Purpose**: Export, off-site backup, file-count reconciliation, delete, confirm empty — as a saveable image.
* **Placement**: In the deletion discipline section.
* **Caption**: `Deletion is the only deploy with no rollback button.`

### 3. Secret Resolution Order
* **Purpose**: The three-tier resolution — environment variable, env file, cloud fallback — and "fallback hits reach zero" as the completion criterion.
* **Placement**: In the secrets section.
* **Caption**: `The cutover is done the day fallback hits reach zero, not the day the values are copied.`

### 4. Series Map
* **Purpose**: The full path from "this bill looks wrong" to "zero cloud footprint": SKU breakdown, cost model, stop the bleeding, move reads, move writes, move files, move secrets, delete.
* **Placement**: Before the conclusion.
* **Caption**: `The trilogy on one page.`

---

## Conclusion

Three posts in, the whole incident compresses into one decision procedure:

**Break the bill down to SKUs → find behavioral signatures in the monitoring curves → build a cost model → cut the coefficient first (stop the bleeding) → then cut the structure (migrate) → phase it so every phase is reversible → concentrate discipline at the irreversible point → delete only after a reconciled backup.**

As for whether to be on the cloud at all, my answer has become quite concrete: when your workload is **read-heavy, small in data, predictable in traffic, and staffed by one person**, a fixed-monthly-cost VPS plus PostgreSQL wins on nearly every axis — provided you are willing to take back disk monitoring, backup discipline, and security auditing, which the cloud was quietly doing for you. What the cloud actually sells is never the machines; it is that invisible operations work. This exit was me taking those back one at a time, with two practices — phased flag promotion and adversarial review — keeping the risk bounded.

A monthly bill from forty thousand back to zero, data back in my own hands, and two security holes closed along the way. This mile was worth walking.

---

## Reference

- **[Caddy file_server Directive](https://caddyserver.com/docs/caddyfile/directives/file_server)**: Static file serving, Range request support, and routing behind a reverse proxy.
- **[rclone Documentation](https://rclone.org/docs/)**: Cross-cloud transfers, resumable copies, and consistency-check flags.
- **[OWASP — Unrestricted File Upload](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)**: The attack surface around extension and MIME type validation, especially on a public domain.
- **[Backblaze — The 3-2-1 Backup Strategy](https://www.backblaze.com/blog/the-3-2-1-backup-strategy/)**: The backup discipline to have in place before deleting a cloud copy.
- **[GitHub Docs — Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)**: The storage model for CI secrets and the limits on programmatic writes.
