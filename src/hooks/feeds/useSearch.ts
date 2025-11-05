import { useQuery } from "@tanstack/react-query";
import { useUser } from "./useUser";
import { User } from "@auth0/auth0-spa-js";
import { ActivityResponse, UserResponse } from "@stream-io/feeds-client";
import { FeedsClient } from "@stream-io/feeds-client";
import { useToast } from "../../contexts/ToastContext";
import { useState } from "react";

// Define a unique query key factory
export const activitiesQueryKey = (
  query: string,
  mode: "$q" | "$autocomplete"
) => ["activities", query, mode];

export const usersQueryKey = (query: string) => ["users", query];

const fetchActivities = async (
  client: FeedsClient,
  user: User,
  searchQuery: string = "",
  searchMode: "$q" | "$autocomplete" = "$q",
  showError: (message: string) => void
): Promise<ActivityResponse[]> => {
  if (!client || !user) return [];

  try {
    const params = {
      limit: 50,
      sort: [{ field: "created_at", direction: -1 }],
      ...(searchQuery.trim()
        ? {
            filter: {
              text: { [searchMode]: searchQuery.trim() },
            },
          }
        : {}),
    };

    const response = await client.queryActivities(params);
    return (
      response.activities?.filter((activity) => activity.type === "post") || []
    );
  } catch (error) {
    console.error("Error fetching activities:", error);
    showError("Error fetching activities");
    throw error;
  }
};

const fetchUsers = async (
  client: FeedsClient,
  user: User,
  searchQuery: string = "",
  showError: (message: string) => void
): Promise<UserResponse[]> => {
  if (!client || !user || !searchQuery.trim()) return [];

  try {
    const { users } = await client.queryUsers({
      payload: {
        filter_conditions: {
          name: {
            $autocomplete: searchQuery.trim(),
          },
        },
      },
    });

    return users || [];
  } catch (error) {
    console.error("Error fetching users:", error);
    showError("Error fetching users");
    throw error;
  }
};

export function useSearch() {
  const { client, user } = useUser();
  const { showError } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"$q" | "$autocomplete">("$autocomplete");

  const {
    data: activities = [],
    isLoading: isLoadingActivities,
    isError: isErrorActivities,
    refetch: refetchActivities,
  } = useQuery({
    queryKey: activitiesQueryKey(searchQuery, searchMode),
    queryFn: () =>
      fetchActivities(
        client as FeedsClient,
        user as User,
        searchQuery,
        searchMode,
        showError
      ),
    enabled: !!client && !!user,
    refetchOnWindowFocus: false,
    staleTime: 0, // Always refetch when query changes
    gcTime: 0, // Don't cache
  });

  const {
    data: users = [],
    isLoading: isLoadingUsers,
    isError: isErrorUsers,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: usersQueryKey(searchQuery),
    queryFn: () =>
      fetchUsers(
        client as FeedsClient,
        user as User,
        searchQuery,
        showError
      ),
    enabled: !!client && !!user,
    refetchOnWindowFocus: false,
    staleTime: 0, // Always refetch when query changes
    gcTime: 0, // Don't cache
  });

  const searchActivities = (
    query: string,
    mode: "$q" | "$autocomplete" = "$q"
  ) => {
    setSearchQuery(query);
    setSearchMode(mode);
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const refetch = () => {
    refetchActivities();
    refetchUsers();
  };

  return {
    activities,
    users,
    searchQuery,
    searchMode,
    isLoading: isLoadingActivities || isLoadingUsers,
    error: isErrorActivities || isErrorUsers,
    searchActivities,
    clearSearch,
    refetch,
  };
}
