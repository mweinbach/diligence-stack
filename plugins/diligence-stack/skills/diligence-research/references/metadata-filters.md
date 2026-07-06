# Metadata Filters for Diligence Stack Search

When calling `mcp__diligence-stack__search`, use the `filters` object to narrow results accurately. Never guess filter values; always verify canonical values using `mcp__diligence-stack__list_catalog` with the appropriate `facet` first.

## Key Filter Arrays

- **`categories`**: Broad thematic groupings defined by the publication (e.g., `["Semiconductors"]`, `["AI Infrastructure"]`, `["Datacenter Power"]`).
- **`tickers`**: Exact uppercase exchange tickers of discussed companies. Useful for finding company-specific estimates or commentary (e.g., `["NVDA"]`, `["MU"]`, `["MSFT"]`, `["TSM"]`).
- **`publishers`**: The authoring entity. Typically `["Creative Strategies"]` or `["The Diligence Stack"]` or specific author names.
- **`evidence_kinds`**: The type of evidence you are looking for. 
  - `["text"]` is the default for finding prose, claims, and written analysis.
  - `["chart"]` or `["image"]` should be used if you specifically need data visualizations, diagrams, or graphical exhibits.

## Document Grouping
Always leave `group_by_document: true` (the default). This ensures search results are returned nested under the reports they belong to, providing you with better context regarding how many distinct reports support a specific claim, rather than flooding you with fragments from a single report.