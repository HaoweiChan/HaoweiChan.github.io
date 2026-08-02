---
title: 'My Personal Assistant Is Not a Chatbot'
description: 'Building a resident assistant on Hermes Agent: six traits that stop it being a chatbot, what is genuinely clever about the Hermes agent mechanism, and the day it became trustworthy.'
pubDate: 'Aug 3 2026'
heroImage: '../../assets/blog/covers/resident-personal-assistant.png'
---

To be clear up front: this is a personal setup I actually use. It is not a product and it is not becoming one. What I want to record here is what changed in the design once I stopped treating it as "a bot that answers questions" and started treating it as "something resident in the background with a schedule of its own".

A chatbot exists because you opened it. You open a window, ask something, close it, and it is gone. This is the opposite: it runs continuously, and most of what it says to me on a given day is not an answer to anything I just asked. It picked the moment.

That sounds like it amounts to "plus a scheduler", but building it out, the difference rewrites the whole priority order of the design.

---

## What it actually is

Physically, it is boring: a small always-on machine at home running **Hermes Agent** (Nous Research's open-source agent runtime), with its messaging gateway connected to Discord and its built-in scheduler. Next to them sits an Obsidian vault — a pile of Markdown files in a git repo — which is its long-term memory.

What I receive on a normal day is roughly: summaries around the market sessions, a record of a few account balances, the day's log, and alerts when the system itself breaks. The specifics do not matter. What matters is that I did not ask for any of it in the moment.

Below are the six traits that, to me, are what stop it from being a chatbot, in order of how much they matter.

---

## 1. Resident and proactive: it picks the moment, not me

This is the root difference, and the other five hang off it.

Once an assistant can speak first, "what should it say" stops being the hard problem and "when should it say it" becomes the hard problem. And that one cannot be solved by a model — it is a question about my day, not about language.

I eventually turned it into a hard rule: **a notification must satisfy both "I am awake" and "the window is still open", otherwise it does not get sent**. An analysis that arrives after the session has closed is information, however complete, not action. That rule alone killed several jobs that looked useful but landed at a time nobody could act on.

The flip side is that the assistant needs "say nothing" as a first-class option, treated as a normal outcome rather than an error.

---

## 2. It lives in Discord: no new surface

I built no app, no dashboard, no web UI. It speaks inside the Discord I already have open every day.

That is the real reason it survived past week two.

Any interface that requires me to go and open it eventually becomes an interface I do not open. Discord is already open, messages already push to my phone, history is free, and multi-device sync is not my problem. I effectively got a notification system, an inbox, and an archive for nothing.

The cost is accepting the medium's constraints — message length, limited formatting, no interactive components. But those constraints pushed every message down to "one glance tells me whether to look closer", which for something that speaks a dozen times a day is an improvement, not a limitation.

---

## 3. Channels are roles: routing, memory scope, and persona are one decision

I use Discord channels as the routing table for the entire system.

One channel, one role, one prompt, one destination folder. Market questions, research, engineering, report feeds, system alerts — each has its own channel, its own persona and data access, and its output lands in its own folder in the vault.

This solves three things at once: I never have to explain the current context (the channel is the context), the assistant never has to guess where a conversation should be filed (the channel decides), and when I want to change one role's behavior I edit one isolated prompt without touching the others.

I later added a classification on top: channels are either **interactive** (I talk in them), **feeds** (one-way into me, I never talk there), or **engine** (they trigger long-running computation). Once that split existed, several homeless features found an obvious home — and two or three channels got merged out of existence because their responsibilities overlapped.

---

## 4. Capabilities are folders, with two entry points

Every capability the assistant has is physically a directory: a `SKILL.md` describing what it does and when to use it, plus a few scripts. That is the Hermes skill format, and it is my only extension point.

The important part is that **the same script has two callers**: the scheduler can invoke it at 8:30am on its own, and I can invoke it directly from a chat message. Both run the same code. There is no "scheduled version" drifting apart from an "interactive version".

```mermaid
flowchart LR
    Sched[Scheduler] --> Skill[Capability folder<br/>spec + scripts]
    Me[I speak in a channel] --> Agent[Assistant] --> Skill
    Skill --> Vault[(Obsidian vault)]
    Skill --> Chan[Channel message]
```

It sounds obvious, but it removes a whole class of problems. Capabilities living on the filesystem means they are version-controlled, diffable, and runnable locally in isolation for debugging — and there is no invisible configuration hiding in a runtime registry that only exists once the service is up. To know what this assistant can do, I `ls` a directory.

---

## 5. Memory is plain text

Everything it learns, produces, and records ends up as Markdown files in a git repo. I open them in Obsidian, grep them, and edit them by hand.

The assistant and I read and write the same store — which matters far more than which database it uses. A summary it writes today, I can edit tomorrow; a note I write by hand, it can read back as context later. No import, no export, no format conversion in between.

To keep that from falling apart with two writers, I added exactly two constraints:

- **Each folder has a minimal field contract** (type, date, source, and so on in frontmatter), so filtering, counting, and validation never require reading the prose. A daily checker — which itself uses no model — flags any file missing required fields.
- **Writers only write files; exactly one sweeper owns git.** On an interval it commits, fetches, rebases, and pushes, and nothing else in the system touches git. Multiple writers each committing on their own was my single biggest source of conflicts early on; collapsing it to one owner made it quiet.

---

## 6. It runs on a written contract, and a case book

This is the piece I see done least often and that paid off most.

The assistant has a standing **behavioral contract**: what role it acts in, what every substantive conversation must leave behind, which kinds of request route through which process. That contract is a file, not a scattering of tone descriptions across a dozen prompts.

On top of the contract there is a **case book**. Every time a judgment call comes up — should we do this, which approach, why was that rejected — the conclusion is written down as a precedent. Next time something similar appears, I consult the precedent instead of re-deciding from scratch in whatever mood I happen to be in. When a precedent recurs often enough, it graduates into the contract.

The result is that the assistant's behavior becomes a **tracked artifact**. I can diff it, and I can ask "when did this rule appear, and why". Behavior buried in prompts changes invisibly, and six months later nobody remembers why it was written that way.

---

## The Hermes agent mechanism: why I did not write my own

The six traits above are my design decisions. But half the work I never had to do, because Hermes already handles the hard part — and handles it better than what I would have written.

**1. Skills come from three places, one of which is the agent itself.** Bundled skills, skills I install from a hub, and skills the agent grows from its own experience. The third is the important one: I do not have to decide up front what it should know how to do.

**2. A curator maintains those skills in the background.** It is a background task that fires when the assistant is idle and the last review is old enough — no separate cron needed — and reviews the agent-created skills: marking stale ones, consolidating overlaps, archiving what is no longer used. Three hard rules I particularly like: it only touches agent-created skills (mine and installed ones are never modified), it never deletes and only archives (recoverable), and pinned skills are entirely exempt. A system that extends itself and has no layer like this eventually drowns in its own output.

**3. After every turn, it forks itself for a background review.** Once the main conversation has replied, a background thread takes the same conversation snapshot, runs a forked agent, and asks one question: is there anything here that should be remembered, or should become a skill?

The implementation details are the point. The fork **inherits the parent's live runtime** — same provider, model, credentials, cached system prompt — so it hits the same prefix cache. Its **tools are whitelisted down to memory and skill management**, everything else denied at runtime. And it **never touches the main conversation's prompt cache**. "The assistant learns" is not an abstract promise here; it is a concrete mechanism with a boundary, a permission scope, and a cost ceiling.

**4. Background work runs on a different model.** The curator and other auxiliary tasks use a separate auxiliary client, isolated from the main conversation. A cheap model does the housekeeping; the good model stays for the thinking.

**5. Subagents carry their own budget.** When work can be parallelized it spawns subagents, and each gets an independent iteration cap (90 for the parent by default, 50 per subagent). A runaway subtask burns its own allowance instead of eating the main line's — which is exactly what bit me back when I was writing scheduled agents myself.

**6. Tools are composable sets that can be switched per context.** Tools are not one always-on list; they group and toggle per platform and per job. The research channel gets search; the job that posts a report gets no tools at all.

Together, that is why I did not build my own: **the hard part of a resident agent is not making it capable, it is keeping it capable over months without going off the rails** — memory bloats, skills rot, background tasks quietly burn money, subtasks loop forever. Hermes has an explicit mechanism for all four rather than leaving them to the user.

---

## The spine running through all of it: keep the model off the critical path

The six traits above are its shape. This is why it became trustworthy.

Originally, almost all of my scheduled jobs were "have an agent go do this thing": let the model run the scripts, read the data, write the summary, post it to a channel. That demos beautifully and then breaks constantly in daily production — relative paths resolving differently depending on the working directory, tool-call budgets running out mid-task, provider rate limits, and the model occasionally just leaving out a section.

In one pass I rewrote six scheduled jobs from agent mode into deterministic scripts, with the data fetching, formatting, and posting all fixed in code. An entire category of failure disappeared.

Now every scheduled job gets one question first: **does this require judgment?**

```mermaid
flowchart TD
    T[Scheduled trigger] --> Q{Does this need judgment}
    Q -- No --> S[Deterministic script]
    Q -- Yes --> A[Agent mode: call the model]
    S --> C{Any new trigger condition}
    C -- No --> Silent[Exit silently]
    C -- Yes --> Post[Post to the channel]
    A --> Post
    Post --> V[(Write to the vault)]
```

Things that need judgment (research, synthesis, conversation) go through the model. Things that do not (same time, same format, same data, every day) go through a script. The model does what it is actually good at, rather than being responsible for being punctual.

### In Hermes, that choice is a field

This is the part I consider most important about actually using Hermes: **every scheduled job carries its own execution strategy**. Within the same scheduler, each job independently specifies whether it enters agent mode at all, which model and provider it uses, which toolsets are enabled, which skills are attached, and whether the previous job's output comes in as context.

So "does this need judgment" is not a philosophical question. It is a field.

I currently have 41 scheduled jobs, and **39 of them never enter agent mode** — plain scripts that touch no model at all. The remaining two genuinely need judgment (a weekly review and a daily log), and only those get a model and tools. That ratio is the argument of this post.

One adjacent lesson worth recording: the default model in my config was retired by the provider one day, and from then on every call burned three retries before falling through to the backup. Nothing looked broken, because the fallback genuinely caught it — until I opened the error log and found several hundred occurrences of the same 404. **Fallbacks make failures silent, so the fallback itself needs monitoring.**

---

## What Hermes gave me, and what I had to design

This is the most portable part of the whole thing.

**What Hermes gave me:** the messaging gateway (it supports twenty-odd platforms; I use one), the scheduler, skill loading and self-extension, the curator, the background-review fork, composable toolsets, the auxiliary model, and budget isolation for subagents. Off the shelf, configure and go — and as the section above argues, those are precisely the pieces that are hardest to get right yourself.

**What I had to design:** the plain-text memory layer and its field contract, the notification discipline (when to shut up), the split of responsibilities across channels, the behavioral contract and case book, and the pipeline that turns an idea into tracked engineering work.

Put differently, the runtime was barely the problem. The hard parts are the ones nobody decides for you — when it is allowed to interrupt me, where what it remembers lives, and what it consults when it makes a call. None of those are solved by attaching a model, or by switching framework.

---

## It extends itself

The last trait is one I added late and that changed the most: the assistant does not only execute, it also turns ideas into tracked engineering.

An idea that came up in conversation used to have one best-case outcome: becoming a note nobody opened again. Now every new idea gets graded against a fixed set of axes — cashflow, data feasibility, engineering scope, distribution, whether it can be validated within two weeks, and what would kill it — producing an explicit verdict: build, park, kill, or research first.

Anything that comes back "build" is opened as a self-contained engineering ticket and handed to the coding pipeline. My role narrows to reviewing the result.

The value here is not the automation. It is that **ideas now have a defined way to die**. An idea no longer fades quietly out of memory; it gets explicitly parked or killed, with the reasoning left behind.

---

## Closing

If I had to compress the whole thing into one line: **the value of a personal assistant is not how well it talks, but that it is punctual, quiet, and that you trust the numbers it hands you.**

Talking is what the model provides, and that part is cheap now. Punctual, quiet, and trustworthy are not from the model — they come from scheduling, contracts, validation, and a great deal of judgment about when not to speak. Which is why, in this setup, the least important piece turns out to be the model itself.
