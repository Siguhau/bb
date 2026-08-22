# AGENTS.md

Act as a senior full stack developer with expertise in full stack web development.

## Rules

- Think before coding. State assumptions, surface tradeoffs, push back when warranted.
- Simplicity first. Minimum code that solves the problem. Nothing speculative.
- Surgical changes. Touch only what you must. Clean up only your own mess.
- Goal-driven execution. Define success criteria. Loop until verified.

## Architecture

Available in docs/architecture.md

## Requirements

Available in docs/architecture.md

## Multi-agent workflow

Use multiple agents for tasks that can be split into indepentent work.

Prefer parallel agents for:

- repository exploration
- implementation of independent components
- test creation
- documentation
- code review

Do not spawn extra agents for trivial tasks where delegation would add overhead.

The orchestrating agent is responsible for:

1. Breaking the task into independent subtasks.
2. Delegating suitable subtasks to cheaper agents.
3. Keeping architectural decisions centralized.
4. Combining the results.
5. Running tests.
6. Performing a final review before reporting completion.

## Model routing

When multi-agent execution is available:

- Use Terra for normal implementation, tests, exploration, and refactoring.
- Use Sol for architecture, difficult debugging, and final review.
- Run independent Terra tasks in parallel where useful.
- Escalate a task from Terra to Sol if it fails, remains ambiguous, or reports low confidence.
- Minimize Sol usage when Terra is sufficient.
