## Backend developer assessment

Thanks for your interest in the backend developer role.

The government project we’re recruiting for is confidential, so this
assessment uses a fictional public-service appointment application.
It contains no production code or real resident data.

## The issue

When several residents book the same appointment simultaneously, the
API sometimes confirms more bookings than the slot allows.

Your task is to fix this one issue in the backend.

For a slot with one remaining place, only one booking should succeed.
Other requests should receive HTTP 409 Conflict with a clear error
message.

The booking record and remaining capacity must stay consistent if an
operation fails. Your solution must also work when multiple application
instances share the same database.

Please preserve the existing successful-booking response.

## Scope

Only fix the overbooking issue.

You do not need to change the interface, add authentication, redesign
the application, or fix unrelated issues. The unsecured staff view is
an intentional part of this local demonstration, not an assessment task.

Use fictional information only. Do not deploy this application publicly.

## Getting started

Use Node.js 24 or newer. No third-party packages are required.

Start the application with `npm start`, then open
[the local application](http://127.0.0.1:3000).

Run the regression test with `npm test`.

The supplied test reproduces the reported issue and is expected to fail
before you implement your fix. Fix the application rather than weakening
or removing the test. You may extend the test coverage for this issue.

The application creates its local SQLite database automatically.
The supplied test uses a separate in-memory database.

## What to submit

- Your code changes.
- The regression test, plus any tests you add for this issue.
- A short SOLUTION.md explaining the cause and your fix.

We will assess whether your solution prevents overbooking, maintains
database consistency, and remains correct across application instances.

We will discuss your implementation in a short follow-up interview.

## Time and payment

Assessment payment: [Insert agreed amount and currency.]

Please spend no more than two hours on the exercise. If you run out of
time, submit your progress and explain what remains.

Documentation and AI tools are allowed. Please disclose substantial AI
assistance and be prepared to explain your code.