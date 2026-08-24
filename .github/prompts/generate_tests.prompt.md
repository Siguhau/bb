---
description: Explore the application with Playwright and generate 4 new, valuable end-to-end test scenarios that are not already covered by existing tests.
tools: [playwright/*]
model: agent
---

Use Playwright to explore the application and identify **4 new test scenarios**.

For each scenario:

1. Explore the application using Playwright to understand the available flows, pages, interactions, and behavior.
2. Inspect the existing Playwright tests to avoid duplicating scenarios that are already covered.
3. Look for meaningful user journeys, edge cases, error states, navigation flows, and important interactions that are currently untested.
4. Prefer scenarios that provide real regression value over simple variations of existing tests.
5. For each scenario, determine:
   - What the user is trying to accomplish
   - The required starting state
   - The actions the user performs
   - The expected result
6. Implement a Playwright test for each of the 4 scenarios.
7. Run the tests and fix any issues until they pass.
8. Keep the tests consistent with the existing project's Playwright conventions, fixtures, helpers, selectors, and structure.

### Requirements

- Generate exactly **4 new test scenarios**.
- Do not duplicate existing tests.
- Do not invent application behavior. Verify behavior through Playwright exploration.
- Use stable selectors where possible.
- Avoid unnecessary waits such as arbitrary `waitForTimeout`.
- Tests should be independent and deterministic.
- Prefer testing behavior from the user's perspective rather than implementation details.
- If a scenario cannot be reliably automated, skip it and find another scenario.
- After implementation, summarize the 4 scenarios and the files/tests that were added or changed.
