---
name: diligence-research
description: "Use when conducting research on AI infrastructure, semiconductors, memory/storage, datacenters, or hyperscalers using the Diligence Stack MCP server. Triggers on: 'search Diligence Stack', 'query Diligence Stack', 'fetch Diligence Stack evidence', 'find Diligence Stack reports', 'look up semiconductor / AI research'."
metadata:
  triggers: "search Diligence Stack, query Diligence Stack, fetch evidence, research semiconductors"
---

# Diligence Research

This skill directs the systematic retrieval, ingestion, and citation of institutional investment-research evidence from the Diligence Stack (Creative Strategies / Ben Bajarin) via its dedicated MCP server tools. 

## Procedure

1. **Catalog and Constraint Discovery**
   Before filtering by parameters, discover the current state of the authorized corpus to ensure searches use valid and current constraints. Call `mcp__diligence-stack__list_catalog` (with and without `facet` parameters) to retrieve the active date boundaries, valid knowledge bases, categories, and tickers. **Never guess filter values.**
   
2. **High-Precision Evidence Searching**
   Use `mcp__diligence-stack__search` as your primary entry point for finding specific claims, numbers, and excerpts. Keep queries descriptive, objective, and keyword-focused. Apply specific metadata filters. 
   *(See `references/metadata-filters.md` for details on structuring search constraints).*

3. **Fetching Un-truncated Evidence and Links**
   Search results often return truncated summaries. Always use `mcp__diligence-stack__fetch` to retrieve the full, un-truncated derived text or media details behind specific `evidence_ids`. 
   **Crucial:** Always include `"original_link"` in the `include` array (along with `"text"`) to fetch the authenticated direct URL to the source report.

4. **Deep Document Reading**
   If a search result points to a highly relevant report or a specific section requires thorough reading, retrieve full document page ranges using `mcp__diligence-stack__get_document`. Specify the `pages` object with a strict `from` and `to` page range.

5. **Financial Model Inspection**
   When quantitative questions involve company models or market forecasts, use `mcp__diligence-stack__list_financial_models` to browse published financial workbooks. Use `mcp__diligence-stack__read_financial_model` with the exact `modelSlug`, `datasetId` and `filters` to pull clean, normalized data grids.

6. **Attribution and Citation**
   Every claim or quantitative figure extracted from the Diligence Stack must be cited properly. 
   *(See `references/citation-rules.md` for mandatory attribution, hyperlink formats, and how to handle estimates).*

## Resources

- **`references/metadata-filters.md`** — The strict definitions for search constraints (categories, tickers, publishers, evidence kinds) used in step 2.
- **`references/citation-rules.md`** — Mandatory formats for attributing claims, estimates, and providing authenticated links used in step 6.