"use client";

import { createContext, useContext } from "react";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

interface UnreadContextValue {
  unreadCount: number;
  markAsRead: () => void;
}

const UnreadContext = createContext<UnreadContextValue>({
  unreadCount: 0,
  markAsRead: () => {},
});

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const value = useUnreadMessages();
  return (
    <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
