"use client";

/**
 * Auto-maintained profile dashboard. Verbatim port of
 * client/src/pages/profile.page.tsx — renders the static (long-term facts)
 * and dynamic (recent context) sections, plus 2FA settings and the GDPR
 * privacy/data-rights card.
 *
 * The export-data link points at GET /api/export — that endpoint streams a
 * download of every memory, embedding, profile snapshot, audit log, etc.
 * the user has on file. It's a real route on the API; we link to it via
 * env.publicApiUrl so the cookie scope still applies.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { gdprService } from "@/services/gdpr.service";
import {
  getProfile,
  refreshProfile,
  type UserProfile,
} from "@/services/profile.service";
import { env } from "@/lib/env";
import { DeleteAccountDialog } from "@/components/gdpr/DeleteAccountDialog";
import { TwoFactorSettings } from "@/components/settings/TwoFactorSettings";

const formatScheduledDate = (iso: string | null): string => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
};

export function ProfileClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletionScheduledFor, setDeletionScheduledFor] = useState<
    string | null
  >(null);

  useEffect(() => {
    gdprService
      .getStatus()
      .then((res) => {
        setDeletionScheduledFor(res.data?.scheduledFor ?? null);
      })
      .catch(() => {
        // Non-fatal — banner just doesn't show.
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getProfile();
        if (!cancelled) setProfile(data);
      } catch (err) {
        if (!cancelled) {
          const e = err as { message?: string };
          setError(e.message || "Failed to load profile");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      const data = await refreshProfile();
      setProfile(data);
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === "ECONNABORTED" || e.message?.includes("timeout")) {
        setError(
          "Profile refresh is taking longer than expected. Please try again in a moment.",
        );
      } else {
        setError(e.message || "Failed to refresh profile");
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-sm font-mono text-gray-600">
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
              <div className="flex items-center gap-2">
                {profile && (
                  <div className="text-xs font-mono text-gray-500">
                    v{profile.version}
                  </div>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              Your automatically maintained profile based on processed
              content
            </p>
          </div>

          {/* Security Settings - 2FA */}
          <TwoFactorSettings />

          {/* Privacy & data rights */}
          <div className="bg-white border border-gray-200 p-4">
            <div className="text-sm font-mono text-gray-600 mb-3 uppercase tracking-wide">
              [PRIVACY & DATA RIGHTS]
            </div>

            {deletionScheduledFor && (
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 bg-red-50 border border-red-200 text-sm text-red-800">
                <span>
                  Your account is scheduled for deletion on{" "}
                  <strong>
                    {formatScheduledDate(deletionScheduledFor)}
                  </strong>
                  .
                </span>
                <button
                  type="button"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="px-3 py-1 bg-white border border-red-300 text-red-700 text-xs font-mono hover:bg-red-100 transition-colors"
                >
                  Cancel deletion
                </button>
              </div>
            )}

            <p className="text-xs text-gray-600 mb-4">
              Export everything we hold about you, or schedule a permanent
              account deletion. Deletion runs after a 30-day grace period
              and can be cancelled any time before then.
            </p>

            <div className="flex flex-wrap gap-2">
              <a
                href={`${env.publicApiUrl}/api/export`}
                download
                className="px-3 py-1.5 text-xs font-mono text-gray-700 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors"
              >
                Export my data
              </a>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className="px-3 py-1.5 text-xs font-mono text-red-700 hover:text-red-900 hover:bg-red-50 border border-red-300 transition-colors"
              >
                {deletionScheduledFor
                  ? "Manage deletion"
                  : "Delete my account"}
              </button>
            </div>
          </div>

          <DeleteAccountDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            scheduledFor={deletionScheduledFor}
            onScheduled={(when) => {
              setDeletionScheduledFor(when);
              setDeleteDialogOpen(false);
            }}
            onCancelled={() => {
              setDeletionScheduledFor(null);
              setDeleteDialogOpen(false);
            }}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 p-4 text-center">
              <div className="text-sm font-mono text-red-600 mb-2">
                [ERROR] {error}
              </div>
              <button
                onClick={() => setError(null)}
                className="px-3 py-1 text-xs font-mono uppercase tracking-wide border border-red-300 bg-white hover:bg-red-50 hover:border-red-500 text-red-600 hover:text-red-700 transition-all"
              >
                RETRY
              </button>
            </div>
          )}

          {!profile && !error && (
            <div className="text-center py-8">
              <div className="text-sm font-mono text-gray-600 mb-2">
                [EMPTY] No profile available
              </div>
              <div className="text-sm text-gray-500 mb-4">
                Process some content to generate your profile
              </div>
              <button
                onClick={() => router.push("/organization")}
                className="px-4 py-2 text-sm font-mono uppercase tracking-wide border border-black bg-white hover:bg-black hover:text-white transition-all"
              >
                Go to Workspace
              </button>
            </div>
          )}

          {profile && <ProfileBody profile={profile} />}
        </div>
      </div>
    </>
  );
}

