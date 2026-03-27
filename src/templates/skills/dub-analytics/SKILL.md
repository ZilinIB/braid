---
name: dub-analytics
description: "Query Dub.co link analytics: total clicks, top links, country/device/referrer breakdown, timeseries, and link management. Use when asked about short link performance, growth metrics, click-through rates, geo distribution, or UTM tracking results."
allowed-tools: Bash(dub-analytics*), Bash(curl*api.dub.co*)
---

# Dub.co Analytics

Use `dub-analytics` CLI to query link performance. The tool is pre-authenticated — no API key needed in commands.

## Commands

### Summary (total clicks, leads, sales)
```bash
dub-analytics summary        # last 30 days (default)
dub-analytics summary 7d     # last 7 days
dub-analytics summary 90d    # last 90 days
```

### Top links by clicks
```bash
dub-analytics top-links       # last 30 days
dub-analytics top-links 7d
```

### Geographic breakdown
```bash
dub-analytics countries 30d
```

### Device breakdown
```bash
dub-analytics devices 30d
```

### Referrer breakdown
```bash
dub-analytics referrers 30d
```

### Clicks over time
```bash
dub-analytics timeseries 30d
```

### List all links
```bash
dub-analytics links           # page 1, 50 per page
dub-analytics links 2 25      # page 2, 25 per page
```

## Intervals
`1h`, `24h`, `7d`, `30d`, `90d`, `ytd`, `1y`, `all`

## Output
All commands return JSON. Parse with `jq` or read directly.

## Examples

### Quick growth report
```bash
echo "=== Summary ===" && dub-analytics summary 30d && echo "=== Top 5 ===" && dub-analytics top-links 30d | python3 -c "import json,sys; [print(f'{l[\"shortLink\"]}: {l[\"clicks\"]} clicks') for l in json.load(sys.stdin)[:5]]"
```
