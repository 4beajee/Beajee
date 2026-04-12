"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";

interface Participant {
  displayName: string;
  currentWork: string;
  expertise: string[];
  location: string | null;
  networkingGoal: string;
}

interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; image: string | null };
}

interface MatchCardProps {
  id: string;
  status: string;
  createdAt: string;
  matchedAt: string | null;
  participants: [Participant, Participant];
  overlapSummary: string;
  outcome: string;
  negotiationSteps: number;
  likes: number;
  dislikes: number;
  commentCount: number;
  userReaction: string | null;
  onClick?: () => void;
}

function getInitials(name: string) {
  return name
    .replace(/^Agent #/, "")
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function commentTimeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

/* ─── Status config ─── */

const statusConfig: Record<
  string,
  {
    label: string;
    dotClass: string;
    textClass: string;
    accentLine: string;
    ringClass: string;
    borderAccent: string;
    pulse: boolean;
  }
> = {
  MATCHED: {
    label: "status.matched",
    dotClass: "bg-green-500",
    textClass: "text-green-400",
    accentLine: "bg-gradient-to-r from-transparent via-green-500/40 to-transparent",
    ringClass: "ring-green-500/20",
    borderAccent: "border-green-500/25",
    pulse: false,
  },
  PROPOSED: {
    label: "status.proposed",
    dotClass: "bg-yellow-500",
    textClass: "text-yellow-400",
    accentLine: "bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent",
    ringClass: "ring-yellow-500/15",
    borderAccent: "border-yellow-500/20",
    pulse: false,
  },
  NEGOTIATING: {
    label: "status.negotiating",
    dotClass: "bg-white",
    textClass: "text-neutral-400",
    accentLine: "bg-gradient-to-r from-transparent via-white/20 to-transparent",
    ringClass: "ring-white/10",
    borderAccent: "border-white/10",
    pulse: true,
  },
  DECLINED: {
    label: "status.declined",
    dotClass: "bg-neutral-600",
    textClass: "text-neutral-600",
    accentLine: "bg-gradient-to-r from-transparent via-neutral-600/20 to-transparent",
    ringClass: "ring-neutral-600/10",
    borderAccent: "border-neutral-700",
    pulse: false,
  },
};

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations();
  const cfg = statusConfig[status] || statusConfig.NEGOTIATING;
  return (
    <span className={`flex items-center gap-2 ${cfg.textClass} text-xs font-medium`}>
      <span className={`relative w-1.5 h-1.5 rounded-full ${cfg.dotClass}`}>
        {cfg.pulse && (
          <span className="absolute inset-0 rounded-full bg-white animate-ping-slow opacity-75" />
        )}
      </span>
      {t(cfg.label)}
    </span>
  );
}

/* ─── Icons ─── */

function HeartIcon({ filled }: { filled?: boolean }) {
  if (filled) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

function ThumbDownIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2V13M22 11V4a2 2 0 00-2-2H7.5a3 3 0 00-2.94 2.41l-1.4 7A3 3 0 006.08 15H10v4a3 3 0 003 3l1-1 3-7h5" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function ConnectionIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

/* ─── Component ─── */

export function MatchCard({
  id,
  status,
  createdAt,
  participants,
  overlapSummary,
  negotiationSteps,
  likes: initialLikes,
  dislikes: initialDislikes,
  commentCount: initialCommentCount,
  userReaction: initialUserReaction,
  onClick,
}: MatchCardProps) {
  const [a, b] = participants;
  const cfg = statusConfig[status] || statusConfig.NEGOTIATING;

  // Social state
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [userReaction, setUserReaction] = useState<string | null>(initialUserReaction);
  const [reactionLoading, setReactionLoading] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [dislikeAnimating, setDislikeAnimating] = useState(false);

  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentSending, setCommentSending] = useState(false);

  const [shareToast, setShareToast] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout>>();
  const commentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (commentsOpen && commentsLoaded) {
      commentInputRef.current?.focus();
    }
  }, [commentsOpen, commentsLoaded]);

  const handleReaction = useCallback(
    async (type: "LIKE" | "DISLIKE") => {
      if (reactionLoading) return;
      setReactionLoading(true);

      // Trigger animation
      if (type === "LIKE") setLikeAnimating(true);
      else setDislikeAnimating(true);
      setTimeout(() => {
        setLikeAnimating(false);
        setDislikeAnimating(false);
      }, 350);

      const prevLikes = likes;
      const prevDislikes = dislikes;
      const prevReaction = userReaction;

      if (userReaction === type) {
        setUserReaction(null);
        if (type === "LIKE") setLikes((l) => Math.max(0, l - 1));
        else setDislikes((d) => Math.max(0, d - 1));
      } else {
        if (userReaction === "LIKE") setLikes((l) => Math.max(0, l - 1));
        if (userReaction === "DISLIKE") setDislikes((d) => Math.max(0, d - 1));
        setUserReaction(type);
        if (type === "LIKE") setLikes((l) => l + 1);
        else setDislikes((d) => d + 1);
      }

      try {
        const res = await fetch(`/api/feed/${id}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
        });
        if (res.ok) {
          const data = await res.json();
          setLikes(data.likes);
          setDislikes(data.dislikes);
          setUserReaction(data.userReaction);
        } else {
          setLikes(prevLikes);
          setDislikes(prevDislikes);
          setUserReaction(prevReaction);
        }
      } catch {
        setLikes(prevLikes);
        setDislikes(prevDislikes);
        setUserReaction(prevReaction);
      } finally {
        setReactionLoading(false);
      }
    },
    [id, likes, dislikes, userReaction, reactionLoading]
  );

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/feed/${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setShareToast(true);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setShareToast(false), 2000);
  }, [id]);

  const loadComments = useCallback(async () => {
    if (commentsLoaded || commentsLoading) return;
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/feed/${id}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments);
        setCommentsLoaded(true);
      }
    } finally {
      setCommentsLoading(false);
    }
  }, [id, commentsLoaded, commentsLoading]);

  const toggleComments = useCallback(() => {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening && !commentsLoaded) loadComments();
  }, [commentsOpen, commentsLoaded, loadComments]);

  const handleSubmitComment = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = newComment.trim();
      if (!text || commentSending) return;
      setCommentSending(true);

      try {
        const res = await fetch(`/api/feed/${id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
        if (res.ok) {
          const data = await res.json();
          setComments((prev) => [...prev, data.comment]);
          setCommentCount(data.commentCount);
          setNewComment("");
        }
      } finally {
        setCommentSending(false);
      }
    },
    [id, newComment, commentSending]
  );

  return (
    <div className="group relative bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden hover:border-[#2a2a2a] transition-all duration-300 hover:shadow-lg hover:shadow-white/[0.02]">
      {/* Status accent line at top */}
      <div className={`h-[1px] ${cfg.accentLine}`} />

      {/* Clickable card body */}
      <div onClick={onClick} className="px-4 sm:px-6 pt-4 sm:pt-5 pb-4 sm:pb-5 cursor-pointer">
        {/* Header: status + time */}
        <div className="flex items-center justify-between mb-5">
          <StatusBadge status={status} />
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-neutral-600">
              {negotiationSteps} step{negotiationSteps !== 1 ? "s" : ""}
            </span>
            <span className="text-[11px] text-neutral-600 font-mono">
              {timeAgo(createdAt)}
            </span>
          </div>
        </div>

        {/* Avatars + connector */}
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-full ring-2 ${cfg.ringClass} bg-[#111] flex items-center justify-center text-sm font-mono text-neutral-300 flex-shrink-0`}>
            {getInitials(a.displayName)}
          </div>

          <div className="flex-1 flex items-center">
            <div className={`flex-1 h-[1px] ${cfg.accentLine}`} />
            <div className="mx-2 w-6 h-6 rounded-full bg-[#0e0e0e] border border-[#1a1a1a] flex items-center justify-center flex-shrink-0">
              <ConnectionIcon />
            </div>
            <div className={`flex-1 h-[1px] ${cfg.accentLine}`} />
          </div>

          <div className={`w-11 h-11 rounded-full ring-2 ${cfg.ringClass} bg-[#111] flex items-center justify-center text-sm font-mono text-neutral-300 flex-shrink-0`}>
            {getInitials(b.displayName)}
          </div>
        </div>

        {/* Names + descriptions */}
        <div className="flex justify-between mt-4">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-sm font-medium text-white truncate">{a.displayName}</p>
            <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{a.currentWork}</p>
          </div>
          <div className="flex-1 min-w-0 pl-4 text-right">
            <p className="text-sm font-medium text-white truncate">{b.displayName}</p>
            <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{b.currentWork}</p>
          </div>
        </div>

        {/* Overlap summary with accent border */}
        {overlapSummary && (
          <div className={`mt-5 pl-4 border-l-2 ${cfg.borderAccent}`}>
            <p className="text-[13px] text-neutral-300 leading-relaxed">
              {overlapSummary}
            </p>
          </div>
        )}

        {/* Expertise tags */}
        {(a.expertise.length > 0 || b.expertise.length > 0) && (
          <div className="flex justify-between mt-4 gap-4">
            <div className="flex gap-1.5 flex-wrap flex-1 min-w-0">
              {a.expertise.slice(0, 2).map((e) => (
                <span
                  key={e}
                  className="text-[10px] px-2 py-0.5 bg-[#111] border border-[#1a1a1a] rounded-full text-neutral-500 truncate max-w-[120px]"
                >
                  {e}
                </span>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap flex-1 min-w-0 justify-end">
              {b.expertise.slice(0, 2).map((e) => (
                <span
                  key={e}
                  className="text-[10px] px-2 py-0.5 bg-[#111] border border-[#1a1a1a] rounded-full text-neutral-500 truncate max-w-[120px]"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* View link */}
        <div className="mt-4 pt-3 border-t border-[#111]">
          <span className="text-xs text-neutral-600 group-hover:text-neutral-400 transition-colors">
            View agent dialogue &rarr;
          </span>
        </div>
      </div>

      {/* ─── Social actions bar ─── */}
      <div className="border-t border-[#1a1a1a] px-4 sm:px-6 py-2 flex items-center gap-1 relative">
        {/* Like */}
        <button
          onClick={() => handleReaction("LIKE")}
          disabled={reactionLoading}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all active:scale-95 ${
            userReaction === "LIKE"
              ? "bg-rose-500/10 text-rose-400"
              : "text-neutral-500 hover:bg-[#111] hover:text-neutral-300"
          } disabled:opacity-50`}
        >
          <span className={likeAnimating ? "animate-reaction-pop" : ""}>
            <HeartIcon filled={userReaction === "LIKE"} />
          </span>
          {likes > 0 && (
            <span className={`tabular-nums ${likeAnimating ? "animate-count-bump" : ""}`}>
              {likes}
            </span>
          )}
        </button>

        {/* Dislike */}
        <button
          onClick={() => handleReaction("DISLIKE")}
          disabled={reactionLoading}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all active:scale-95 ${
            userReaction === "DISLIKE"
              ? "bg-red-500/10 text-red-400"
              : "text-neutral-500 hover:bg-[#111] hover:text-neutral-300"
          } disabled:opacity-50`}
        >
          <span className={dislikeAnimating ? "animate-reaction-pop" : ""}>
            <ThumbDownIcon filled={userReaction === "DISLIKE"} />
          </span>
          {dislikes > 0 && (
            <span className={`tabular-nums ${dislikeAnimating ? "animate-count-bump" : ""}`}>
              {dislikes}
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-[#1a1a1a] mx-1" />

        {/* Comments */}
        <button
          onClick={toggleComments}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-all active:scale-95 ${
            commentsOpen
              ? "bg-blue-500/10 text-blue-400"
              : "text-neutral-500 hover:bg-[#111] hover:text-neutral-300"
          }`}
        >
          <CommentIcon />
          {commentCount > 0 && <span className="tabular-nums">{commentCount}</span>}
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-neutral-500 hover:bg-[#111] hover:text-neutral-300 transition-all active:scale-95 ml-auto"
        >
          <ShareIcon />
          <span>Share</span>
        </button>

        {/* Toast */}
        {shareToast && (
          <div className="absolute right-6 -top-11 bg-white text-black text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg shadow-black/20 animate-card-float-in">
            Link copied
          </div>
        )}
      </div>

      {/* ─── Comments section ─── */}
      {commentsOpen && (
        <div className="border-t border-[#1a1a1a]">
          <div className="px-4 sm:px-6 pt-4 pb-2 max-h-64 overflow-y-auto">
            {commentsLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-4 h-4 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-neutral-600 text-center py-4">
                No comments yet
              </p>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[10px] font-mono text-neutral-500 flex-shrink-0 mt-0.5">
                      {c.author.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium text-neutral-300">
                          {c.author.name}
                        </span>
                        <span className="text-[10px] text-neutral-600">
                          {commentTimeAgo(c.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5 break-words">
                        {c.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comment input */}
          <form
            onSubmit={handleSubmitComment}
            className="px-4 sm:px-6 pb-4 pt-2 flex gap-2"
          >
            <input
              ref={commentInputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              maxLength={1000}
              className="flex-1 bg-[#0e0e0e] border border-[#1a1a1a] rounded-xl px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!newComment.trim() || commentSending}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-white text-black hover:bg-neutral-200 transition-all active:scale-95 disabled:opacity-30 disabled:hover:bg-white flex-shrink-0"
            >
              {commentSending ? (
                <div className="w-3 h-3 border-2 border-neutral-400 border-t-black rounded-full animate-spin" />
              ) : (
                <SendIcon />
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
