---
target: src/app/auth-provider.tsx
---
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/http/client";

export type UserProfile = {
  id: string;
  phoneNumber?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

type AuthContextValue = {
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function clearAuthTokens() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const query = useQuery({
    queryKey: ["auth", "profile"],
    enabled: typeof window !== "undefined",
    retry: false,
    queryFn: async (): Promise<UserProfile> => {
      const res = await apiClient.get<UserProfile>("/api/v1/auth/profile");
      return res.data;
    },
  });

  useEffect(() => {
    if (query.data) {
      setProfile(query.data);
    } else if (query.isError) {
      clearAuthTokens();
      setProfile(null);
    }
  }, [query.data, query.isError]);

  const logout = () => {
    clearAuthTokens();
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        profile,
        isLoading: query.isLoading,
        isAuthenticated: profile !== null,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
