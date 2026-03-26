# Brief

## Problem
The human requested a careful, high-level review of `git@github.com:MantaDigital/stingray-mono.git`, described as the company’s core asset. The immediate need is not implementation but trustworthy understanding: what the repository appears to do, how it is organized, what major systems and dependencies it contains, and what strategic or operational risks are visible from a repo-level review.

Because this codebase is positioned as business-critical, the review must optimize for accuracy, restraint, and risk awareness. We should avoid overclaiming from superficial signals, distinguish observed facts from inference, and produce an executive-quality summary that can support follow-up technical diligence if warranted.

## Scope
### In Scope
- Clone or inspect the repository carefully enough to understand its top-level structure.
- Identify the apparent product/business function of the codebase.
- Summarize major applications, services, libraries, infrastructure, and tooling visible in the monorepo.
- Highlight notable technical patterns, dependencies, and operational signals.
- Call out repo-level risks, unknowns, and areas needing deeper technical validation.
- Produce a concise, executive-quality summary suitable for the chief_of_staff to relay back to the human.

### Out of Scope
- Full code audit, security audit, or line-by-line review.
- Verification of runtime behavior in production.
- Refactoring, implementation, or architecture changes.
- Legal/compliance certification.
- Any destructive repo operations.

## Constraints
- The repository is described as the core company asset, so handling must be careful and non-destructive.
- Conclusions must be evidence-based and explicitly labeled when inferential.
- Time-box the initial review to a high-level architectural and product understanding rather than exhaustive analysis.
- If the codebase requires deeper technical interpretation than product review can safely provide, route that portion to tech_lead.

## Success Criteria
- A briefed and planned research work order exists with clear research questions and boundaries.
- The final delivery includes:
  - a plain-English summary of what the repository is and likely does,
  - the major subsystems/components in the monorepo,
  - the most important risks/unknowns,
  - confidence levels for key conclusions.
- The write-up clearly separates observed facts from interpretation.
- The resulting summary is concise enough for executive use while preserving enough technical fidelity for follow-up.

## Non-Goals
- Proving the system is well-architected or production-ready.
- Exhaustively documenting every package or service.
- Making implementation recommendations before sufficient technical evidence exists.
- Replacing a dedicated technical due-diligence review if one is needed.
