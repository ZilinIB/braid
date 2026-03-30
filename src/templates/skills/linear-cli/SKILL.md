---
name: linear-cli
description: "Manage Linear issues, projects, and cycles. Use when asked about tasks, tickets, sprints, project status, engineering work, backlog, or to create/search issues. Teams: CBU (Company Building), OPS (Internal Operations), DES (Design), ENG (Engineering), GRW (Growth), MAN (Mantadigital)."
allowed-tools: Bash(linear-cli*)
---

# Linear CLI

Use `linear-cli` to query and manage Linear. Pre-authenticated.

## Read Commands

### List issues by team
```bash
linear-cli issues ENG 20
linear-cli issues GRW 10
```

### Get specific issue
```bash
linear-cli issue ENG-123
```

### Search issues
```bash
linear-cli search "SEO pages" 10
```

### In-progress issues
```bash
linear-cli in-progress           # all teams
linear-cli in-progress ENG       # engineering only
```

### Backlog by priority
```bash
linear-cli backlog ENG 20
```

### My assigned issues
```bash
linear-cli my-issues
```

### Teams, projects, cycles
```bash
linear-cli teams
linear-cli projects
linear-cli cycles ENG
```

## Write Commands

### Create issue
```bash
linear-cli create ENG "Fix login redirect bug" "Users on mobile get stuck after OAuth redirect"
```

### Comment on issue
```bash
linear-cli comment <issue_id> "Reviewed — looks good, needs one more test"
```

## Teams
- **ENG**: Engineering
- **GRW**: Growth
- **DES**: Design
- **OPS**: Internal Operations
- **CBU**: Company Building
- **MAN**: Mantadigital