function ProfileBody({ profile }: { profile: UserProfile }) {
  const sp = profile.static_profile.json;
  const dp = profile.dynamic_profile.json;

  return (
    <div className="space-y-6">
      {/* Profile Metadata */}
      <div className="bg-white border border-gray-200 p-4">
        <div className="text-sm font-mono text-gray-600 mb-2 uppercase tracking-wide">
          [PROFILE METADATA]
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-mono">
          <div>
            <span className="text-gray-600">Version:</span>{" "}
            <span className="text-gray-900">{profile.version}</span>
          </div>
          <div>
            <span className="text-gray-600">Last Updated:</span>{" "}
            <span className="text-gray-900">
              {new Date(profile.last_updated).toLocaleString()}
            </span>
          </div>
          {profile.last_memory_analyzed && (
            <div>
              <span className="text-gray-600">Last Memory Analyzed:</span>{" "}
              <span className="text-gray-900">
                {new Date(profile.last_memory_analyzed).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Static Profile */}
      <div className="bg-white border border-gray-200 p-4">
        <div className="text-sm font-mono text-gray-600 mb-4 uppercase tracking-wide">
          [STATIC PROFILE - LONG-TERM FACTS]
        </div>

        {profile.static_profile.text && (
          <div className="mb-4">
            <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
              [NATURAL LANGUAGE SUMMARY]
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {profile.static_profile.text}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChipList label="INTERESTS" items={sp.interests} />
          <ChipList label="SKILLS" items={sp.skills} />

          {sp.profession && (
            <Section label="PROFESSION">
              <p className="text-sm font-mono text-gray-900">
                {sp.profession}
              </p>
            </Section>
          )}

          <ChipList label="DOMAINS" items={sp.domains} />
          <ChipList label="EXPERTISE AREAS" items={sp.expertise_areas} />
          <ChipList label="LONG-TERM PATTERNS" items={sp.long_term_patterns} />

          {sp.demographics && (
            <Section label="DEMOGRAPHICS">
              <KeyValueList
                items={[
                  ["Age Range", sp.demographics.age_range],
                  ["Location", sp.demographics.location],
                  ["Education", sp.demographics.education],
                ]}
              />
            </Section>
          )}

          <ChipList
            label="PERSONALITY TRAITS"
            items={sp.personality_traits}
            colorClass="bg-purple-50 border-purple-200"
          />

          {sp.work_style && Object.keys(sp.work_style).length > 0 && (
            <Section label="WORK STYLE">
              <KeyValueList
                items={[
                  ["Work Hours", sp.work_style.preferred_work_hours],
                  ["Collaboration", sp.work_style.collaboration_style],
                  ["Decision Making", sp.work_style.decision_making_style],
                  [
                    "Problem Solving",
                    sp.work_style.problem_solving_approach,
                  ],
                ]}
              />
            </Section>
          )}

          {sp.communication_style &&
            Object.keys(sp.communication_style).length > 0 && (
              <Section label="COMMUNICATION STYLE">
                <KeyValueList
                  items={[
                    [
                      "Channels",
                      sp.communication_style.preferred_channels?.join(", "),
                    ],
                    [
                      "Frequency",
                      sp.communication_style.communication_frequency,
                    ],
                    ["Tone", sp.communication_style.tone_preference],
                  ]}
                />
              </Section>
            )}

          {sp.learning_preferences &&
            Object.keys(sp.learning_preferences).length > 0 && (
              <Section label="LEARNING PREFERENCES">
                <KeyValueList
                  items={[
                    [
                      "Methods",
                      sp.learning_preferences.preferred_learning_methods?.join(
                        ", ",
                      ),
                    ],
                    ["Pace", sp.learning_preferences.learning_pace],
                    [
                      "Retention Style",
                      sp.learning_preferences.knowledge_retention_style,
                    ],
                  ]}
                />
              </Section>
            )}

          <ChipList
            label="VALUES & PRIORITIES"
            items={sp.values_and_priorities}
            colorClass="bg-green-50 border-green-200"
          />

          {sp.technology_preferences &&
            Object.keys(sp.technology_preferences).length > 0 && (
              <Section label="TECHNOLOGY PREFERENCES">
                <KeyValueList
                  items={[
                    [
                      "Tools",
                      sp.technology_preferences.preferred_tools?.join(", "),
                    ],
                    [
                      "Comfort Level",
                      sp.technology_preferences.tech_comfort_level,
                    ],
                    [
                      "Platforms",
                      sp.technology_preferences.preferred_platforms?.join(
                        ", ",
                      ),
                    ],
                  ]}
                />
              </Section>
            )}

          {sp.lifestyle_patterns &&
            Object.keys(sp.lifestyle_patterns).length > 0 && (
              <Section label="LIFESTYLE PATTERNS">
                <KeyValueList
                  items={[
                    [
                      "Activity Level",
                      sp.lifestyle_patterns.activity_level,
                    ],
                    [
                      "Social Patterns",
                      sp.lifestyle_patterns.social_patterns,
                    ],
                    [
                      "Productivity",
                      sp.lifestyle_patterns.productivity_patterns,
                    ],
                  ]}
                />
              </Section>
            )}

          {sp.cognitive_style &&
            Object.keys(sp.cognitive_style).length > 0 && (
              <Section label="COGNITIVE STYLE">
                <KeyValueList
                  items={[
                    ["Thinking", sp.cognitive_style.thinking_pattern],
                    [
                      "Information Processing",
                      sp.cognitive_style.information_processing,
                    ],
                    ["Creativity", sp.cognitive_style.creativity_level],
                  ]}
                />
              </Section>
            )}
        </div>
      </div>

      {/* Dynamic Profile */}
      <div className="bg-white border border-gray-200 p-4">
        <div className="text-sm font-mono text-gray-600 mb-4 uppercase tracking-wide">
          [DYNAMIC PROFILE - RECENT CONTEXT]
        </div>

        {profile.dynamic_profile.text && (
          <div className="mb-4">
            <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
              [NATURAL LANGUAGE SUMMARY]
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {profile.dynamic_profile.text}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BulletList label="RECENT ACTIVITIES" items={dp.recent_activities} />
          <BulletList label="CURRENT PROJECTS" items={dp.current_projects} />
          <ChipList
            label="TEMPORARY INTERESTS"
            items={dp.temporary_interests}
            colorClass="bg-yellow-50 border-yellow-200"
          />
          <BulletList label="RECENT CHANGES" items={dp.recent_changes} />
          <ChipList
            label="CURRENT CONTEXT"
            items={dp.current_context}
            colorClass="bg-blue-50 border-blue-200"
          />
          <BulletList label="ACTIVE GOALS" items={dp.active_goals} />
          <BulletList
            label="CURRENT CHALLENGES"
            items={dp.current_challenges}
          />
          <BulletList
            label="RECENT ACHIEVEMENTS"
            items={dp.recent_achievements}
          />
          <ChipList
            label="CURRENT FOCUS AREAS"
            items={dp.current_focus_areas}
            colorClass="bg-indigo-50 border-indigo-200"
          />

          {dp.emotional_state && Object.keys(dp.emotional_state).length > 0 && (
            <Section label="EMOTIONAL STATE">
              <KeyValueList
                items={[
                  [
                    "Concerns",
                    dp.emotional_state.current_concerns?.join(", "),
                  ],
                  [
                    "Excitements",
                    dp.emotional_state.current_excitements?.join(", "),
                  ],
                  ["Stress Level", dp.emotional_state.stress_level],
                ]}
              />
            </Section>
          )}

          <ChipList
            label="ACTIVE RESEARCH TOPICS"
            items={dp.active_research_topics}
            colorClass="bg-orange-50 border-orange-200"
          />
          <BulletList label="UPCOMING EVENTS" items={dp.upcoming_events} />
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  label: string;
  children: React.ReactNode;
}

function Section({ label, children }: SectionProps) {
  return (
    <div>
      <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
        [{label}]
      </div>
      {children}
    </div>
  );
}

interface ChipListProps {
  label: string;
  items?: string[];
  colorClass?: string;
}

function ChipList({
  label,
  items,
  colorClass = "bg-gray-100 border-gray-300",
}: ChipListProps) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <Section label={label}>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <span
            key={idx}
            className={`px-2 py-1 text-xs font-mono text-gray-700 border ${colorClass}`}
          >
            {item}
          </span>
        ))}
      </div>
    </Section>
  );
}

interface BulletListProps {
  label: string;
  items?: string[];
}

function BulletList({ label, items }: BulletListProps) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <Section label={label}>
      <ul className="space-y-1 text-sm font-mono text-gray-700">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start">
            <span className="mr-2">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

interface KeyValueListProps {
  items: Array<[string, string | undefined]>;
}

function KeyValueList({ items }: KeyValueListProps) {
  const filtered = items.filter(([, value]) => Boolean(value));
  if (filtered.length === 0) return null;
  return (
    <div className="space-y-1 text-sm font-mono">
      {filtered.map(([key, value]) => (
        <div key={key}>
          <span className="text-gray-600">{key}:</span>{" "}
          <span className="text-gray-900">{value}</span>
        </div>
      ))}
    </div>
  );
}
