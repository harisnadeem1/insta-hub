export type Member = {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InstagramProfile = {
  id: string;
  member_id: string;
  username: string;
  profile_url: string;
  profile_name: string;
  is_public: boolean;
  is_active: boolean;
  current_followers_count: number;
  current_posts_count: number;
  current_comments_count: number;
  current_visible_views_count: number;
  last_scraped_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Snapshot = {
  id: string;
  instagram_profile_id: string;
  followers_count: number;
  posts_count: number;
  comments_count: number;
  visible_views_count: number;
  scraped_at: string;
  source: "manual" | "scheduled" | "api";
  raw_payload: Record<string, unknown>;
};

export const currentUser = {
  id: "u_1",
  full_name: "Alex Morgan",
  email: "alex@instanest.app",
  is_active: true,
};

export const members: Member[] = [
  {
    id: "m_1",
    user_id: "u_1",
    name: "Sara",
    notes: "Lifestyle & fashion cluster",
    created_at: "2025-03-12T10:00:00Z",
    updated_at: "2025-07-18T09:32:00Z",
  },
  {
    id: "m_2",
    user_id: "u_1",
    name: "Tom",
    notes: "Fitness accounts",
    created_at: "2025-04-02T14:22:00Z",
    updated_at: "2025-07-20T08:11:00Z",
  },
  {
    id: "m_3",
    user_id: "u_1",
    name: "Ali",
    notes: null,
    created_at: "2025-05-19T11:15:00Z",
    updated_at: "2025-07-24T18:40:00Z",
  },
];

export const profiles: InstagramProfile[] = [
  {
    id: "p_1",
    member_id: "m_1",
    username: "sara.stylehub",
    profile_url: "https://instagram.com/sara.stylehub",
    profile_name: "Sara Style Hub",
    is_public: true,
    is_active: true,
    current_followers_count: 128430,
    current_posts_count: 842,
    current_comments_count: 15230,
    current_visible_views_count: 2140350,
    last_scraped_at: "2025-07-25T06:12:00Z",
    created_at: "2025-03-12T10:00:00Z",
    updated_at: "2025-07-25T06:12:00Z",
  },
  {
    id: "p_2",
    member_id: "m_1",
    username: "sara.dailylooks",
    profile_url: "https://instagram.com/sara.dailylooks",
    profile_name: "Daily Looks",
    is_public: true,
    is_active: true,
    current_followers_count: 42180,
    current_posts_count: 318,
    current_comments_count: 5210,
    current_visible_views_count: 612430,
    last_scraped_at: "2025-07-25T06:14:00Z",
    created_at: "2025-03-15T11:30:00Z",
    updated_at: "2025-07-25T06:14:00Z",
  },
  {
    id: "p_3",
    member_id: "m_2",
    username: "tom.fitlife",
    profile_url: "https://instagram.com/tom.fitlife",
    profile_name: "Tom Fitlife",
    is_public: true,
    is_active: true,
    current_followers_count: 89210,
    current_posts_count: 512,
    current_comments_count: 9840,
    current_visible_views_count: 1420100,
    last_scraped_at: "2025-07-25T05:50:00Z",
    created_at: "2025-04-02T14:22:00Z",
    updated_at: "2025-07-25T05:50:00Z",
  },
  {
    id: "p_4",
    member_id: "m_2",
    username: "tom.trainingclub",
    profile_url: "https://instagram.com/tom.trainingclub",
    profile_name: "Training Club",
    is_public: true,
    is_active: false,
    current_followers_count: 12300,
    current_posts_count: 96,
    current_comments_count: 720,
    current_visible_views_count: 88450,
    last_scraped_at: "2025-07-10T09:20:00Z",
    created_at: "2025-05-01T09:00:00Z",
    updated_at: "2025-07-10T09:20:00Z",
  },
  {
    id: "p_5",
    member_id: "m_3",
    username: "ali.creativegrid",
    profile_url: "https://instagram.com/ali.creativegrid",
    profile_name: "Creative Grid",
    is_public: true,
    is_active: true,
    current_followers_count: 56780,
    current_posts_count: 421,
    current_comments_count: 7120,
    current_visible_views_count: 920800,
    last_scraped_at: "2025-07-25T06:20:00Z",
    created_at: "2025-05-19T11:15:00Z",
    updated_at: "2025-07-25T06:20:00Z",
  },
  {
    id: "p_6",
    member_id: "m_3",
    username: "ali.designnotes",
    profile_url: "https://instagram.com/ali.designnotes",
    profile_name: "Design Notes",
    is_public: true,
    is_active: true,
    current_followers_count: 18420,
    current_posts_count: 143,
    current_comments_count: 2140,
    current_visible_views_count: 264500,
    last_scraped_at: "2025-07-25T06:21:00Z",
    created_at: "2025-06-04T16:00:00Z",
    updated_at: "2025-07-25T06:21:00Z",
  },
];

function daysAgo(n: number) {
  const d = new Date("2025-07-25T06:00:00Z");
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

export const snapshots: Snapshot[] = profiles.flatMap((p) => {
  const seed = p.current_followers_count;
  return Array.from({ length: 8 }, (_, i) => {
    const drift = 1 - (i * 0.008 + (seed % 7) * 0.001);
    return {
      id: `s_${p.id}_${i}`,
      instagram_profile_id: p.id,
      followers_count: Math.round(p.current_followers_count * drift),
      posts_count: Math.max(0, p.current_posts_count - i),
      comments_count: Math.round(p.current_comments_count * drift),
      visible_views_count: Math.round(p.current_visible_views_count * drift),
      scraped_at: daysAgo(i),
      source: (i % 3 === 0 ? "scheduled" : i % 3 === 1 ? "manual" : "api") as Snapshot["source"],
      raw_payload: {
        username: p.username,
        followers: Math.round(p.current_followers_count * drift),
        posts: Math.max(0, p.current_posts_count - i),
        fetched_at: daysAgo(i),
        engine: "public-scraper/v1",
      },
    };
  });
});

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatCompact(n: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const now = new Date("2025-07-25T07:00:00Z").getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function getMemberProfiles(memberId: string) {
  return profiles.filter((p) => p.member_id === memberId);
}

export function getMemberTotals(memberId: string) {
  const ps = getMemberProfiles(memberId);
  return ps.reduce(
    (acc, p) => ({
      followers: acc.followers + p.current_followers_count,
      posts: acc.posts + p.current_posts_count,
      comments: acc.comments + p.current_comments_count,
      views: acc.views + p.current_visible_views_count,
      count: acc.count + 1,
    }),
    { followers: 0, posts: 0, comments: 0, views: 0, count: 0 },
  );
}

export function getOverallTotals() {
  return profiles.reduce(
    (acc, p) => ({
      followers: acc.followers + p.current_followers_count,
      posts: acc.posts + p.current_posts_count,
      comments: acc.comments + p.current_comments_count,
      views: acc.views + p.current_visible_views_count,
    }),
    { followers: 0, posts: 0, comments: 0, views: 0 },
  );
}

export function getMemberById(id: string) {
  return members.find((m) => m.id === id);
}

export function getProfileById(id: string) {
  return profiles.find((p) => p.id === id);
}