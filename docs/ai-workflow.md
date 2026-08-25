# AI Workflow

This document describes the AI workflows related to this project. I will go over the tools, prompt styling, agents, how I worked with AI and how I reviewed the work. I then added some notes on the setup process and creation of initial requirements, project and architecture document.

I will attempt to highlight the pros, the cons and any mistakes I did in this process.

## AI Tools

I heavily utilized my ChatGPT Plus subscription for this exercise. I signed up for it in June and have been quite happy with the usage.

The most used model is GPT 5.6 Sol with medium reasoning level. I like Sol for its high intelligence and relative low cost. I also employed Terra, more on the models in the Agents section

A lot of the work with the Agents is done in the ChatGPT desktop app.

Whenever I do changes myself, the copilot autocomplete is also very helpful.

In the end, I experimented with the Playwright mcp aswell. For my setup I used the GitHub Copilot subscription I get through my current employer and only prompted it once.

## Agents

When I created the project, I also created a AGENTS.md file. This was my main agent working on this project. I usually dont work like this, but added it for orchestrating the multi agent workflows.

The reason I usually dont do this is that it adds to my prompt, which I like to keep simple.

The AGENTS.md defines what models should be used for the specific tasks, like Sol with medium/high reasoning should be used for general orchestration architectural decisions, final review and debugging.

I often like to keep the reasoning levels lower, and increase when I feel I need some extra input. There are a few reasons for this:

1. High reasoning levels can dramatically increase the time it takes for the agent to finish, often with the same result.
2. My experience with Sonnet was that it often ended up overthinking it and iterating unneccessarily.
3. It increases the cost.
4. The increase in intellect is often negligable.

## Iterations

The iterations I do with AI depends a bit on the task.
Initially, I used a lot of time with the requirements. Where I created a larger prompt based on the business requirements, I have it further down.

In my AGENTS.md I ask it to state assumptions and surface tradeoffs. This makes it reply to my prompt with issues and questions. Here I go a bit back and fourth until I am happy, and asks it to create the Requirements.md. Interestingly, since I am iterating over a lot of the features here, the 5 orders daily limit comes up, and I get a half check on this already. I initially planned to add this later.

Creating the whole requirements in one go is adding risk. As I will heavily rely on this for the rest of the project. Mistakes here will be difficult to fix thouroughly. That is the reason I iterate.

The requirement ends up being highly valuable, as it defines the user journey and is the source of truth of the whole project.

## Review

The review process I use depends on the approach:

### Requirement and Architecture

The review process here is mostly the iterative process where I go back and fourth with the agent.
I then manually review the output after. Going through the business requirements and verifying the md file. I read through this locally before creating a PR.

### Single task prompt

There is usually some back and fourth here with the agent. I try to gain some confidence on how AI works in the project. This strategy was used for the first parts of the implementation. I typically manually stage and commit the changes, then create a PR, which I then read through. I want to keep the changes small, so that review is as good as possible. However, with the amount of things I do in this project, it is not that easy. To help with this, I split into Stacked PRs, a new feature on GitHub to separate the logical changes.

### Multi-agent Multi-task workflows

When I implemented the Admin page, I used a multi agent workflow to pick up multiple tasks. The output is quite large, and I really dont like this that much. It is very hard to verify.

The subagents create their own PR which I go through. However, I am quite tired at this time, and cant find much issues. Huge risk.

A lot of important the review here is just me manually testing the features.

## User testing

At this point, the core funtionallity was implemented and I asked my girlfriend to test it out.

I think some input from a potential user is highly useful and it also helps with finding potential missing items or mistakes. On that was highlighet, was to add a button to copy the reference code.

Such a simple thing is a bit smart if you dont get a email verification 😉

## Manual work

One big issue I have with letting the AI loose is that it often makes a lot of code. Too much, and it is often not scalable. Example: It only wanted to keep one css file. I asked for it to create theming and moving that into js files. But it really did not care. Same with splitting up the React components. I did not use too much time here, but I would have in a real scenario.

So when I wanted to add the copy button I did it manually.

PR-13 is a typical look of a PR I can deliver. Short and hopefully easy to review. Additionally, I also think that it is highly reusable, I could have added the size as a prop/input, and used it every location with the codes.

Speaking of manual work. While working on the architecture, I asked for its recommendations, but the answer was too wide. I then manually decided on the tech stack. Aligning with the intentions of the project. This helped the AI understand the limitations and the focus was more towards creating an actual architecture with constraints.

## Fun prompt

I tested out the Playwright MCP server to easily add e2e tests. It is currently in an unmerged branch, as I scoped it out because of time. But I could easily use that in combination with the requirements to create test cases that validate the business requirements. Potentially very valuable.

