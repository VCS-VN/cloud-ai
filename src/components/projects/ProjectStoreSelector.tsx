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
  onOpenChange,
  onSelectStore,
}: {
  stores: StoreOption[];
  selectedStoreSlug?: string | null;
  search: string;
  loading?: boolean;
  error?: string | null;
  onSearchChange: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  onSelectStore: (storeId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedStore = stores.find((store) => store.slug === selectedStoreSlug);
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface p-4 shadow-sm">
      <label
        className="mb-2 block text-eyebrow font-mono uppercase tracking-wide text-subtle"
        htmlFor="project-store-combobox"
      >
        Store
      </label>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="project-store-combobox"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className={cn("min-w-0 truncate", !selectedStore && "text-muted")}>
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
          className="z-[100] w-[var(--radix-popover-trigger-width)] p-0"
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
                <div className="py-6 text-center text-ui-sm text-muted">
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
                              handleOpenChange(false);
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
        <p className="m-0 mt-3 rounded-md border border-danger-bg bg-danger-bg px-3 py-2 text-ui-sm text-danger-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
