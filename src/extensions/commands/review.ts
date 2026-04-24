import type { CommandDefinition } from "./types"

const REVIEW_TEMPLATE = `You are running the /review command. Your job is to review code changes with fresh eyes and provide concrete, actionable feedback.

Input: $ARGUMENTS

## Determine What to Review

1. No arguments: review all uncommitted changes.
   - Run \`git diff\` for unstaged changes.
   - Run \`git diff --cached\` for staged changes.
   - Run \`git status --short\` to identify untracked files, then read relevant new files.
2. Commit hash: run \`git show $ARGUMENTS\`.
3. Branch name: run \`git diff $ARGUMENTS...HEAD\`.
4. PR URL or number: run \`gh pr view $ARGUMENTS\` and \`gh pr diff $ARGUMENTS\` when available.

## Review Guidance

Diffs alone are not enough. After getting the diff, read the relevant full files and surrounding code to understand existing patterns and intent.

Read AGENTS.md, CONVENTIONS.md, README, or nearby docs when present. Treat documented project conventions as authoritative.

Look for concrete issues: correctness bugs, regressions, incorrect assumptions, edge-case failures, type/API mismatches, security risks, confusing logic with practical impact, and missing verification for risky changes.

Do not modify files. Do not refactor. Do not nitpick style unless it violates documented conventions or creates real maintenance risk. If you are uncertain and cannot verify, say you are unsure instead of presenting it as a definite issue.

## Output

Report findings grouped by severity. Include file paths and line numbers when possible, why the issue matters, and a suggested fix. Omit empty severity sections.

If no blocking issues are found, say:

\`\`\`md
## Findings
No blocking findings.
\`\`\``

export const review: CommandDefinition = {
  description: "Review changes [commit|branch|pr], defaults to uncommitted",
  agent: "reviewer",
  subtask: true,
  template: REVIEW_TEMPLATE,
}
