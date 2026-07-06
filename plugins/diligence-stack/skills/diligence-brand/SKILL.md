---
name: diligence-brand
description: "Use when creating charts, graphs, tables, or markdown documents for The Diligence Stack. Triggers on: 'format as Diligence Stack', 'apply Diligence Stack brand', 'make a chart for Diligence Stack'."
metadata:
  triggers: "apply brand, format chart, make a chart, format as Diligence Stack"
---

# Diligence Stack Brand Guidelines

When generating visual assets, data charts, HTML, or styled markdown for The Diligence Stack, you must strictly adhere to the following branding guidelines.

## Color Palette

Never use default library colors (like matplotlib/tailwind defaults). Only use this palette:
- **Diligence Orange**: `#FF6719` (Primary accent, used for the main data series or highlighting key insights)
- **Stack Gold**: `#FBBB14` (Secondary accent, used for comparison series or secondary highlights)
- **Charcoal**: `#363737` (Primary background for dark-mode charts, or primary text color for light backgrounds)
- **White**: `#FFFFFF` (Background for standard documents, or text color on Charcoal backgrounds)
- **Subtle Gray**: `#E5E7EB` (For borders, axis lines, or faint UI elements)

## Typography

- Always use the **Inter** font family. If Inter is unavailable, fallback to system sans-serif (`system-ui, -apple-system, sans-serif`).
- Headings should be bold, clean, and unadorned.

## Chart Styling (Matplotlib / Web)

1. **Clean aesthetics**: Remove top and right spines/borders.
2. **Minimal grid**: Only use horizontal gridlines (y-axis), make them faint, dotted, or low opacity, and remove vertical gridlines.
3. **Colors**: If creating a line or bar chart, use `#FF6719` for the primary data and `#FBBB14` for the secondary data.
4. **Branding attribution**: Always add "Source: The Diligence Stack" in a small, muted font at the bottom left or right of any generated image or chart.

## Markdown & Prose Styling

- Keep formatting clean. Use standard markdown headers (`##`).
- Do not use emojis anywhere in the output unless specifically requested.
- Present data cleanly in standard markdown tables when appropriate, avoiding over-engineered HTML unless specifically building an interactive component.