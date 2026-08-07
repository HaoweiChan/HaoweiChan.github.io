---
title: 'Automating Portfolio Tracking and Broker Report Ingestion: From Encrypted PDFs to Daily Account Equity Pipelines'
description: 'Resident Personal Assistant Series: Parsing encrypted PDF statements, integrating multi-broker APIs, handling T+2 settlement lags, and building automated research report crawlers.'
pubDate: 'Mar 15 2026'
tags: ['agents', 'quant']
series: 'resident-assistant'
heroImage: '../../assets/blog/covers/resident-personal-assistant.png'
---

## Introduction

In building a Resident Assistant System, the primary engineering value is not how fluently a large language model chats, but whether it provides stable, precise, and uncompromised personal data and market intelligence.

When tracking investments and personal portfolios, we face two persistent manual pain points:
1. **Multi-Account Equity Fragmentation**: International brokerages, domestic futures, and stock accounts each live behind separate login interfaces or encrypted PDF emails. Manually logging into every platform daily is slow and error-prone.
2. **Market Report Information Overload**: Research institutions and brokerages publish numerous daily research notes and sector breakdowns. Without automated ingestion and structured indexing, these reports disappear into email noise.

To equip a resident personal assistant with trustworthy financial awareness and research capabilities, I built an automated pipeline using Python and Cron schedules: parsing encrypted daily PDF statements, querying brokerage APIs, calculating T+2 settlement adjustments, and crawling market research reports into a structured knowledge base.

---

## Architectural Overview

The automated tracking pipeline operates across two decoupled tracks: "Account Equity Calculation" and "Broker Research Report Ingestion":

```mermaid
flowchart TD
    subgraph Sources ["External Data Sources"]
        Gmail["Email Inbox (Encrypted PDFs)"]
        BrokerAPI["Broker REST / Trading APIs"]
        Webcrawlers["Broker Research Web Portals"]
    end

    subgraph Processing ["Automated Processing Pipeline (Python Workers)"]
        PDFParser["PDF Decryption & Text Extractor"]
        APIFetcher["API Equity Fetcher"]
        SettlementCalc["T+2 Settlement Calculation"]
        ReportCrawler["Report Crawler & Summary Extractor"]
    end

    subgraph Vault ["Plain-Text Storage Layer (Obsidian Vault & Git)"]
        EquityHistory["Daily Equity Series (equity_history.json)"]
        DailyJournal["Daily Journal Entries (journal/daily/)"]
        ReportVault["Report Knowledge Base (sources/reports/)"]
    end

    Gmail --> PDFParser
    BrokerAPI --> APIFetcher
    APIFetcher --> SettlementCalc
    Webcrawlers --> ReportCrawler

    PDFParser --> EquityHistory
    SettlementCalc --> EquityHistory
    EquityHistory --> DailyJournal
    ReportCrawler --> ReportVault
```

The core principle: **Data ingestion, math, and storage run strictly via deterministic Python scripts; LLMs are reserved for downstream natural-language synthesis and query handling.**

---

## Methodology Breakdown

### 1. Cracking the Black Box: Automated Parsing of Encrypted PDF Statements

Local futures brokers rarely provide open REST APIs for retail accounts. Instead, they email encrypted daily statement PDFs after market close.

To extract exact balance figures without relying on brittle OCR (which is slow and misreads numbers), I built a pure Python pipeline:
* **Inbox Monitoring**: Scheduled scripts scan the inbox for specific statement email subjects and download PDF attachments into isolated local staging folders.
* **In-Memory Decryption**: Python PDF libraries unlock the file using environment-based credentials without writing unencrypted files to disk.
* **Structured Text & Table Extraction**: Text extraction primitives locate exact target anchors (such as "Margin Equity" or "Net Account Value") and extract numbers via deterministic regular expressions.

This pure-code approach guarantees 100% numerical precision, eliminating OCR misread risks.

### 2. Handling T+2 Settlement Lags

When calculating total Net Asset Value (NAV) for stock accounts, I encountered a classic engineering pitfall: **The T+2 Settlement Lag**.