## Correction

I think it is a lot of places where I could have corrected more. I chose to skip parts where I dont feel like it has impact on the exercise, but it would with an actual customer.

Annoyance areas for me is the already discussed giant css and the large components. I activly gave a lot of review comments in PR-12. But it straight up ignored a lot of the comments. I noticed, but moved on. I woud have used a lot of time working with the AI. This is a place where I think it is less valuable. It is easier to fix on smaller changes with smaller context, or just restarting.

I also noticed a bit too late that the solution did not create very resuable typing. So I asked it a bit late to refactor out a lot of the typing that was shared across Customers and Admins.

## Setup

I started the whole project with some manual setup, creating the repo, a lightweight structure of the md files and then a minimal AGENTS.md root file with 4 simple rules. I also added guidelines for multi-agent workflows and pointed the agents to the requirements.md and architecture.md

## Requirements

I then summarised the requirements in a prompt and tasked the AI to review, with the intention of it creating the requirements.md

### Prompt

```
Help me update the docs/requirements.md file. This is suggestions from me, please review and give input before we make any decisions

Purpose:
This project is for a bike repair show that wants to create a digital solution for managing bike maintenance orders through a web-based portal.

Goals:

- Provide customers with a simple way to submit and track maintenance orders.
- Provide administrators with a simple way to manage maintenance orders and workload
- Keep the solution simple with two main interfaces: Customer and Admin

Functional requirements:

- Customer:
  - Can submit a maintenance order.
  - The system provides a simple non-guessable reference when an order is submitted.
  - Can find/view orders using:
    - Reference
    - Email
    - phone number
  - Can view order details and current status.
  - Customers can add or update notes before repair work has started.
- Admin
  - Can view all order
  - Can search orders
  - Can filter order
  - Can edit orders
  - Can delete an order
  - Can change an order status to:
    - New
    - In Progress
    - Waiting for customer
    - Completed
    - Cancelled
  - Can view basic capacity and due-date information

Non-functional requirements:

- Reliability:
  - Downtime must not end up with lost orders
- Privacy:
  - customers should not access other customers orders
- Maintainability:
  - Easy to update
- Portability:
  - Must be usable on desktop and mobile devices

Technical requirements:

- Persist data on db
- Input validation and meaningful error handling
- Basic automated tests

```

### Experience

It took me some time to draft it. I was then prompted with questions after, which i replied to twice, but asked it to continue creating a draft when it started with too many details. The five orders per day business logic snuck in here because of the questions.

It then gave me a requirements.md that I reviewed, asking for a simple change and then accepted.

## Architecture

After the requirements was created I prompted the AI to get some high level recommendations, too see what it thought. I was ready to give input after. I did not go first, as it would "favor" my ideas.

Note: This was a bit of a slow task for such a simple project.

It ended up being too wide. So I used my own inputs and prompted this:

### Prompt

```
This is my thoughts:
responsive web app with separate /customer and /admin access
business logic in backend
Deployment:
One server with backend and db
One frontend
run localhost
Tech stack:
backend:Express
Prisma
SQLite

Frontend: Vite react
```

### md file creation

One back and fourth later. I asked it to generated the Architecture.md which it did and I reviewed it. I was happy with the output and moved forth.

## Basic project setup

With the architecture ready and a basic idea of the tech stack, I prompted the AI to setup the basic project structure. This was partially a mistake, I was too wide in my request. However it did a good job, so in the end I was quite happy.

There was two issues though, I had forgot to say that I wanted to use TypeScript, which it weirdly never asked for. And I also wanted to use PNPM, this one I was not suprised it did not recommend. I steered the workers and they added them.

This shows the risk of using AI to provide a basic set up rules. Some things that is a bit personal to me would not necessarily be added.

To review the project setup, I now started using github, since I like the review happening in the PR view. I tasked the AI to split the changes into three PRs: Root level, Frontend and Backend linked using GH stacked PRs that I have the skill for.

### Prompts

please create the basic project structure.

steer:
use typescript
use pnpm

Create three PRs for the changes on initial project setup: On for root level changes. One for Frontend and One for backend.
Link all of the PRs using Github stacked PR. use the gh-stack skill
branch name template:
feature/"repo/fe/be"/init setup
Keep the description minimal
i will push the changes, give me all commands to do them myself

### Review

Splitting the changes into PRs makes it, in my opinion way easier to review, even thought it does not change much from one change with everything. It just keeps it more logical and lowers risk, as the sizes are lower and easy to separate.

I ran the backend and frontend before merging, and ran the tests.

The complete project setup is now done. It took a lot of time 😅
