import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FeedsClient } from "@stream-io/feeds-client";
import { useToast } from "../../contexts/ToastContext";
import { useAuth0 } from "@auth0/auth0-react";
import { User } from "@auth0/auth0-spa-js";
import nameUtils from "../../utils/nameUtils";

const streamBaseUrl = "https://chat.stream-io-api.com";

interface AuthTokenResponse {
  token: string;
}

const USER_QUERY_KEY = ["user"];

const connectUser = async (user: User, showError: (message: string) => void): Promise<FeedsClient> => {
  const apiKey = import.meta.env.VITE_STREAM_API_KEY!;

  console.log('🔑 Connecting user with API key:', apiKey ? '✅ Set' : '❌ Missing');

  // Genero token para user de Auth0
  const res = await fetch("/api/feeds-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: user.nickname,
      name: user.name,
    }),
  });

  if (!res.ok) {
    showError("Failed to get authentication token");
    throw new Error("Failed to get authentication token");
  }

  const { token }: AuthTokenResponse = await res.json();

  // Create FeedsClient pointing to Stream's servers (not localhost!)
  const client = new FeedsClient(apiKey, { base_url: streamBaseUrl });
  
  try {
    await client.connectUser({ id: user.nickname! }, token);
    console.log('✅ Successfully connected to Stream Feeds');
  } catch (error) {
    console.error('❌ WebSocket connection error:', error);
    // Don't throw here - let the client be returned even if WS fails initially
  }

  return client;
};

export function useUser() {
  const [showUserModal, setShowUserModal] = useState(false);
  const { isAuthenticated, user: auth0User } = useAuth0();
  const { showError } = useToast();

  // Query for user data - now properly depends on auth0User
  const {
    data: user,
    isLoading: loading,
    error: userError,
  } = useQuery({
    queryKey: ["user", auth0User?.nickname], // Key includes auth0User to trigger refetch
    queryFn: () => {
      if (!auth0User) return null;
      
      return {
        ...auth0User,
        nickname: nameUtils.sanitizeUserId(auth0User.nickname!),
      };
    },
    enabled: !!auth0User, // Only run when auth0User exists
    staleTime: Infinity, 
    gcTime: Infinity, 
  });
  
  // Query for client connection - now depends on user from query
  const {
    data: client,
    isLoading: clientLoading,
    error: clientError,
  } = useQuery({
    queryKey: ["client", user?.nickname], // Depends on user?.nickname from query
    queryFn: () => connectUser(user!, showError),
    enabled: !!user?.nickname, // Only run when user has nickname
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const retryConnection = () => {
    window.location.reload();
  };

  const getUserInitials = (userName: string) => {
    return userName
      .split(" ")
      .map((name) => name.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isReady = !!user && !!client;

  return {
    user,
    client,
    loading: loading || clientLoading, // Combined loading state
    isReady,
    error: userError || clientError,
    showUserModal,
    getUserInitials,
    retryConnection,
  };
}