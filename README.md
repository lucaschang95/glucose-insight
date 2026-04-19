# Glucose Insight

Glucose Insight is a static React app for comparing two CGM glucose cycles from Excel exports. It runs entirely in the browser: users upload two `.xlsx` files, the app parses the `血糖` sheet locally, and it renders a Chinese dashboard with trend charts, key metrics, scoring, and glossary notes.

## Expected Excel Format

- Workbook contains a sheet named `血糖`.
- Row 1 is treated as the header row.
- Column B contains timestamps.
- Column C contains glucose values in `mmol/L`.
- The analysis assumes a 3-minute sample interval.

## Local Development

Install dependencies:

```bash
pnpm install
```

Start the dev server:

```bash
pnpm run dev
```

Build for production:

```bash
pnpm run build
```

Preview the production build:

```bash
pnpm run preview
```

## GitHub Migration Notes

This project is configured as a frontend-only repo. The current remote is:

```bash
git@github.com:lucaschang95/glucose-insight.git
```

After implementation, use plain Git to publish because the GitHub CLI is not installed in this environment:

```bash
git branch -M main
git push -u origin main
```
