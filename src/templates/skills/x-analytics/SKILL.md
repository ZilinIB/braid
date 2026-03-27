---
name: x-analytics
description: "Monitor X/Twitter accounts: profile stats, follower counts, recent tweets with engagement metrics, mentions, and search. Use when asked about X/Twitter performance, social media stats, tweet engagement, follower growth, or company account monitoring."
allowed-tools: Bash(x-analytics*), Bash(curl*api.x.com*)
---

# X/Twitter Analytics

Use `x-analytics` CLI to monitor X accounts. Pre-authenticated — no credentials needed.

## Commands

### Profile info (followers, tweets, bio)
```bash
x-analytics profile <username>
```

### Multiple profiles at once
```bash
x-analytics profiles user1,user2,user3
```

### Quick follower count
```bash
x-analytics followers <username>
```

### Recent tweets with engagement
```bash
x-analytics tweet-metrics <username>        # last 10
x-analytics tweet-metrics <username> 20     # last 20
```

### Recent tweets (raw JSON)
```bash
x-analytics tweets <username> 10
```

### Mentions of an account
```bash
x-analytics mentions <username> 10
```

### Search recent tweets
```bash
x-analytics search "stingray crypto" 10
```

## Output
Most commands return JSON. `tweet-metrics` and `followers` return formatted text.
