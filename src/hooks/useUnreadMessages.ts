"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

const POLL_INTERVAL = 15_000; // 15 seconds
const TITLE_BASE = "Gennety";

export function useUnreadMessages() {
  const { status } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const prevCountRef = useRef(-1); // -1 = sentinel, skip sound on first load
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const originalTitleRef = useRef(TITLE_BASE);
  const flashIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize audio lazily on first user interaction
  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/sounds/notification.mp3");
      audioRef.current.volume = 0.5;
    }
    return audioRef.current;
  }, []);

  // Play notification sound
  const playSound = useCallback(() => {
    try {
      const audio = ensureAudio();
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Browser may block autoplay — that's okay
      });
    } catch {
      // Audio not available
    }
  }, [ensureAudio]);

  // Flash tab title when there are unread messages
  const startTitleFlash = useCallback((count: number) => {
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
    }

    let showCount = true;
    flashIntervalRef.current = setInterval(() => {
      document.title = showCount
        ? `(${count > 99 ? "99+" : count}) ${TITLE_BASE}`
        : TITLE_BASE;
      showCount = !showCount;
    }, 1500);
  }, []);

  const stopTitleFlash = useCallback(() => {
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
    document.title = originalTitleRef.current;
  }, []);

  // Update favicon with badge
  const updateFavicon = useCallback((count: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw base favicon (simple G letter)
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("G", 16, 17);

    if (count > 0) {
      // Draw red dot
      const badgeSize = 12;
      const x = 32 - badgeSize / 2;
      const y = badgeSize / 2;

      ctx.beginPath();
      ctx.arc(x, y, badgeSize / 2 + 1, 0, Math.PI * 2);
      ctx.fillStyle = "#050505";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, badgeSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#3b82f6";
      ctx.fill();

      if (count <= 9) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px -apple-system, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(count), x, y + 0.5);
      }
    }

    // Apply to favicon
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = canvas.toDataURL("image/png");
  }, []);

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Poll for unread count
  useEffect(() => {
    if (status !== "authenticated") return;

    let mounted = true;

    async function fetchUnread() {
      try {
        const res = await fetch("/api/chats/unread");
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;

        const newCount = data.unread ?? 0;
        const prev = prevCountRef.current;

        setUnreadCount(newCount);

        // New messages arrived (skip first load when prev === -1)
        if (newCount > prev && prev >= 0) {
          playSound();

          // Browser notification if tab not focused
          if (
            document.hidden &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const diff = newCount - prev;
            new Notification("Gennety", {
              body: `You have ${diff} new message${diff > 1 ? "s" : ""}`,
              icon: "/icon-192.png",
              tag: "gennety-unread", // Collapse multiple notifications
            });
          }
        }

        // Update tab title and favicon
        if (newCount > 0) {
          startTitleFlash(newCount);
          updateFavicon(newCount);
        } else {
          stopTitleFlash();
          updateFavicon(0);
        }

        prevCountRef.current = newCount;
      } catch {
        // Network error, retry next interval
      }
    }

    fetchUnread();
    const interval = setInterval(fetchUnread, POLL_INTERVAL);

    return () => {
      mounted = false;
      clearInterval(interval);
      stopTitleFlash();
    };
  }, [status, playSound, startTitleFlash, stopTitleFlash, updateFavicon]);

  // Stop flashing when tab becomes visible
  useEffect(() => {
    function handleVisibility() {
      if (!document.hidden && unreadCount > 0) {
        // Keep the count in title but stop flashing
        document.title = `(${unreadCount > 99 ? "99+" : unreadCount}) ${TITLE_BASE}`;
        if (flashIntervalRef.current) {
          clearInterval(flashIntervalRef.current);
          flashIntervalRef.current = null;
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [unreadCount]);

  // Reset: call this when user reads messages (navigates to a chat)
  const markAsRead = useCallback(() => {
    // Refetch immediately after reading
    fetch("/api/chats/unread")
      .then((r) => r.json())
      .then((data) => {
        const count = data.unread ?? 0;
        setUnreadCount(count);
        prevCountRef.current = count;
        if (count === 0) {
          stopTitleFlash();
          updateFavicon(0);
        } else {
          document.title = `(${count > 99 ? "99+" : count}) ${TITLE_BASE}`;
          updateFavicon(count);
        }
      })
      .catch(() => {});
  }, [stopTitleFlash, updateFavicon]);

  return { unreadCount, markAsRead };
}
