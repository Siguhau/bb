# AI Workflow

## Setup

I started the whole project with some manual setup, creating the repo, a lightweight structure of the md files and then a minimal AGENTS.md root file with 4 simple rules. I also added guidelines for multi-agent workflows and pointed the agents to the requirements.md and architecture.md


## Requirements:

I then summarised the requirements in a prompt and tasked the AI to review, with the intention of it creating the requirements.md

### Prompt
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

### Experience

It took me some time to draft it. I was then prompted with questions after, which i replied to twice, but asked it to continue creating a draft when it started with too many details. The five orders per day business logic snuck in here because of the questions.

It then gave me a requirements.md that I reviewed, asking for a simple change and then accepted.

