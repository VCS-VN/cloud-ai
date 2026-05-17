import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ProjectStoreSelector } from "@/components/projects/ProjectStoreSelector";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getStores } from "@/server/functions/projects";
import type { StoreListResult } from "@/shared/project-types";

export function ProjectSettingsInfoTab({
  selectedStoreSlug,
  onSelectedStoreChange,
  active = false,
}: {
  selectedStoreSlug?: string | null;
  onSelectedStoreChange?: (storeId: string | null) => void;
  active?: boolean;
}) {
  const loadStores = useServerFn(getStores);
  const [search, setSearch] = useState("");
  const [page] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 800);

  const storesQuery = useQuery<StoreListResult>({
    queryKey: ["project-settings-stores", page, debouncedSearch],
    enabled: active,
    queryFn: () =>
      loadStores({
        data: {
          page,
          limit: 10,
          search: debouncedSearch,
        },
      }),
  });

  return (
    <ProjectStoreSelector
      stores={storesQuery.data?.stores ?? []}
      selectedStoreSlug={selectedStoreSlug ?? null}
      search={search}
      loading={storesQuery.isLoading || storesQuery.isFetching}
      error={storesQuery.error ? "Unable to load stores. Please try again." : null}
      onSearchChange={setSearch}
      onSelectStore={(storeId) => onSelectedStoreChange?.(storeId)}
    />
  );
}
