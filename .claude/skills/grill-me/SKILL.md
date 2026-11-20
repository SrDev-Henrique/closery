---
name: grill-me
description: A relentless interview to sharpen a plan or design.
disable-model-invocation: true
---

# Grill Me — run a `/grilling` session

A **grilling** is a relentless, adversarial interview that sharpens a plan, design, or spec to the
maximum, so that what gets built is exactly what the user wants, the way they want it. There is no
separate `/grilling` file — this skill *is* the grilling. Run it like this:

## How to run a grilling

1. **Read all the relevant context first.** For this project, read the whole `context/` folder (and
   any spec/plan in scope). Absorb it before asking anything.
2. **Hunt adversarially.** Look for **contradictions, gaps, unexamined assumptions, scope traps,
   and conflicts** between documents. These are the targets — not surface questions.
3. **Ask one question at a time.** Each question is sharp, focused on a single decision, and comes
   with **your recommended answer + reasoning** (lead with the recommendation). Multiple-choice is
   fine when the forks are clean.
4. **Walk down the decision tree.** Resolve dependencies in order — answer the upstream question
   before the ones that depend on it. Follow the thread; don't jump around.
5. **Explore the code instead of asking** whenever a question can be answered from the codebase
   (does X exist? what pattern is used?). Don't ask the user what you can verify.
6. **Update the docs/spec as decisions crystallize.** Fold confirmed decisions into the context
   files inline, or consolidate them at the end — but capture them; the refined docs are the
   deliverable.
7. **Continue until shared understanding.** Keep going while real forks remain; **don't fabricate
   low-value questions**. When only build-time details are left, say so and offer to consolidate.

## What good looks like

- Every answer changes what gets built — no questions with an obvious default.
- The user surfaces operational/domain knowledge that isn't in any document.
- Contradictions are caught and resolved before code is written.
- The context docs end the session sharper, consistent, and free of unexamined assumptions.
