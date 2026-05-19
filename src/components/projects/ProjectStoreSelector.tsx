import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import type { StoreOption } from "@/shared/project-types";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/utils/cn";

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
  const [open, setOpen] = useState(false);
  const selectedStore = stores.find((store) => store.slug === selectedStoreSlug);

  return (
    <div className="space-y-sm">
      <label
        className="block text-[14px] font-[580] text-[var(--app-text)]"
        htmlFor="project-store-combobox"
      >
        Store
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="project-store-combobox"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal text-[15px]"
          >
            <span className={cn(!selectedStore && "text-[var(--app-muted)]")}>
              {selectedStore
                ? selectedStore.displayName
                : selectedStoreSlug
                  ? `Selected store: ${selectedStoreSlug}`
                  : "Search and select a store"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search stores..."
              value={search}
              onValueChange={onSearchChange}
            />
            <CommandList>
              {loading ? (
                <div className="py-md text-center text-[14px] text-[var(--app-muted)]">
                  Loading stores...
                </div>
              ) : (
                <>
                  <CommandEmpty>No stores found.</CommandEmpty>
                  {stores.length > 0 ? (
                    <CommandGroup>
                      {stores.map((store) => {
                        const isSelected = selectedStoreSlug === store.slug;
                        return (
                          <CommandItem
                            key={store.slug}
                            value={store.slug}
                            onSelect={() => {
                              onSelectStore(isSelected ? null : store.slug);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                isSelected ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {store.displayName}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ) : null}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error ? (
        <p className="m-0 rounded-md border border-[var(--app-border-strong)] bg-[var(--app-danger-bg)] px-md py-xs text-[13px] text-[var(--app-danger-text)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