When stock is sold on day T, the shares leave the depository account immediately, but sale proceeds do not clear into the settlement bank account until day T+2. If NAV is calculated naively as `Bank Cash + Stock Market Value`, the portfolio value experiences a artificial drop on the trade date, followed by an artificial jump on T+2.

```mermaid
flowchart LR
    TradeDay["Trade Date T: Sell Stock"] --> StockDeduct["Immediate Stock Value Deduction"]
    TradeDay --> PendingAdd["Generate Pending T+2 Receivable"]
    PendingAdd --> T2Clear["T+2 Settlement: Cash Clears in Bank"]
```

To eliminate artificial swings, the equity calculator applies a **Settlement Adjustment Formula**:
* `Total Account Value = Settled Bank Cash + Pending Receivables/Payables (T+1/T+2) + Current Stock Market Value`.
* Fetching pending settlement line items directly from the broker API maintains smooth, accurate NAV tracking throughout the settlement cycle.

### 3. Multi-Broker API Ingestion and Auto-Plotting

For brokers offering open REST or SDK endpoints, scripts periodically query current liquidation value and margin equity.

Every night after market close (e.g. 23:00), a consolidation job:
* Appends daily equity snapshots into local JSON history files.
* Invokes plotting modules to render multi-account equity growth charts.
* Formats net values and daily percentage changes into Markdown tables, automatically updating the daily journal entry.

### 4. Broker Research Ingestion & Knowledge Base Indexing

Beyond portfolio tracking, daily crawler crons:
* Scan and download research PDF reports from participating institutions.
* Extract target prices, rating changes, and core thesis summaries.
* Organize raw PDFs and Markdown summaries into local Vault folders indexed by ticker symbols and sectors, allowing the assistant to retrieve original PDF files instantly in chat.

---

## Production Optimization & Lessons

### 1. Never Substitute "Last Known Value" for "Today Data"

In early iterations, when an email was delayed or an API timed out, filling yesterday's figure as today's data led to undetected multi-day data stagnation. Fix: **Mark missing data explicitly (`Data Missing`) and emit log warnings** until backfilled.

### 2. Irregular Email Arrival Times

Statement delivery times vary (some arrive at 18:00, others at 21:30). To prevent missed runs, the scheduler employs a **4-Day Rolling Window Backfill**: every execution checks and fills missing statement data over the previous 4 days.

### 3. Safeguarding Against PDF Layout Changes

Brokers occasionally modify statement PDF layouts. To prevent parser errors from injecting corrupt numbers, the parser enforces **Reasonableness Boundary Checks**: if extracted equity shifts by more than a preset daily percentage threshold, persistence is blocked and an alert is raised for manual review.

---

## Visual Plan

### Figure 1: Two-Track Data Pipeline Topology
* **Purpose**: Illustrate separate tracks for equity calculations and research report ingestion.
* **Placement**: Section 1 (Architecture).
* **Caption**: `Dual-track data pipeline: Left track processes encrypted PDFs and APIs; right track handles report crawlers and indexing.`

### Figure 2: T+2 Settlement Adjustment Curve
* **Purpose**: Compare unadjusted artificial NAV drops against adjusted smooth settlement curves.
* **Placement**: Section 2 (Methodology).

---

## Conclusion

A trustworthy resident assistant rests upon **high-reliability, low-maintenance data engineering**.

By combining Python PDF decryption, multi-broker API queries, T+2 settlement adjustments, and plain-text Git Vault sweeps, we established an automated personal equity and research engine without exposing private keys or credentials.

---

## Reference

- **[Python pikepdf Documentation](https://pikepdf.readthedocs.io/)**: High-performance QPDF-based PDF manipulation and decryption library.
- **[pdfplumber Documentation](https://github.com/jsvine/pdfplumber)**: Precision PDF text, table, and layout extraction tool for Python.
- **[Python matplotlib Documentation](https://matplotlib.org/)**: Automated chart rendering and visualization.
