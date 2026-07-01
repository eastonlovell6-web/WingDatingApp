import { create } from "zustand";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

function mapAuthError(error: AuthError): string {
  if (error.status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (error.status === 422) return "Please enter a valid US phone number.";
  if (error.message.includes("expired")) return "Your code has expired. Request a new one below.";
  if (error.message.toLowerCase().includes("invalid")) return "That code isn't right. Double-check and try again.";
  return "Something went wrong. Please try again.";
}

type AuthState = {
  session: Session | null;
  user: User | null;
  isInitializing: boolean;
  isSendingOtp: boolean;
  isVerifying: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  sendOtp: (phone: string) => Promise<boolean>;
  verifyOtp: (phone: string, token: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  isInitializing: true,
  isSendingOtp: false,
  isVerifying: false,
  error: null,

  initialize: async () => {
    const { data } = await supabase.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      isInitializing: false,
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

  sendOtp: async (phone) => {
    set({ isSendingOtp: true, error: null });
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      set({ isSendingOtp: false, error: mapAuthError(error) });
      return false;
    }
    set({ isSendingOtp: false });
    return true;
  },

  verifyOtp: async (phone, token) => {
    set({ isVerifying: true, error: null });
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    if (error) {
      set({ isVerifying: false, error: mapAuthError(error) });
      return false;
    }
    set({ isVerifying: false, session: data.session, user: data.user });
    return true;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },

  clearError: () => set({ error: null }),
}));
