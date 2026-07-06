---
name: diligence-research
description: "Use when conducting research on AI infrastructure, semiconductors, memory/storage, datacenters, or hyperscalers using the Diligence Stack MCP server. Triggers on: 'search Diligence Stack', 'query Diligence Stack', 'fetch Diligence Stack evidence', 'find Diligence Stack reports', 'look up semiconductor / AI research'."
---

# Diligence Research

This skill directs the systematic retrieval, ingestion, and citation of institutional investment-research evidence from the Diligence Stack (Creative Strategies / Ben Bajarin) via its dedicated MCP server tools. It details how to discover available data, structure queries, fetch complete source context, and reference source-linked evidence.

## Core Process

### 1. Catalog and Constraint Discovery

Before performing keyword searches or filtering by specific parameters, discover the current state of the authorized corpus to ensure searches use valid and current constraints.

- Call `mcp__diligence-stack__list_catalog` with no parameters to retrieve the overall dates, available knowledge bases, and fresh summary statistics of the corpus.
- Call `mcp__diligence-stack__list_catalog` with `facet` parameters (e.g., `"publishers"`, `"tickers"`, `"categories"`, `"document_types"`, or `"evidence_types"`) to find the exact canonical filter values used in the index.
- Never guess or extrapolate filter values. Only apply category, ticker, and publisher filters that have been explicitly confirmed in the catalog facet listings.

### 2. High-Precision Evidence Searching

Query the index using keyword terms and structured metadata constraints.

- Use `mcp__diligence-stack__search` as your primary entry point for finding specific claims, numbers, and excerpts.
- Keep the `query` string descriptive, objective, and keyword-focused (e.g., `"NVIDIA Blackwell shipment delays"` or `"high bandwidth memory HBM3e yield"`). Avoid conversational filler or logical/boolean operators.
- Restrict searches using exact metadata filters under the `filters` object:
  - `categories`: String array using verified catalog groupings (e.g., `["Semiconductors"]`, `["AI Infrastructure"]`).
  - `tickers`: Uppercase exchange tickers (e.g., `["NVDA"]`, `["MU"]`, `["MSFT"]`).
  - `publishers`: Authors/publishers (e.g., `["Creative Strategies"]`, `["The Diligence Stack"]`).
  - `evidence_kinds`: Set to `["text"]` for textual citations, or include `["chart"]`/`["image"]` if looking for graphics or visual exhibits.
- Ensure `group_by_document` is kept `true` (default) to group raw search results by their source document, which provides immediate context on how the findings are distributed.

### 3. Fetching Un-truncated Evidence and Authenticated Links

Search results often return truncated summaries or previews. Always retrieve the complete context for citations and user-facing deliverables.

- Use `mcp__diligence-stack__fetch` to retrieve the full, un-truncated derived text or media details behind specific evidence IDs.
- Supply an array of `evidence_ids` to retrieve multiple items in a single call.
- Always include `"original_link"` in the `include` array (along with `"text"`) to fetch the authenticated direct URL to the source report on Substack.
- Include `"image"` in the `include` array if the evidence item is a chart or visual exhibit to pull the authenticated direct image URL.

### 4. Deep Document Reading

When a search result points to a highly relevant report or a specific section requires thorough reading, retrieve full document page ranges.

- Use `mcp__diligence-stack__get_document` to read full pages of a report.
- Pass the `asset_id` (obtained from document grouping metadata in search results).
- Specify the `pages` object with a strict `from` and `to` page range (e.g., `{"from": 1, "to": 5}`) to pull precise sections of the PDF.
- Use the `cursor` returned by the tool to paginate through longer documents.

### 5. Financial Model Inspection

When quantitative questions involve company models, shipment estimates, or market forecasts, check for existing structured spreadsheets.

- Use `mcp__diligence-stack__list_financial_models` to browse published financial workbooks. Use short, distinctive query terms (e.g., `"Blackwell"` or `"DRAM"`) to filter by title or tags.
- Use `mcp__diligence-stack__read_financial_model` with the exact `modelSlug` to inspect its schemas, sheet inventory, metrics, and dataset columns.
- To retrieve structured, normalized quantitative rows, call `mcp__diligence-stack__read_financial_model` with a `datasetId` and `filters` (e.g., `[{"column": "dataType", "value": "Forecast"}]`).
- Only use raw `sheetName` and `workbookFileName` parameters when normalized data is unavailable and you need targeted cells, formulas, or footnotes. Use the `cursor` to paginated large datasets.

## Attribution and Citation Rules

Every claim or quantitative figure extracted from the Diligence Stack must be cited.

- Attribute the information explicitly to **The Diligence Stack** or **Creative Strategies** with the corresponding publication date (obtained from the search/fetch metadata).
- Format citations with inline hyperlinks to the original reports. Use the `original_link` returned from `mcp__diligence-stack__fetch` (e.g., `[Diligence Stack (July 2026)](https://www.thediligencestack.com/p/...)`).
- Never link to unconfirmed URLs or invent citation links. If `original_link` is absent, output the text-only citation (e.g., `[The Diligence Stack, July 2026]`) and keep it unlinked.
- Present estimates as ranges with an explicit "Estimated" or "Derived" source tag rather than presenting them as absolute, official facts.
