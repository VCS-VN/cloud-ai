# Cloud AI Builder User Guide

Cloud AI Builder helps you build a complete storefront just by chatting with AI. No coding knowledge needed, no technical worries — simply describe the store you want and AI handles the rest.

This guide is for shop owners, retailers, and operations teams. You'll learn how to create your first project, work with AI, understand build-time messages, and handle issues when they arise.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Exploring the Workspace](#workspace)
3. [Chatting with AI](#chat)
4. [Understanding Messages and Progress](#progress)
5. [Answering AI Questions](#clarification)
6. [Managing the Preview](#preview)
7. [Viewing Code](#code-view)
8. [Project Settings](#settings)
9. [Troubleshooting](#troubleshoot)
10. [Tips and Shortcuts](#tips)
11. [FAQ](#faq)

---

## 1. Getting Started {#getting-started}

### Sign In

Sign in to Cloud AI Builder using your OAuth account. Go to the homepage and click **Sign In** — the system redirects you to the authentication page, then automatically brings you back to the **Dashboard**.

> **Tip:** If you're already signed in and visit the homepage again, the app takes you straight to the **Dashboard**. Conversely, if you're not signed in and open a project page, the app sends you to the sign-in page first.

### Creating Your First Project

There are two ways to start a new project:

**From the homepage:** You'll see an introduction with 6 ready-made suggestions — for example *Fashion store homepage*, *Product collection page*. Click a suggestion to pre-fill the prompt box, or type your own description. Then press send.

**From the Dashboard:** After signing in, you'll see a greeting *"What should we build, {your name}?"* and a prompt input box. Describe the store you want to build and submit.

When you send a prompt, the system will:
1. Create a new project
2. Redirect you to the project detail page (URL like `/projects/<id>`)
3. AI starts analyzing your request and building your store

> **Tip for good prompts:** Be as specific as possible. Instead of *"Create a shop for me"*, try *"Create a minimalist women's fashion store with a pastel color scheme, a homepage with a large banner and a featured products section"*.

### Project Management Page

Visit `/projects` to see all your projects:

- **Display mode:** Click to switch between **Grid** (card grid) and **List** (list view).
- **Search:** Type a project name in the search box to filter quickly.
- **Sorting:** Defaults to *Last edited* (most recently edited).
- **Each project card** shows: name, status badge (**Draft**, **Generating**, **Ready**, **Failed**), last updated date, and a thumbnail image.

When you have no projects yet, the page shows an empty state inviting you to create your first one.

---

## 2. Exploring the Workspace {#workspace}

Each project opens in a 3-column workspace:

| Column | Position | Content |
|--------|----------|---------|
| Left | Chat | Chat history with AI |
| Center | Preview / Code | View the storefront being built or view the code (read-only) |
| Right | Contextual | Additional information |

### Resizing and Hiding the Chat Column

- **Drag the chat column border** to change its width. Minimum 320px, maximum 55% of screen width.
- Your chosen size **is saved** in the browser — it persists across sessions.
- Click the **Hide chat** button to collapse the chat column if you need more preview space. Click again to expand it.

### Chat Header

At the top of the chat column:

- Project name and status badge
- **Processing** badge when AI is running
- Most recently updated date
- **Back** button to return to the project list
- **Settings** button to open the settings drawer
- **Hide chat** button to collapse the chat column

---

## 3. Chatting with AI {#chat}

All interactions with AI happen through the message composer at the bottom of the chat column.

### Composing and Sending

- Input field supports up to **12,000 characters**.
- Press **Enter** to send. **Shift + Enter** to add a new line.
- While AI is processing, the input is locked — you can't send a new message until the current run ends.

### Reasoning Effort

Above the input field is the **Reasoning Effort** dropdown with 4 levels:

| Level | When to use |
|-------|-------------|
| **low** | Simple requests, color changes, text tweaks |
| **medium** *(default)* | Most common UI changes |
| **high** | Complex changes, multiple pages at once |
| **xhigh** | Major restructuring, complex logic |

Higher levels produce more thorough results but are slower. Start at **medium** and only increase if the AI isn't understanding enough.

### Plan Mode

Toggle **Plan mode** on (turns lime green) to have AI **plan first** instead of building immediately. In this mode, AI will:

1. Analyze your request
2. Return a detailed plan
3. Wait for you to **Approve** or **Reject**

> **When to use Plan mode:** When you want to make a large change and want to see what AI will do before it touches your project. This helps avoid regret and saves processing time.

### Stopping Mid-Run

While AI is running, the **Send** button becomes a **Stop** button. Press Stop to safely cancel the current run — completed work is kept, and AI stops at the next step.

### Send Errors

| Situation | Message |
|-----------|---------|
| Empty prompt | *"Enter a prompt before sending."* |
| Over 12,000 characters | Character limit exceeded error |
| Another run active | *"This project already has an active builder run."* |

---

## 4. Understanding Messages and Progress {#progress}

As AI works, you'll see various types of messages in the chat column. Understanding what they mean helps you stay informed and know when to intervene.

### Message Layout

- **Your messages** are right-aligned, in blue bubbles.
- **AI messages** are left-aligned, grouped by run with a distinguishing left border.
- Messages are ordered by creation time, newest at the bottom.

### Scrolling and Loading Older Messages

- When new messages arrive and you're near the bottom, the app **auto-scrolls down** for you.
- When you scroll far up, a floating **Jump to latest** button appears to take you back to the newest message.
- Scrolling to the top automatically triggers loading of older messages. You can also click **Load older messages** to load manually.
- While AI is processing, a skeleton bubble (gray bubble) appears at the bottom to indicate a new message is coming.

### Phases During a Run

While AI works, you'll see phases updated continuously:

| Phase | Meaning |
|-------|---------|
| Reading page structure | AI is examining the current state of the project |
| Planning the edit | AI is thinking about the changes needed |
| Preparing draft workspace | AI is starting to compose content |
| Building pages and sections | AI is creating pages and UI sections |
| Checking the preview | AI is reviewing what it built |
| Self-healing small errors | AI is fixing issues it encountered |
| Publishing changes | AI is saving the results |
| Waiting for your selection | AI needs you to answer a question |
| Done | Run completed successfully |
| An error occurred | Run encountered a problem |
| Cancelled | Run was stopped |

### The Section AI Is Working On

Along with the phase, you'll see AI announce which part of the store it's working on:

- **Pages:** homepage, products page, product detail page, cart page, checkout page
- **Sections:** the global frame, the hero section, the product tile, the product grid, the header, the footer
- **Components:** the cart drawer, the promo banner, the design system
- Or *"a UI section"* when no specific category applies

> **Your privacy:** You will **never** see file names, framework names, or technical code snippets in messages. Cloud AI Builder has a policy of keeping language friendly for non-technical users — all technical content is translated into everyday language.

### Summary Message

When a run completes, AI sends a brief summary message (up to about 400 characters). If for some reason AI can't provide a summary, you'll see the default message *"Done with your request."*

### Stream Timeout

If no new updates arrive from AI within 30 seconds, the system will **automatically retry once**. If there's still no response, the run switches to an error state and you can click **Retry**.

---

## 5. Answering AI Questions {#clarification}

During the build process, AI may ask you questions to clarify your intent. There are 3 types of questions:

### Type 1: Design Variant Picker

AI displays **4 design style cards** for you to choose from. Each card has:

- A few color dots showing the palette
- Style name (e.g. *Modern & Clean*, *Bold & Vibrant*, *Warm Retail*, *Playful*)
- A short description

You have two ways to answer:

1. **Click the card** you want — AI applies it immediately.
2. **Describe your own** in the *"Or describe the style you want"* field — write freely if no card matches.

Once selected, the card gets a blue border and shows *"Applying…"*.

### Type 2: Multiple-Choice Question (Skill Clarification)

This is a simpler format — just a list of radio buttons with labels. Click a choice and AI continues immediately, no separate confirm button needed.

### Type 3: Plan Review

When you enable **Plan mode** (see section 3), AI returns a detailed plan in markdown for you to read. There are 2 buttons:

- **Approve** *(green)*: Agree — AI starts executing the plan.
- **Reject** *(gray)*: Decline — the run is cancelled. You can enter a new prompt.

While processing, buttons show *"Applying…"* or *"Cancelling…"*.

> **Tip:** You're not forced to answer immediately — the question stays in the chat. Read carefully before clicking.

---

## 6. Managing the Preview {#preview}

The center column of the workspace defaults to **Preview** — where you see the storefront running live.

### Starting the Preview

The first time you enter a project (or after changing configuration), you'll see the preview go through these states:

| State | Meaning |
|-------|---------|
| **Installing** | Installing required dependencies |
| **Starting** | Starting the server |
| **Running** | The store is up and ready to view |
| **Error** | An error occurred during startup |
| **Fixing** | AI is self-repairing |

The **Installing → Running** process usually takes 30-60 seconds the first time. Subsequent starts are much faster.

### URL Navigation

- Enter a path in the URL field (e.g. `/products`, `/cart`, `/checkout`) and press **Enter** to load it.
- Click the **Reload** button to refresh the current page.

### Automatic Token Refresh

The system automatically refreshes the preview session every 10 minutes in the background — you don't need to do anything. The preview won't lose its session mid-use.

> **Note:** The preview iframe runs in a sandbox with strictly controlled permissions — ensuring safety while still allowing the UI to function fully (forms, JavaScript, state persistence).

---

## 7. Viewing Code {#code-view}

Next to the **Preview** tab, you can switch to the **Code** tab to view the source code AI has generated.

- The **file tree** on the left lets you browse the project structure.
- The **search box** helps find files by name quickly.
- File content is displayed as plain text (no syntax highlighting).
- A clear **Read only** badge — you can only view, not edit here.

The **Add comment**, **Copy**, and **Download** buttons appear as placeholder UI but are currently disabled. These features are for a future release.

> **Why read-only?** Cloud AI Builder is designed for you to make edits through chat with AI, not by editing code directly. This keeps the project consistent and avoids errors from manual intervention.

---

## 8. Project Settings {#settings}

Click the **Settings** button in the chat header to open the settings drawer. The drawer has 2 tabs:

### General Tab

- **Rename project:** Edit the name in the input field. The name cannot be empty.
- **Delete project:** The **Delete** button at the bottom of the tab. When clicked, the app shows a confirmation dialog to prevent accidental deletion.

> **Warning:** Deleting a project is irreversible. All messages, code, and settings will be permanently lost.

### Info Tab

Configure the store connected to the storefront:

- **Select a store** from the **selectedStoreSlug** dropdown — this is the data source store (products, orders, inventory).
- Click **Save** to apply. The system will:
  1. Sync the `VITE_STORE_SLUG` value into the project configuration
  2. Automatically restart the preview with the new configuration

### "Unsaved changes" Indicator

When you change something but haven't clicked **Save**, the drawer footer shows *"Unsaved changes"* reminding you to save before closing.

---

## 9. Troubleshooting {#troubleshoot}

### Common Error Messages

| Error Code | Message You See | What to Do |
|------------|-----------------|------------|
| `validation_failed` | Validation failed. Please try again. | Click **Retry** |
| `boundary_violation` | Request blocked for safety reasons. | Adjust your prompt |
| `config_unavailable` | AI builder is temporarily unavailable. Please try again later. | Wait a few minutes and retry |
| `cancelled` | Cancelled. | You stopped it intentionally — send a new prompt |
| `preview_failed` | Preview didn't come up. Please try again. | Click **Reload** preview or **Retry** |
| `codex_runtime_failed` | The builder hit a transient error. Please try again. | Click **Retry** |
| `blocked_request` | Request is out of scope. | Rephrase your prompt |
| `repair_exhausted` | Errors remain after self-repair. Please try again. | Try a simpler prompt |
| `required_skill_unavailable` | Missing required instructions. | Contact support |
| `skill_unavailable` | The requested skill is not available. | Click **Retry** after a few minutes |
| `interrupted_by_restart` | The session was interrupted. You can safely retry. | Click **Retry** — no data is lost |

### Retry Button

Every error message includes a **Retry** button. Click to **create a new run with the same prompt** — you don't have to retype it.

### Interrupted Messages

Sometimes a run is interrupted mid-way (network loss, server restart). You'll see:

- An **Interrupted** badge on the message
- The text that was streamed so far is **preserved** for you to read
- A **Retry** button to run again

### Server Restart Safety

Cloud AI Builder is designed to withstand automatic server restarts. When this happens during a run:

- Reloading the page shows the **Interrupted** message immediately.
- If the run was waiting for your clarification answer, **the waiting state is restored** — you can still answer.
- Click **Retry** to safely restart without causing data conflicts.

> **Tip:** If you keep clicking Retry and still get errors, try simplifying your prompt or breaking it into smaller steps.

---

## 10. Tips and Shortcuts {#tips}

### Message Shortcuts

| Key | Action |
|-----|--------|
| **Enter** | Send message |
| **Shift + Enter** | New line in message |

### Tips for Effective Prompts

- **Be specific about the industry:** *"women's fashion store"* is better than *"online shop"*.
- **Describe the style:** *"minimalist, pastel tones"* or *"vibrant, colorful"*.
- **List components:** *"with a large banner, featured products section, footer with contact info"*.
- **Make small changes one at a time:** Instead of bundling 5 requests into one message, split them into multiple messages for better control.

### Tips for Using Plan Mode

- Turn on **Plan mode** for large requests (e.g. restructuring the homepage).
- Read the plan carefully before clicking **Approve**.
- If the plan doesn't match your intent, click **Reject** and write a clearer prompt.

### Time-Saving Tips

- Start **Reasoning Effort** at **medium**. Only increase when needed.
- Resize the chat column to a comfortable size — the size is saved.
- Use the **Code** tab to understand what AI did when you want to learn.

---

## 11. FAQ {#faq}

### Do I need to know how to code?

No. Cloud AI Builder is designed for non-technical users. You just need to describe your ideas in plain language.

### Why don't I see file names or code in AI messages?

This is an intentional privacy policy. The app **never** exposes file names, framework names, or code identifiers in the chat UI. AI always uses friendly phrasing like *"homepage"*, *"product section"*, *"header"*.

### Is it okay to close the tab while a run is in progress?

Yes. The run continues on the server. When you come back, the full message history will be restored.

### Can I edit the code directly?

Currently the **Code** tab is read-only. All edits are made through chat with AI. This keeps the project consistent and safe.

### How is Plan mode different from regular chat?

In regular mode, AI starts working immediately. In **Plan mode**, AI presents a plan first and waits for your approval — useful when you want to preview before making major changes.

### Does high Reasoning Effort take more time?

Yes. The **xhigh** level can be several times slower than **low**. Start at **medium** and only increase when truly needed.

### Can I recover a deleted project?

No. Deletion is permanent. The app has a confirmation dialog to prevent mistakes — read it carefully before clicking **Delete**.

### When should I use the Stop button?

When you realize your prompt was wrong or AI is heading in the wrong direction. Press **Stop** to safely halt — completed work is preserved and AI doesn't get "stuck".

### Why does the preview always need to Install first?

The first time you open a project, the system needs to install dependencies for your store. Subsequent previews start much faster because the libraries are already in place.

### What happens when I change the store slug in the Info tab?

The app updates the `VITE_STORE_SLUG` variable in the project configuration and **automatically restarts the preview**. You'll see the preview switch back to **Starting** then **Running** with the new store's data.

---

> Need more help? Contact the Cloud AI Builder team through your official support channel. Happy building!
