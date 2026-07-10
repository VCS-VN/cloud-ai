import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TeamSection({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  return (
    <section
      id="team"
      className="scroll-mt-20 rounded-2xl border border-hairline bg-surface"
    >
      <header className="flex items-center justify-between border-b border-hairline px-6 py-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Team workspace
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Invite collaborators to edit projects. Pro supports up to{" "}
            <span className="font-mono">3</span> seats.
          </p>
        </div>
        <Button className="!h-9">
          <Plus aria-hidden="true" size={14} /> Invite member
        </Button>
      </header>
      <ul className="divide-y divide-hairline">
        <TeamMember
          initials="TM"
          name={displayName}
          note="(you)"
          email={email}
          date="2026-01-08"
          role="Owner"
        />
        <TeamMember
          initials="LH"
          name="Linh Hoang"
          email="linh@maple.studio"
          date="2026-03-22"
          role="Editor"
        />
        <TeamMember
          initials="AT"
          name="An Tran"
          note="(pending)"
          email="an@example.com"
          date="Invited 2 days ago"
          role="Resend"
        />
      </ul>
    </section>
  );
}

function TeamMember({
  initials,
  name,
  note,
  email,
  date,
  role,
}: {
  initials: string;
  name: string;
  note?: string;
  email: string;
  date: string;
  role: string;
}) {
  return (
    <li className="flex items-center gap-4 px-6 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-paper">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-ui-sm font-medium tracking-tight">
          {name}{" "}
          {note ? (
            <span className="ml-1 font-mono text-[11px] text-muted">
              {note}
            </span>
          ) : null}
        </div>
        <div className="truncate text-xs text-muted">{email}</div>
      </div>
      <span className="hidden font-mono text-[11px] uppercase tracking-widest text-subtle sm:inline-block">
        {date}
      </span>
      <span className="inline-flex h-7 items-center rounded-md bg-ink/[0.06] px-2.5 text-[11px] font-medium">
        {role}
      </span>
    </li>
  );
}
