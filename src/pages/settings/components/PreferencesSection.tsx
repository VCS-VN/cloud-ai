import { useState } from "react";
import type { AppTheme } from "@/theme";
import { ToggleRow } from "./ToggleRow";
import { themeOptions } from "../utils";

export function PreferencesSection({
  theme,
  setTheme,
}: {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}) {
  const [toggles, setToggles] = useState({
    email: true,
    preview: true,
    credits: false,
    beta: false,
  });
  return (
    <section
      id="preferences"
      className="scroll-mt-20 overflow-hidden rounded-2xl border border-hairline bg-surface"
    >
      <header className="border-b border-hairline px-6 py-5">
        <h2 className="text-base font-semibold tracking-tight">Preferences</h2>
        <p className="mt-0.5 text-xs text-muted">
          Applies to your Cloud AI account.
        </p>
      </header>
      <ul className="divide-y divide-hairline">
        <ToggleRow
          title="Email when builds finish"
          description="Send a summary whenever Cloud AI finishes a project build."
          enabled={toggles.email}
          onToggle={() => setToggles((v) => ({ ...v, email: !v.email }))}
        />
        <ToggleRow
          title="Automatically deploy previews"
          description="Each new AI message creates a shareable preview URL."
          enabled={toggles.preview}
          onToggle={() => setToggles((v) => ({ ...v, preview: !v.preview }))}
        />
        <ToggleRow
          title="Warn when credits run low"
          description="Notify me when fewer than 100 credits remain."
          enabled={toggles.credits}
          onToggle={() => setToggles((v) => ({ ...v, credits: !v.credits }))}
        />
        <ToggleRow
          title="Join Beta"
          description="Get new features early — they may be unstable."
          enabled={toggles.beta}
          onToggle={() => setToggles((v) => ({ ...v, beta: !v.beta }))}
        />
        <li className="flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="text-ui-sm font-medium">Interface theme</div>
            <div className="mt-0.5 text-xs text-muted">
              Choose how Cloud AI appears on this device.
            </div>
          </div>
          <div className="grid grid-cols-3 gap-0.5 rounded-md bg-ink/[0.05] p-0.5">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={`flex h-8 items-center justify-center gap-1 rounded px-2 text-[11.5px] font-medium transition ${theme === option.value ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
              >
                <option.icon aria-hidden="true" size={14} /> {option.label}
              </button>
            ))}
          </div>
        </li>
      </ul>
    </section>
  );
}
