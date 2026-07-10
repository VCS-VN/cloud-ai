import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { UserAvatar } from "@/components/auth/UserMenu";
import { EpisCloudActivateDialog } from "@/components/profile/EpisCloudActivateDialog";
import { Button } from "@/components/ui/button";
import { activateEpisCloud } from "@/server/functions/auth";
import type { AuthUserSummary } from "@/auth/types";
import { SettingsInput } from "./SettingsInput";
import { activatedAtFormatter, getFirstName } from "../utils";

export function ProfileSection({
  user,
  displayName,
  onUserChange,
}: {
  user: AuthUserSummary;
  displayName: string;
  onUserChange: (user: AuthUserSummary) => void;
}) {
  return (
    <section
      id="profile"
      className="scroll-mt-20 rounded-2xl border border-hairline bg-surface"
    >
      <header className="flex items-center justify-between border-b border-hairline px-6 py-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Profile</h2>
          <p className="mt-0.5 text-xs text-muted">
            Shown on projects and collaboration invites.
          </p>
        </div>
      </header>
      <div className="grid grid-cols-1 items-start gap-6 p-6 md:grid-cols-[112px_1fr]">
        <div>
          <UserAvatar user={user} size="lg" />
          <button className="mt-2 text-xs text-muted hover:text-ink">
            Change photo
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsInput label="Full name" value={displayName} />
          <SettingsInput
            label="Username"
            value={getFirstName(user.email)}
            prefix="builder.myepis.cloud/"
            mono
          />
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-muted">Email</span>
            <input
              className="h-10 rounded-lg border border-hairline bg-paper px-3 text-ui-sm outline-none focus:border-ink"
              value={user.email}
              readOnly
            />
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-emerald-700">
              <Check aria-hidden="true" size={12} />
              Verified · 2026-04-12
            </span>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-muted">Bio</span>
            <textarea
              rows={2}
              className="rounded-lg border border-hairline bg-paper px-3 py-2 text-ui-sm leading-relaxed outline-none focus:border-ink"
              defaultValue="Designer & founder. Building more prototypes and fewer decks."
            />
          </label>
        </div>
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-hairline px-6 py-4">
        <Button variant="ghost" className="!h-9">
          Cancel
        </Button>
        <Button className="!h-9">Save changes</Button>
      </footer>
      <EpisCloudSection user={user} onUserChange={onUserChange} />
    </section>
  );
}

function EpisCloudSection({
  user,
  onUserChange,
}: {
  user: AuthUserSummary;
  onUserChange: (user: AuthUserSummary) => void;
}) {
  const activateEpisCloudFn = useServerFn(activateEpisCloud);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [tenantIdCopied, setTenantIdCopied] = useState(false);

  async function handleActivate() {
    if (activating) return;
    setActivating(true);
    setActivateError(null);
    try {
      const updated = await activateEpisCloudFn();
      onUserChange(updated);
      setConfirmOpen(false);
    } catch (error) {
      setActivateError(
        error instanceof Error
          ? error.message
          : "Could not activate EpisCloud. Please try again.",
      );
    } finally {
      setActivating(false);
    }
  }

  async function handleCopyTenantId() {
    if (!user.episCloudTenantId) return;
    try {
      await navigator.clipboard.writeText(user.episCloudTenantId);
      setTenantIdCopied(true);
      setTimeout(() => setTenantIdCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser; nothing to recover from here.
    }
  }

  return (
    <div className="border-t border-hairline px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-ui-sm font-semibold tracking-tight text-ink">
            EpisCloud
          </h3>
          <p className="mt-0.5 max-w-prose text-xs text-muted">
            EpisCloud powers the AI features on your storefront. Activate it to
            create your account with EpisCloud.
          </p>
        </div>
        {user.episCloudTenantId ? (
          <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-success-bg bg-success-bg px-2 text-[11px] font-medium text-success-fg">
            <span className="h-1.5 w-1.5 rounded-full bg-success-dot" />
            Activated
          </span>
        ) : null}
      </div>

      {user.episCloudTenantId ? (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div>
            <p className="m-0 text-[11px] uppercase tracking-wide text-subtle">
              Activated on
            </p>
            <p className="m-0 mt-0.5 text-ui-sm text-ink">
              {user.episCloudActivatedAt
                ? activatedAtFormatter.format(
                    new Date(user.episCloudActivatedAt),
                  )
                : "—"}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span aria-live="polite" className="text-ui-sm">
            {activateError ? (
              <span className="text-danger-fg">{activateError}</span>
            ) : null}
          </span>
          <Button
            type="button"
            className="!h-9"
            onClick={() => setConfirmOpen(true)}
          >
            Activate EpisCloud
          </Button>
        </div>
      )}

      <EpisCloudActivateDialog
        open={confirmOpen}
        activating={activating}
        error={activateError}
        onCancel={() => {
          setConfirmOpen(false);
          setActivateError(null);
        }}
        onConfirm={handleActivate}
      />
    </div>
  );
}
