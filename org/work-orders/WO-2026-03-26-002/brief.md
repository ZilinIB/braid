# Brief

## Problem
Leadership needs a careful, high-level review of `git@github.com:MantaDigital/stingray-mono.git`, identified as the company’s core asset. The immediate need is not implementation or change, but a reliable executive-quality summary of what the repository contains, how it appears to be organized, what major systems or domains it covers, and what notable strengths, risks, and unknowns emerge from a careful inspection.

Because this repository is business-critical, the review must prioritize care, accuracy, and non-destructive handling. The work should avoid any changes to the codebase, repository settings, branches, tags, issues, or deployment state unless explicitly authorized later. Findings should clearly distinguish direct observations from interpretation, and should surface uncertainties rather than overstate confidence.

## Scope

### In Scope
- Read-only review of the repository contents and metadata needed to understand the codebase at a high level.
- Identification of the repository’s apparent purpose, major applications/services/packages, and overall monorepo structure.
- Summary of the main technologies, frameworks, build/test/deploy conventions, and developer tooling visible from repository evidence.
- High-level mapping of important business or product domains represented in the codebase.
- Identification of notable risks, maintenance concerns, operational dependencies, or areas that deserve deeper follow-up.
- Executive-readout quality synthesis: concise, accurate, and useful for leadership decision-making.
- Documentation of key unknowns and what additional evidence would be required to resolve them.

### Out of Scope
- Any code, config, branch, tag, issue, workflow, or infrastructure changes.
- Dependency upgrades, refactors, fixes, or optimization work.
- Security testing beyond passive observation from repository contents.
- Penetration testing, credential use beyond approved repository access, or any destructive/probing actions.
- Exhaustive line-by-line audit of the full codebase.
- Architecture redesign recommendations beyond high-level observations and suggested follow-up areas.

## Constraints
- **Non-destructive only:** review must be read-only and must not modify the repository or connected systems.
- **Core asset sensitivity:** err on the side of caution; preserve confidentiality and avoid speculative claims.
- **Evidence-first:** separate facts observed in the repo from inferred conclusions.
- **High-level summary first:** prioritize broad understanding and executive clarity over deep implementation detail.
- **Time-boxed review:** produce a useful summary within a bounded review window rather than attempting a full audit.
- **Access assumptions:** use only approved access methods to inspect the repo; if access is blocked or incomplete, document the limitation explicitly.

## Goals
- Give leadership a trustworthy high-level understanding of what `stingray-mono` is, how it is organized, and what it likely powers.
- Surface the most important structural, operational, and maintainability observations without disturbing the asset.
- Highlight where further investigation would most improve confidence or reduce risk.

## Key Questions To Answer In The Repo Review
1. What is the repository’s apparent business purpose and role within the company stack?
2. Is this clearly a monorepo, and if so, how is it partitioned (apps, services, libraries, infra, tooling, docs, etc.)?
3. What major products, user journeys, or internal/external systems appear to be represented?
4. What languages, frameworks, and platform conventions are used across the repo?
5. How do local development, build, test, CI/CD, and deployment appear to be organized?
6. Are ownership boundaries, architectural conventions, and package relationships clear or ambiguous?
7. What signs exist of code health or strain (documentation quality, dependency sprawl, stale areas, inconsistent patterns, oversized modules, duplicated logic, missing tests, etc.)?
8. What operational or business risks are visible from repository structure alone?
9. What important unknowns cannot be resolved from repo inspection alone?
10. What are the top recommended follow-up investigations after this high-level pass?

## Success Criteria
- A delivery artifact is produced that gives a clear executive-readable summary of the repository’s purpose, structure, stack, and notable observations.
- The summary explicitly distinguishes observed facts, interpretations, and unknowns.
- At least the top-level monorepo layout, major components, and apparent system boundaries are identified.
- Risks and follow-up recommendations are prioritized, not merely listed.
- No repository or infrastructure changes are made during the review.

## Non-Goals
- Producing implementation plans or engineering estimates.
- Declaring the architecture “good” or “bad” without evidence.
- Replacing a future deep technical audit, security review, or operational assessment.
- Making changes in the repo under the guise of investigation.

## Recommended Next Baton
Remain in the research lane after briefing. Next step should be planning and execution of a read-only repository review, likely with support from a research_analyst for structured inspection and synthesis if the chief_of_staff wants the review delegated efficiently.