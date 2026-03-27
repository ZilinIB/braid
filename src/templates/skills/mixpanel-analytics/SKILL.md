---
name: mixpanel-analytics
description: "Query Mixpanel product analytics: page views, signups, chat usage, logins, funnels, retention, top events. Use when asked about product metrics, user behavior, conversion rates, engagement, DAU/MAU, or growth KPIs."
allowed-tools: Bash(mixpanel-analytics*), Bash(curl*mixpanel.com*)
---

# Mixpanel Analytics

Use `mixpanel-analytics` CLI to query product metrics. Pre-authenticated — no credentials needed.

## Commands

### Quick summary (page views + key events)
```bash
mixpanel-analytics summary         # last 7 days
mixpanel-analytics summary 30      # last 30 days
```

### Page views over time
```bash
mixpanel-analytics page-views 30
```

### Signups (onboarding completions)
```bash
mixpanel-analytics signups 30
```

### Chat usage (starts, messages, completions)
```bash
mixpanel-analytics chat-usage 30
```

### Logins
```bash
mixpanel-analytics logins 30
```

### Top events by volume
```bash
mixpanel-analytics top-events 30
```

### Funnel (arrival → onboarding → chat)
```bash
mixpanel-analytics funnel 30
```

### Retention (arrival → chat return)
```bash
mixpanel-analytics retention 14
```

### Any event by name
```bash
mixpanel-analytics events chat_message_sent 30
mixpanel-analytics events alert_created_backend 7
```

### List all event names
```bash
mixpanel-analytics event-list
```

## Output
All commands return JSON. Parse with `jq` or read directly.
