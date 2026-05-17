import { useMemo } from "react";
import type { StoreOption } from "@/shared/project-types";

export function ProjectStoreSelector({
  stores,
  selectedStoreSlug,
  search,
  loading = false,
  error,
  onSearchChange,
  onSelectStore,
}: {
  stores: StoreOption[];
  selectedStoreSlug?: string | null;
  search: string;
  loading?: boolean;
  error?: string | null;
  onSearchChange: (value: string) => void;
  onSelectStore: (storeId: string | null) => void;
}) {
  const selectedStore = stores.find((store) => store.slug === selectedStoreSlug);
  const optionsByLabel = useMemo(() => {
    const next = new Map<string, StoreOption>();
    for (const store of stores) next.set(store.displayName, store);
    return next;
  }, [stores]);

  function handleInputValue(value: string) {
    onSearchChange(value);
    if (!value) {
      onSelectStore(null);
      return;
    }
    const matchedStore = optionsByLabel.get(value);
    if (matchedStore) onSelectStore(matchedStore.slug);
  }

  return (
    <div className="space-y-sm">
      <label className="block text-[14px] font-[580] text-[var(--app-text)]" htmlFor="project-store-combobox">
        Store
      </label>
      <input
        id="project-store-combobox"
        className="w-full rounded-md border border-[var(--app-border)] bg-[var(--app-bg)] h-11 px-md py-xs text-[15px] text-[var(--app-text)] outline-none transition-colors duration-200 placeholder:text-[var(--app-muted)] focus:border-[var(--app-border-strong)] focus:ring-2 focus:ring-[var(--app-focus-ring)]"
        type="search"
        role="combobox"
        list="project-store-options"
        value={search}
        onChange={(event) => handleInputValue(event.currentTarget.value)}
        placeholder="Search and select a store slug"
        autoComplete="off"
      />
      <datalist id="project-store-options">
        {stores.map((store) => (
          <option key={store.slug} value={store.displayName} />
        ))}
      </datalist>
      {selectedStore ? (
        <p className="m-0 rounded-md bg-[var(--color-block-lime)] px-md py-xs text-[14px] text-[var(--app-on-color-block)]">
          Selected: {selectedStore.displayName}
        </p>
      ) : selectedStoreSlug ? (
        <p className="m-0 rounded-md bg-[var(--app-control)] px-md py-xs text-[14px] text-[var(--app-muted)]">
          Selected store: {selectedStoreSlug}
        </p>
      ) : null}
      {loading ? (
        <p className="m-0 rounded-md bg-[var(--app-control)] px-md py-xs text-[14px] text-[var(--app-muted)]">
          Loading stores...
        </p>
      ) : stores.length === 0 ? (
        <p className="m-0 rounded-md bg-[var(--app-control)] px-md py-xs text-[14px] text-[var(--app-muted)]">
          No stores found.
        </p>
      ) : null}
      {error ? (
        <p className="m-0 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-danger-bg)] px-md py-xs text-[13px] text-[var(--app-danger-text)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
