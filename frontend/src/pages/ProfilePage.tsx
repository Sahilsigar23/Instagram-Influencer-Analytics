import { useEffect, useMemo, useState } from "react";
import { Influencer, fetchInfluencer, analyzePost, analyzeReel, API_BASE } from "../services/api";

// Helper to proxy Instagram images through backend to bypass CORS
function proxyImage(url: string | undefined): string {
	if (!url) return "";
	// If it's an Instagram URL, proxy it
	// include common Facebook/Instagram CDN hosts (fbcdn) so thumbnails from
	// Instagram's CDN are proxied through the backend and avoid CORS issues.
	if (
		url.includes("cdninstagram.com") ||
		url.includes("instagram.com") ||
		url.includes("fbcdn.net") ||
		url.includes("fna.fbcdn.net")
	) {
		return `${API_BASE}/proxy-image?url=${encodeURIComponent(url)}`;
	}
	return url;
}
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";

export default function ProfilePage() {
	const [username, setUsername] = useState(""); // Empty by default, or put any username you want
	const [data, setData] = useState<Influencer | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [activeSection, setActiveSection] = useState<"home" | "posts" | "reels" | "analytics">("home");
	const [analyzingPostId, setAnalyzingPostId] = useState<number | null>(null);
	const [analyzingReelId, setAnalyzingReelId] = useState<number | null>(null);

	async function load() {
		try {
			setLoading(true);
			setError(null);
			const res = await fetchInfluencer(username);
			setData(res);
			return res;
		} catch (e: any) {
			setError(e?.message ?? "Failed to load");
		} finally {
			setLoading(false);
		}
	}

	async function fetchFromApify() {
		try {
			setLoading(true);
			setError(null);
			// Start background fetch so UI doesn't block while Apify scrapes (can take >30s)
			const resp = await fetch(`${API_BASE}/fetch-apify-background/${username}`, { method: "POST" });
			if (!resp.ok) {
				const err = await resp.json().catch(() => ({}));
				throw new Error(err.detail || "Failed to start background fetch");
			}
			alert("Fetch started in background. We'll poll for results and update when ready (may take up to a minute).");
			// Poll influencer endpoint for results with a timeout
			const start = Date.now();
			const timeout = 90_000; // 90 seconds
			while (Date.now() - start < timeout) {
				await new Promise((r) => setTimeout(r, 3000));
			try {
				const inf = await fetchInfluencer(username);
				if (inf && ((inf.posts && inf.posts.length > 0) || (inf.reels && inf.reels.length > 0))) {
					setData(inf);
					const postsCount = inf.posts?.length || 0;
					const reelsCount = inf.reels?.length || 0;
					alert(`✅ Done — found ${postsCount} posts and ${reelsCount} reels`);
					return;
				}
				} catch (_) {
					// ignore transient errors while scraping
				}
			}
			// Timeout expired — do a final load and warn user
			await load();
			alert("Background fetch started but no reels appeared within 90s. You can try again or check backend logs.");
		} catch (e: any) {
			setError(e?.message ?? "Failed to start background fetch");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		// Only auto-load if there's a username
		if (username) {
			load();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// If the user navigates to the Reels section and we don't have reels yet,
	// fetch the influencer data (which includes reels). This helps when the
	// user clicks the Reels tab before explicitly loading data.
	useEffect(() => {
		if (activeSection !== "reels" || !username) return;

		let mounted = true;
		(async () => {
			try {
				// Just load influencer data when user opens Reels. Do NOT auto-seed.
				// Seeding should be explicit (user clicks the Seed Sample Reels button).
				await load();
			} catch (err) {
				console.error(err);
			} finally {
				if (mounted) setLoading(false);
			}
		})();

		return () => {
			mounted = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activeSection, username]);

	const chartData = (data?.posts || []).map((p, i) => ({ name: `P${i + 1}`, likes: p.likes, comments: p.comments }));

	// Post categories heuristic (from keywords or caption)
	const categoryData = useMemo(() => {
		const posts = data?.posts ?? [];
		const counts: Record<string, number> = {};
		const push = (k: string) => (counts[k] = (counts[k] || 0) + 1);
		for (const p of posts) {
			const keys = p.keywords && p.keywords.length ? p.keywords : [];
			for (const k of keys) push(k.toLowerCase());
			if (!keys.length && p.caption) {
				const text = p.caption.toLowerCase();
				if (/(travel|trip|vacation|beach)/.test(text)) push("travel");
				else if (/(food|dinner|lunch|cafe)/.test(text)) push("food");
				else if (/(fashion|outfit|style)/.test(text)) push("fashion");
				else push("other");
			}
		}
		return Object.entries(counts).map(([name, value]) => ({ name, value }));
	}, [data]);

	// Simple inferred demographics (placeholder for bonus UI)
	const demographics = useMemo(() => {
		const posts = data?.posts ?? [];
		const avgLikes = posts.reduce((a, p) => a + p.likes, 0) / Math.max(1, posts.length);
		// Create a deterministic pseudo split just for visualization
		const male = Math.max(30, Math.min(70, 40 + Math.round((avgLikes % 30))));
		const female = 100 - male;
		return {
			gender: [
				{ name: "Male", value: male },
				{ name: "Female", value: female },
			],
			ages: [
				{ name: "13-17", value: Math.round(female * 0.1) },
				{ name: "18-24", value: Math.round(female * 0.35) },
				{ name: "25-34", value: Math.round(male * 0.3) },
				{ name: "35-44", value: Math.round(male * 0.15) },
				{ name: "45+", value: Math.round((100 - (female * 0.45 + male * 0.45))) },
			],
		};
	}, [data]);

	function ChartPlaceholder({ title }: { title?: string }) {
		return (
			<div className="rounded-2xl bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 ring-1 ring-neutral-800 p-6 flex items-center justify-center text-neutral-500">
				<div className="text-center">
					<div className="text-xl font-semibold mb-2">{title ?? "No data"}</div>
					<div className="text-sm">Not enough posts to display this chart.</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 p-4 md:p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				{/* Header Section with Title */}
				<div className="text-center space-y-2 mb-8">
					<h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-purple-500 bg-clip-text text-transparent">
						Instagram Influencer Analytics
					</h1>
					<p className="text-neutral-400 text-sm">Get insights on any Instagram profile</p>
				</div>

				{/* Search Bar Section */}
				<div className="bg-neutral-900/60 backdrop-blur-sm ring-1 ring-neutral-800 rounded-2xl p-6 shadow-2xl">
					<div className="space-y-4">
						<div className="flex flex-col md:flex-row gap-4">
							<div className="flex-1">
								<label className="block text-sm font-medium text-neutral-400 mb-2">
									Instagram Username
								</label>
								<input
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									placeholder="e.g., cristiano, leomessi, virat.kohli"
									className="w-full px-4 py-3 rounded-lg bg-neutral-800 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
									onKeyPress={(e) => e.key === 'Enter' && username && load()}
								/>
							</div>
						</div>

						<div className="flex flex-col sm:flex-row gap-3">
							<button 
								onClick={load}
								disabled={!username || loading}
								className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-neutral-700 disabled:to-neutral-600 disabled:cursor-not-allowed font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
							>
								<span>📊</span>
								<div className="text-left">
									<div className="text-sm font-semibold">Load Cached Data</div>
									<div className="text-xs opacity-80">Quick load from database</div>
								</div>
							</button>
							
							<button 
								onClick={fetchFromApify} 
								disabled={!username || loading}
								className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:from-neutral-700 disabled:to-neutral-600 disabled:cursor-not-allowed font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
							>
								<span>🔄</span>
								<div className="text-left">
									<div className="text-sm font-semibold">Fetch from Instagram</div>
									<div className="text-xs opacity-80">Get fresh data via Apify (takes ~30s)</div>
								</div>
							</button>
						</div>

						{!username && (
							<p className="text-center text-sm text-neutral-500 italic">
								💡 Tip: Enter an Instagram username above to get started
							</p>
						)}
					</div>
				</div>

				{loading && <div className="text-center p-8 text-neutral-400">Loading...</div>}
				{error && <div className="text-center p-4 text-red-400 bg-red-500/10 rounded-lg">{error}</div>}

				{data && (
				<div className="space-y-6">
					<section className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
						{/* Sidebar avatar */}
						<aside className="rounded-xl bg-neutral-900/60 ring-1 ring-neutral-800 p-6 flex flex-col items-center gap-4">
							<div className="relative">
								<img 
									src={proxyImage(data.profile_picture_url)} 
									alt={data.username} 
									className="h-44 w-44 rounded-2xl object-cover ring-2 ring-emerald-600/50" 
								/>
								<div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-xs font-semibold">
									{data.followers >= 1000000 ? `${(data.followers / 1000000).toFixed(1)}M` : `${(data.followers / 1000).toFixed(0)}K`} Followers
								</div>
							</div>
							<div className="w-full flex flex-col gap-2 mt-4">
								<SideButton 
									icon="🏠" 
									label="Home" 
									active={activeSection === "home"}
									onClick={() => setActiveSection("home")}
								/>
								<SideButton 
									icon="📷" 
									label="Posts" 
									active={activeSection === "posts"}
									onClick={() => setActiveSection("posts")}
								/>
								<SideButton 
									icon="🎬" 
									label="Reels" 
									active={activeSection === "reels"}
									onClick={() => setActiveSection("reels")}
								/>
								<SideButton 
									icon="📊" 
									label="Analytics" 
									active={activeSection === "analytics"}
									onClick={() => setActiveSection("analytics")}
								/>
							</div>
						</aside>

						{/* Hero + stat pills */}
						<div className="space-y-6">
							<div className="rounded-2xl bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 ring-1 ring-neutral-800 p-6 backdrop-blur-sm">
								<div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
									<div>
										<h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
											{data.name}
										</h1>
										<p className="text-lg text-neutral-400 mt-1">@{data.username}</p>
									</div>
									<div className="flex flex-wrap gap-3">
										<KPI label="Followers" value={data.followers.toLocaleString()} />
										<KPI label="Following" value={data.following.toLocaleString()} />
										<KPI label="Posts" value={String(data.posts_count)} />
									</div>
								</div>

								<div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
									<StatPill icon="😊" title="Sentiment" value="85%" subtitle="SCORE" />
									<StatPill icon="📈" title="Mid" value="" subtitle="EXTROVERT LEVEL" />
									<StatPill icon="🧠" title="8.2/10" value="" subtitle="SOCIAL TOPICS" />
									<StatPill icon="✨" title="Low Risk" value="" subtitle="HATE SPEECH" />
									<StatPill icon="🤝" title="8.0/10" value="" subtitle="FAIR PLAY" />
								</div>
							</div>
						</div>
					</section>

					{/* HOME SECTION */}
					{activeSection === "home" && (
						<>
							<section className="grid grid-cols-1 md:grid-cols-3 gap-4">
								<Card title="Average Likes"><div className="text-3xl font-semibold">{Math.round(data.avg_likes)}</div></Card>
								<Card title="Average Comments"><div className="text-3xl font-semibold">{Math.round(data.avg_comments)}</div></Card>
								<Card title="Engagement Rate"><div className="text-3xl font-semibold">{data.engagement_rate.toFixed(2)}%</div></Card>
							</section>

							<section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
								<Card title="Personality">
									<div className="space-y-3">
										<Progress label="Adventure" value={78} />
										<Progress label="Extrovert" value={64} />
										<Progress label="Sportive" value={85} />
										<Progress label="Attentive" value={55} />
									</div>
								</Card>
								<Card title="Interests" className="lg:col-span-2">
									<div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
										<Bubble label="Travel" value={64} />
										<Bubble label="Adventure" value={64} />
										<Bubble label="Movies" value={23} />
										<Bubble label="Swimming" value={80} />
										<Bubble label="Gaming" value={80} />
									</div>
								</Card>
							</section>
						</>
					)}

					{/* POSTS SECTION */}
					{activeSection === "posts" && (
						<section className="space-y-6">
							<div className="flex items-center justify-between">
								<h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
									Posts ({data.posts.length})
								</h2>
							</div>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
								{data.posts.map((p) => (
									<article key={p.id} className="group rounded-xl overflow-hidden bg-neutral-900/60 ring-1 ring-neutral-800 hover:ring-2 hover:ring-emerald-600 transition-all shadow-lg hover:shadow-emerald-600/20">
										<div className="relative aspect-square overflow-hidden bg-neutral-950">
											<img 
												src={proxyImage(p.image_url)} 
												alt=""
												className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
												onError={(e) => {
													e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%23262626" width="400" height="400"/%3E%3Ctext fill="%23737373" font-family="sans-serif" font-size="24" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E';
												}}
											/>
											<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
										</div>
										<div className="p-4 space-y-3">
											<p className="line-clamp-2 text-sm text-neutral-300 min-h-[2.5rem]">
												{p.caption || "No caption"}
											</p>
											<div className="flex items-center justify-between text-sm">
												<div className="flex items-center gap-3 text-neutral-400">
													<span className="flex items-center gap-1">
														<span className="text-red-500">❤️</span>
														<span className="font-semibold text-white">{p.likes.toLocaleString()}</span>
													</span>
													<span className="flex items-center gap-1">
														<span>💬</span>
														<span className="font-semibold text-white">{p.comments.toLocaleString()}</span>
													</span>
												</div>
											</div>
											{(p.keywords && p.keywords.length) ? (
												<div className="flex flex-wrap gap-1.5">
													{p.keywords.slice(0, 4).map((k, i) => (
														<span key={i} className="px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-600/20 to-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-600/30">
															{k}
														</span>
													))}
													{p.keywords.length > 4 && (
														<span className="px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-400 text-xs">
															+{p.keywords.length - 4}
														</span>
													)}
												</div>
											) : (
												<button
													onClick={async () => {
														if (!p.id) return;
														setAnalyzingPostId(p.id);
														try {
															await analyzePost(p.id);
															await load();
														} finally {
															setAnalyzingPostId(null);
														}
													}}
													disabled={analyzingPostId === p.id}
													className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 disabled:from-neutral-700 disabled:to-neutral-600 disabled:cursor-not-allowed text-sm font-medium transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
												>
													{analyzingPostId === p.id ? (
														<>
															<svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
																<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
																<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
															</svg>
															<span>Analyzing...</span>
														</>
													) : (
														<>
															<span>🔍</span>
															<span>Analyze Post</span>
														</>
													)}
												</button>
											)}
											{p.vibe && (
												<div className="flex items-center gap-2 text-xs">
													<span className="px-2.5 py-1 rounded-full bg-purple-600/20 text-purple-400 border border-purple-600/30">
														✨ {p.vibe}
													</span>
												</div>
											)}
											{p.quality && (
												<div className="text-xs text-neutral-500">
													{p.quality}
												</div>
											)}
										</div>
									</article>
								))}
							</div>
						</section>
					)}

					{/* REELS SECTION */}
					{activeSection === "reels" && (
						<section className="space-y-6">
							<div className="flex items-center justify-between">
								<h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-500 bg-clip-text text-transparent">
									Latest 5 Reels
								</h2>
								{(!data.reels || data.reels.length === 0) && (
									<button
										onClick={async () => {
											try {
												setLoading(true);
												const response = await fetch(`${API_BASE}/seed/${username}`, { 
													method: "POST", 
													headers: { "Accept": "application/json" } 
												});
												
												if (response.ok) {
													alert("✅ Sample reels added successfully!");
													await load();
												} else {
													alert("❌ Failed to seed reels. Please try again.");
												}
											} catch (error) {
												console.error("Error seeding reels:", error);
												alert("❌ Error seeding reels. Please check the console.");
											} finally {
												setLoading(false);
											}
										}}
										disabled={loading}
										className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-neutral-700 disabled:to-neutral-600 disabled:cursor-not-allowed font-medium transition-all transform hover:scale-[1.02]"
									>
										🎬 Seed Sample Reels
									</button>
								)}
							</div>

							{(!data.reels || data.reels.length === 0) ? (
								<div className="flex flex-col items-center justify-center py-20 px-4">
									<div className="text-8xl mb-6">🎬</div>
									<h3 className="text-2xl font-bold text-neutral-300 mb-2">No Reels Yet</h3>
									<p className="text-neutral-500 mb-6 text-center max-w-md">
										This profile doesn't have any reels data yet. Click the button above to add sample reels or fetch real data from Instagram.
									</p>
								</div>
							) : (
								<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
									{data.reels.slice(0, 5).map((r) => (
										<article key={r.id} className="group rounded-xl overflow-hidden bg-neutral-900/60 ring-1 ring-neutral-800 hover:ring-2 hover:ring-purple-600 transition-all shadow-lg hover:shadow-purple-600/20">
											<div className="relative aspect-[9/16] overflow-hidden bg-neutral-950">
												<img 
													src={proxyImage(r.thumbnail_url)} 
													alt=""
													className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
													onError={(e) => {
														e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="700"%3E%3Crect fill="%23262626" width="400" height="700"/%3E%3Ctext fill="%23737373" font-family="sans-serif" font-size="24" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Video%3C/text%3E%3C/svg%3E';
													}}
												/>
												<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-100 group-hover:opacity-90 transition-opacity" />
												
												{/* Play icon overlay */}
												<div className="absolute inset-0 flex items-center justify-center">
													<div className="w-16 h-16 rounded-full bg-purple-600/80 flex items-center justify-center group-hover:bg-purple-500/90 transition-all transform group-hover:scale-110">
														<span className="text-3xl ml-1">▶</span>
													</div>
												</div>

												{/* Stats overlay at bottom */}
												<div className="absolute bottom-0 left-0 right-0 p-3 text-white">
													<div className="flex items-center gap-3 text-sm">
														<span className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full">
															<span>👁️</span>
															<span className="font-semibold">{r.views.toLocaleString()}</span>
														</span>
														<span className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-full">
															<span className="text-red-500">❤️</span>
															<span className="font-semibold">{r.likes.toLocaleString()}</span>
														</span>
													</div>
												</div>
											</div>

											<div className="p-4 space-y-3">
												<p className="line-clamp-2 text-sm text-neutral-300 min-h-[2.5rem]">
													{r.caption || "No caption"}
												</p>

												<div className="flex items-center text-xs text-neutral-500">
													<span>💬 {r.comments.toLocaleString()} comments</span>
												</div>

												{r.tags?.length ? (
													<div className="flex flex-wrap gap-1.5">
														{r.tags.slice(0, 3).map((t, i) => (
															<span key={i} className="px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-600/20 to-purple-500/20 text-purple-400 text-xs font-medium border border-purple-600/30">
																#{t}
															</span>
														))}
														{r.tags.length > 3 && (
															<span className="px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-400 text-xs">
																+{r.tags.length - 3}
															</span>
														)}
													</div>
												) : (
													<button
														onClick={async () => {
															setAnalyzingReelId(r.id);
															try {
																await analyzeReel(r.id);
																await load();
																alert('✅ Reel analyzed');
															} catch (err) {
																console.error('Error analyzing reel', err);
																alert('Error analyzing reel. See console.');
															} finally {
																setAnalyzingReelId(null);
															}
														}}
														disabled={analyzingReelId === r.id}
														className="w-full px-3 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 disabled:from-neutral-700 disabled:to-neutral-600 disabled:cursor-not-allowed text-xs font-medium flex items-center justify-center gap-2"
													>
														{analyzingReelId === r.id ? (
															<>
																<svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
																	<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
																	<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
																</svg>
																<span>Analyzing...</span>
															</>
														) : (
															<>
																<span>🔍</span>
																<span>Analyze Reel</span>
															</>
														)}
													</button>
												)}

												{r.vibe && (
													<div className="flex items-center gap-2 text-xs">
														<span className="px-2.5 py-1 rounded-full bg-purple-600/20 text-purple-400 border border-purple-600/30">
															✨ {r.vibe}
														</span>
													</div>
												)}
											</div>
										</article>
									))}
								</div>
							)}
						</section>
					)}

					{/* ANALYTICS SECTION */}
					{activeSection === "analytics" && (
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-500 bg-clip-text text-transparent">
									Analytics Overview
								</h2>
							</div>

							<section className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<div className="rounded-2xl bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 ring-1 ring-neutral-800 p-6 hover:ring-emerald-600/50 transition-all">
									<div className="flex items-center justify-between mb-2">
										<h3 className="text-sm font-medium text-neutral-400">Average Likes</h3>
										<span className="text-2xl">❤️</span>
									</div>
									<div className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
										{Math.round(data.avg_likes).toLocaleString()}
									</div>
									<p className="text-xs text-neutral-500 mt-2">Per post engagement</p>
								</div>

								<div className="rounded-2xl bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 ring-1 ring-neutral-800 p-6 hover:ring-sky-600/50 transition-all">
									<div className="flex items-center justify-between mb-2">
										<h3 className="text-sm font-medium text-neutral-400">Average Comments</h3>
										<span className="text-2xl">💬</span>
									</div>
									<div className="text-4xl font-bold bg-gradient-to-r from-sky-400 to-sky-500 bg-clip-text text-transparent">
										{Math.round(data.avg_comments).toLocaleString()}
									</div>
									<p className="text-xs text-neutral-500 mt-2">Per post interaction</p>
								</div>

								<div className="rounded-2xl bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 ring-1 ring-neutral-800 p-6 hover:ring-purple-600/50 transition-all">
									<div className="flex items-center justify-between mb-2">
										<h3 className="text-sm font-medium text-neutral-400">Engagement Rate</h3>
										<span className="text-2xl">📈</span>
									</div>
									<div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-purple-500 bg-clip-text text-transparent">
										{data.engagement_rate.toFixed(2)}%
									</div>
									<p className="text-xs text-neutral-500 mt-2">Total engagement score</p>
								</div>
							</section>

							<section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
								<div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 ring-1 ring-neutral-800 p-6">
									<h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
										<span className="text-emerald-400">📊</span>
										Likes vs Comments
									</h3>
									{data.posts && data.posts.length > 0 ? (
										<ResponsiveContainer width="100%" height={280}>
											<BarChart data={chartData}>
												<XAxis dataKey="name" stroke="#737373" />
												<YAxis stroke="#737373" />
												<Tooltip 
													contentStyle={{ 
														backgroundColor: '#171717', 
														border: '1px solid #404040',
														borderRadius: '8px'
													}}
												/>
												<Bar dataKey="likes" fill="#22c55e" radius={[6,6,0,0]} />
												<Bar dataKey="comments" fill="#3b82f6" radius={[6,6,0,0]} />
											</BarChart>
										</ResponsiveContainer>
									) : (
										<ChartPlaceholder title="Likes vs Comments" />
									)}
								</div>

								<div className="rounded-2xl bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 ring-1 ring-neutral-800 p-6">
									<h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
										<span className="text-purple-400">👥</span>
										Audience Demographics
									</h3>
									<div className="space-y-4">
										<ResponsiveContainer width="100%" height={140}>
											<PieChart>
												<Pie 
													data={demographics.gender} 
													dataKey="value" 
													nameKey="name" 
													innerRadius={35} 
													outerRadius={60}
													paddingAngle={2}
												>
													{["#60a5fa", "#f472b6"].map((c, i) => (
														<Cell key={i} fill={c} />
													))}
												</Pie>
												<Legend 
													verticalAlign="bottom" 
													height={30}
													wrapperStyle={{ fontSize: '12px' }}
												/>
											</PieChart>
										</ResponsiveContainer>
										<div className="pt-4 border-t border-neutral-800">
											<p className="text-xs text-neutral-400 mb-2">Age Distribution</p>
											<ResponsiveContainer width="100%" height={100}>
												<BarChart data={demographics.ages}>
													<XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#737373" />
													<Bar dataKey="value" fill="#22c55e" radius={[4,4,0,0]} />
												</BarChart>
											</ResponsiveContainer>
										</div>
									</div>
								</div>
							</section>

							<section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
								<div className="rounded-2xl bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 ring-1 ring-neutral-800 p-6">
									<h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
										<span className="text-purple-400">🏷️</span>
										Post Categories
									</h3>
									{data.posts && data.posts.length > 0 ? (
										<ResponsiveContainer width="100%" height={240}>
											<BarChart data={categoryData}>
												<XAxis dataKey="name" stroke="#737373" />
												<YAxis allowDecimals={false} stroke="#737373" />
												<Tooltip 
													contentStyle={{ 
														backgroundColor: '#171717', 
														border: '1px solid #404040',
														borderRadius: '8px'
													}}
												/>
												<Bar dataKey="value" fill="#a78bfa" radius={[6,6,0,0]} />
											</BarChart>
										</ResponsiveContainer>
									) : (
										<ChartPlaceholder title="Post Categories" />
									)}
								</div>

								<div className="rounded-2xl bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 ring-1 ring-neutral-800 p-6">
									<h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
										<span className="text-emerald-400">📈</span>
										Engagement Trends
									</h3>
									{data.posts && data.posts.length > 0 ? (
										<ResponsiveContainer width="100%" height={240}>
											<BarChart data={chartData.slice(0, 10)}>
												<XAxis dataKey="name" stroke="#737373" />
												<YAxis stroke="#737373" />
												<Tooltip 
													contentStyle={{ 
														backgroundColor: '#171717', 
														border: '1px solid #404040',
														borderRadius: '8px'
													}}
												/>
												<Bar dataKey="likes" fill="#10b981" radius={[6,6,0,0]} />
											</BarChart>
										</ResponsiveContainer>
									) : (
										<ChartPlaceholder title="Engagement Trends" />
									)}
								</div>
							</section>
						</div>
					)}
				</div>
				)}
			</div>
		</div>
	);
}


function KPI(props: { label: string; value: string }) {
	return (
		<span className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1">
			<span className="text-sm font-semibold">{props.value}</span>
			<span className="text-xs text-neutral-400">{props.label}</span>
		</span>
	);
}

function Card(props: { title: string; className?: string; children: React.ReactNode }) {
	return (
		<section className={`p-4 rounded-xl bg-neutral-900/60 ring-1 ring-neutral-800 ${props.className ?? ""}`}>
			<h2 className="mb-3 font-medium text-neutral-200">{props.title}</h2>
			{props.children}
		</section>
	);
}

function SideButton(props: { icon: string; label: string; active?: boolean; onClick?: () => void }) {
	return (
		<button 
			onClick={props.onClick}
			className={`w-full inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${
				props.active 
					? 'border-emerald-600 bg-emerald-600/20 text-emerald-400' 
					: 'border-neutral-800 bg-neutral-900 hover:bg-neutral-800/80 text-neutral-300'
			}`}
		>
			<span>{props.icon}</span>
			<span className="text-sm font-medium">{props.label}</span>
		</button>
	);
}

function StatPill(props: { icon: string; title: string; value: string; subtitle: string }) {
	return (
		<div className="rounded-xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-4 hover:border-neutral-700 transition-all">
			<div className="text-3xl mb-2">{props.icon}</div>
			<div className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">{props.subtitle}</div>
			<div className="text-lg font-bold text-white">{props.title || props.value}</div>
		</div>
	);
}

function Progress(props: { label: string; value: number }) {
	return (
		<div className="space-y-2">
			<div className="flex justify-between items-center">
				<span className="text-sm font-medium text-neutral-300">{props.label}</span>
				<span className="text-sm font-bold text-emerald-400">{props.value}%</span>
			</div>
			<div className="h-3 rounded-full bg-neutral-800 overflow-hidden">
				<div 
					className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500" 
					style={{ width: `${props.value}%` }} 
				/>
			</div>
		</div>
	);
}

function Bubble(props: { label: string; value: number }) {
	return (
		<div className="aspect-square rounded-full border-2 border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 grid place-items-center hover:border-emerald-600 transition-all p-4">
			<div className="text-center">
				<div className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
					{props.value}%
				</div>
				<div className="text-xs font-medium text-neutral-400 mt-1">{props.label}</div>
			</div>
		</div>
	);
}

// OccupationCard removed — it was unused and caused a TS unused declaration error.

// Row helper removed — it was unused in the file.
