# Pre-Migration Baseline (T002)

**Date**: 2026-06-07
**Branch HEAD**: main @ `git tag pre-027-migration`

## Original bug repro (legacy ai-agent path)

**Prompt**: `thêm image vào hero`
**Project state**: healthy initialized project (status `ready`)
**Reasoning effort**: medium
**Plan mode**: off

### Symptom (legacy `ProjectPatchService.applyHunks`)

Pure-insertion hunks land at the wrong file offset, scrambling the file structure of `src/components/storefront/Hero.tsx`. The Vite preview parser fails on the next reload with a syntax error; the hero never gets its image.

### Root cause (informational)

`ProjectPatchService.applyHunks` mishandles unified-diff hunks where every line is an insertion (no surrounding context). The applier picks an offset based on position counters that drift when multiple insertion-only hunks land in the same file. See `src/features/ai-agent/runtime/patch.ts`.

### Reference for SC-001

After Phase 1 ships, the same prompt against the codex SDK builder-run path MUST produce a clean preview reload with no parser error. SC-001: zero parser-error chats over two consecutive weeks of usage post-Phase 1.

### Why no live screenshot here

This repo is pre-production with no captured production session log; running the legacy path locally to reproduce the bug requires a populated workspace and a long-lived chat session. The bug class is the documented motivation for the migration; the post-Phase 1 verification in `tests/integration/us1-hero-update.test.ts` is the regression seal.
