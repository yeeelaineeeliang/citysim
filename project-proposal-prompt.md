# Project Proposal Prompt

Paste this into Claude Code to generate your project proposal. Claude will interview you about your idea and produce a `PROJECT_PROPOSAL.md` file for review.

---

## The Prompt

Copy everything below and paste it into Claude Code:

```
I need your help writing a project proposal for my class, Design Build Ship (MPCS 51238) at UChicago. This is an agentic engineering course where I've been using Claude Code to build and ship software.

For the next 5 weeks, I'm building an individual project. It can be civic, creative, educational, experimental, or entrepreneurial. I'll present it at a project fair in Week 9. The project should be ambitious — I have Claude Code, MCP servers, and 5 weeks of supported build time.

Important context: every week I need to show substantial progress. The goal isn't just to push something live — it's iteration, exploration, creativity — pushing the limit of what's normally done in a CS classroom. I should be building, breaking, learning, and evolving the project continuously. The process matters as much as the result. This is a safe space to be ambitious, take risks, and try things that might not work. No idea is too ambitious to explore — we'll scope it together.

Please interview me to figure out the best project for me. Ask me questions one at a time — don't rush. I want to think through this carefully. If my answers are vague, push me to be more specific — I'd rather get challenged now than build the wrong thing for 5 weeks. During the interview, feel free to search the web to help explore my idea — check if APIs exist, find similar products, research data sources. Use real information to help us make better decisions. Here's what I'd like you to help me figure out:

1. What am I excited about? What problems do I notice in my life, my community, or the world?
2. Who would use this? Is it for me, my friends, a specific community, or the public?
3. What does this look and feel like? Walk me through what a user sees the first time they open it.
4. What's the smallest version that proves the idea works? Help me scope. Remember that Claude has difficulty with time estimates—often over-estimating how long something will take in this new era of software development.
5. What's my technical background? What languages, frameworks, or tools have I used before?
6. What tech stack makes sense? (The recommended web tech stack is Next.js, Tailwind, Supabase, Clerk, and Vercel — but I can use alternatives if I have a good reason. This also doesn't have to be a web app--it can use React Native, or other frameworks).
7. What APIs or external services would I need?
8. What's the biggest risk — what could go wrong or be harder than I think?

After our conversation, generate a file called PROJECT_PROPOSAL.md with this exact structure:

# Project Proposal: [Project Name]

## One-Line Description
[One sentence — what is this and who is it for?]

## The Problem
[What problem does this solve or what opportunity does it create? Why does this matter to you?]

## Target User
[Who specifically would use this? Be concrete — not "everyone" but a real person or group.]

## Core Features (v1)
[The smallest working version. What does it do on day one? List 3-5 features max.]

## Tech Stack
- Frontend: [framework — e.g., Next.js, React Native, or explain your choice]
- Styling: [CSS approach — e.g., Tailwind, or explain your choice]
- Database: [what and why — e.g., Supabase, or explain your choice]
- Auth: [if applicable — e.g., Clerk, Supabase Auth, or none if not needed]
- APIs: [external services, if applicable]
- Deployment: [hosting — e.g., Vercel, App Store, or explain]
- MCP Servers: [which ones and why — e.g., Supabase MCP, Playwright MCP]

Note: the recommended stack is Next.js + Tailwind + Supabase + Clerk + Vercel, but justify your choices based on what your project actually needs. Not every project needs auth or external APIs. The architecture should serve the idea, not the other way around.

## Stretch Goals
[What would you add in weeks 2-5 if the core is solid? Dream big here.]

## Biggest Risk
[What's the hardest part? What could go wrong? What do you not know yet?]

## Week 5 Goal
[What will you demo at the end of the first project week? Be specific.]

Don't generate the file until we've talked through everything. Interview me first.

After generating the file, remind me to read through it carefully and edit anything that doesn't match my actual vision. This is MY proposal, not yours. Also tell me the full file path where you saved it and how to open it (e.g., "You can find it at /path/to/PROJECT_PROPOSAL.md — open it with: cat PROJECT_PROPOSAL.md or in your editor").
```

---

## After You Generate It

1. Review the `PROJECT_PROPOSAL.md` Claude created
2. Make sure it reflects YOUR vision — edit anything that doesn't feel right
3. Submit the `.md` file on Google Classroom before Week 5

Your TAs and graders will review your proposal and give feedback before you start building.
