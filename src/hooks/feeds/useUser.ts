import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FeedsClient } from "@stream-io/feeds-client";
import toast from "react-hot-toast";
import { useAuth0 } from "@auth0/auth0-react";
import { User } from "@auth0/auth0-spa-js";

// Use VITE_ prefix for frontend environment variables
const defaultApiKey = import.meta.env.VITE_STREAM_API_KEY!;
// const defaultApiKey = import.meta.env.STREAM_API_KEY!;
// For Stream Feeds, we should connect to Stream's servers, not localhost
const streamBaseUrl = "https://chat.stream-io-api.com";

interface AuthTokenResponse {
  token: string;
}

// Query key for user data
const USER_QUERY_KEY = ["user"];

// Connect user to Stream API
const connectUser = async (user: User): Promise<FeedsClient> => {
  const apiKey = import.meta.env.VITE_STREAM_API_KEY!;
  // const apiKey = import.meta.env.STREAM_API_KEY!;

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

  console.log('📡 Token request response:', res);

  if (!res.ok) {
    toast.error("Failed to get authentication token");
    throw new Error("Failed to get authentication token");
  }

  const { token }: AuthTokenResponse = await res.json();

  // Create FeedsClient pointing to Stream's servers (not localhost!)
  console.log('🍃 Creating FeedsClient with Stream base URL:', streamBaseUrl);
  const client = new FeedsClient(apiKey, { base_url: streamBaseUrl });
  
  console.log('🔗 Connecting user to Stream Feeds...', { userId: user.nickname, hasToken: !!token });
  
  try {
    await client.connectUser({ id: user.nickname! }, token);
    console.log('✅ Successfully connected to Stream Feeds');
  } catch (error) {
    console.error('❌ WebSocket connection error:', error);
    // Don't throw here - let the client be returned even if WS fails initially
  }

  console.log('🎯 Token:', token.substring(0, 50) + '...');
  console.log('👤 User connected:', user.nickname);

  return client;
};

export function useUser() {
  // const queryClient = useQueryClient();
  const [showUserModal, setShowUserModal] = useState(false);
  const { isAuthenticated, user: auth0User } = useAuth0();

  // Query for user data
  const {
    data: user,
    isLoading: loading,
    error: userError,
  } = useQuery({
    queryKey: USER_QUERY_KEY,
    queryFn: () => auth0User,
    staleTime: Infinity, 
    gcTime: Infinity, 
  });

  if (loading) {
    console.log('loading', loading);
  }
  
  
  // Query for client connection
  const {
    data: client,
    isLoading: clientLoading,
    error: clientError,
  } = useQuery({
    queryKey: ["client", auth0User?.nickname],
    queryFn: () => connectUser(auth0User!),
    enabled: !!auth0User,
    staleTime: Infinity,
    gcTime: Infinity,
  });

//   // Mutation for creating user
//   const createUserMutation = useMutation({
//     mutationFn: async ({
//       name,
//       customSettings,
//     }: {
//       name: string;
//       customSettings?: CustomSettings;
//     }) => {
//       const randomSuffix = Math.random().toString(36).substring(2, 8);
//       const userId = `user-${randomSuffix}`;
//       const userData: User = { id: userId, name };

//       const client = await connectUser(userData, customSettings);
//       saveUserToStorage(userData);

//       return { user: userData, client };
//     },
//     onSuccess: ({ user }) => {
//       queryClient.setQueryData(USER_QUERY_KEY, user);
//       setShowUserModal(false);
//     },
//   });

//   // Mutation for updating user
//   const updateUserMutation = useMutation({
//     mutationFn: async (userData: User) => {
//       saveUserToStorage(userData);
//       return userData;
//     },
//     onSuccess: (userData) => {
//       queryClient.setQueryData(USER_QUERY_KEY, userData);
//     },
//   });

//   // Mutation for clearing user
//   const clearUserMutation = useMutation({
//     mutationFn: async () => {
//       saveUserToStorage(null);
//       // Also clear custom settings when user logs out
//       if (typeof window !== "undefined") {
//         localStorage.removeItem("customSettings");
//       }
//       return null;
//     },
//     onSuccess: () => {
//       queryClient.setQueryData(USER_QUERY_KEY, null);
//       queryClient.removeQueries({ queryKey: ["client"] });
//     },
//   });

//   // Show modal if no user exists
//   useEffect(() => {
//     if (!loading && !user) {
//       setShowUserModal(true);
//     } else {
//       setShowUserModal(false);
//     }
//   }, [loading, user]);

//   const updateUser = (userData: User) => {
//     updateUserMutation.mutate(userData);
//   };

//   const clearUser = () => {
//     clearUserMutation.mutate();
//   };

//   const createUser = async (name: string, customSettings?: CustomSettings) => {
//     createUserMutation.mutate({ name, customSettings });
//   };

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

  // const error = userError || clientError;
//   const isAuthenticated = !!user;

  return {
    user: auth0User,
    client,
    loading: clientLoading,
    error: userError || clientError,
    showUserModal,
    // updateUser,
    // clearUser,
    getUserInitials,
    // createUser,
    retryConnection,
    // isAuthenticated,
  };
}
