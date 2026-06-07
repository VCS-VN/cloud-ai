#!/usr/bin/env bash
# Install builder runtime skills from the repo's skills/ directory into $SKILLS_ROOT.
#
# Usage on VPS:
#   sudo bash scripts/install-skills.sh                   # install all skills from skills/*
#   sudo bash scripts/install-skills.sh design-taste-frontend  # install one skill by name
#
# Idempotent: re-running overwrites existing skills with the latest repo version.
# Restart PM2 after running to pick up the new registry: pm2 restart cloud-ai-builder.
#
# Why this script exists:
#   skills/* in the repo is the runtime source of truth (Phase 2 T030 + T031).
#   /var/bin/skills/ is what the app reads at boot per docs/deploy-vps.md.
#   .agents/skills/* is a separate dev-agent surface and is NOT the builder runtime.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_ROOT="$REPO_ROOT/skills"
TARGET_ROOT="${SKILLS_ROOT:-/var/bin/skills}"
TARGET_USER="${SKILLS_OWNER:-builder}"
TARGET_GROUP="${SKILLS_GROUP:-builder}"

if [[ ! -d "$SOURCE_ROOT" ]]; then
  echo "error: source skills directory not found at $SOURCE_ROOT" >&2
  exit 1
fi

if [[ "$EUID" -ne 0 ]] && [[ "$TARGET_ROOT" == "/var/"* ]]; then
  echo "error: root required to write under $TARGET_ROOT (rerun with sudo)" >&2
  exit 1
fi

if [[ ! -d "$TARGET_ROOT" ]]; then
  echo "creating $TARGET_ROOT"
  mkdir -p "$TARGET_ROOT"
  chown "$TARGET_USER:$TARGET_GROUP" "$TARGET_ROOT"
  chmod 750 "$TARGET_ROOT"
fi

declare -a skills=()
if [[ "$#" -gt 0 ]]; then
  skills=("$@")
else
  while IFS= read -r dir; do
    skills+=("$(basename "$dir")")
  done < <(find "$SOURCE_ROOT" -mindepth 1 -maxdepth 1 -type d)
fi

if [[ "${#skills[@]}" -eq 0 ]]; then
  echo "no skills found under $SOURCE_ROOT — nothing to install"
  exit 0
fi

installed=0
for name in "${skills[@]}"; do
  src_dir="$SOURCE_ROOT/$name"
  src_file="$src_dir/SKILL.md"
  if [[ ! -f "$src_file" ]]; then
    echo "skip: $name has no SKILL.md at $src_file" >&2
    continue
  fi

  dst_dir="$TARGET_ROOT/$name"
  dst_file="$dst_dir/SKILL.md"

  mkdir -p "$dst_dir"
  cp "$src_file" "$dst_file"
  chown -R "$TARGET_USER:$TARGET_GROUP" "$dst_dir"
  chmod 750 "$dst_dir"
  chmod 640 "$dst_file"

  bytes=$(wc -c <"$dst_file" | tr -d ' ')
  echo "installed: $name ($bytes bytes) → $dst_file"
  installed=$((installed + 1))
done

echo ""
echo "done: $installed skill(s) installed under $TARGET_ROOT"
echo "next: pm2 restart cloud-ai-builder && pm2 logs cloud-ai-builder --lines 30 | grep skill_registry_loaded"
