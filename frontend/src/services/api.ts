import axios from "axios";

// import.meta.env types may not be available depending on TS config in the
// environment where this repo is opened. Cast to any to avoid a TS error
// during local typechecks while still allowing Vite to replace the value at
// build time.
const _env = (import.meta as any).env || {};
export const API_BASE = _env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: API_BASE });

export type Post = {
	id: number;
	image_url: string;
	caption?: string;
	likes: number;
	comments: number;
	posted_at?: string;
	keywords?: string[];
	vibe?: string;
	quality?: string;
};

export type Reel = {
	id: number;
	thumbnail_url: string;
	caption?: string;
	views: number;
	likes: number;
	comments: number;
	posted_at?: string;
	tags?: string[];
	vibe?: string;
};

export type Influencer = {
	id: number;
	name: string;
	username: string;
	profile_picture_url?: string;
	followers: number;
	following: number;
	posts_count: number;
	avg_likes: number;
	avg_comments: number;
	engagement_rate: number;
	posts: Post[];
	reels: Reel[];
};

export async function fetchInfluencer(username: string) {
	const { data } = await api.get<Influencer>(`/influencers/${username}`);
	return data;
}

export async function analyzePost(postId: number) {
    const { data } = await api.post<{ id: number; keywords?: string; vibe?: string; quality?: string }>(
        `/analyze/post/${postId}`
    );
    return data;
}
