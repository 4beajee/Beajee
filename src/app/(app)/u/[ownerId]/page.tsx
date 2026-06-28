"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  PageHeader,
  Surface,
  getMattePillClass,
  pageFrameClass,
} from "@/components/ui/app-chrome";

interface PublicProfile {
  name: string | null;
  image: string | null;
  memberSince: string;
  context: {
    ownerName: string | null;
    ownerProfession: string | null;
    ownerDomain: string | null;
    currentWork: string;
    expertise: string[];
    lookingFor: string;
    location: string | null;
    ownerLocation: string | null;
  } | null;
}

export default function PublicProfilePage() {
  const params = useParams<{ ownerId: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/profiles/${params.ownerId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Failed to load profile");
        if (!cancelled) setProfile(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [params.ownerId]);

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-neutral-700 border-t-white" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={pageFrameClass}>
        <Surface className="px-8 py-8 text-center">
          <p className="text-sm text-neutral-400">{error ?? "Profile not found"}</p>
        </Surface>
      </div>
    );
  }

  const ctx = profile.context;

  return (
    <div className={pageFrameClass}>
      <PageHeader
        title={ctx?.ownerName ?? profile.name ?? "Profile"}
        subtitle={[ctx?.ownerProfession, ctx?.ownerDomain, ctx?.location ?? ctx?.ownerLocation].filter(Boolean).join(" · ") || undefined}
      />

      {ctx && (
        <Surface className="mb-6 px-5 py-5">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Current work
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300">{ctx.currentWork}</p>
          {ctx.expertise.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {ctx.expertise.map((item) => (
                <span key={item} className={getMattePillClass("muted", "text-xs")}>
                  {item}
                </span>
              ))}
            </div>
          )}
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Looking for</p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">{ctx.lookingFor}</p>
          </div>
        </Surface>
      )}

    </div>
  );
}
