import React, { useEffect, useState } from 'react';
import { Edit, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export const ProfileSidebar = () => {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [stats, setStats] = useState({
		postsThisWeek: 0,
		newConnections: 0,
	});
	const [profileLikes, setProfileLikes] = useState<number>(0);
	const [profile, setProfile] = useState<any>(null);
	const [recentConnections, setRecentConnections] = useState<any[]>([]);

	useEffect(() => {
		const fetchStats = async () => {
			if (!user) return;
			try {
				// Get start of this week (Monday)
				const now = new Date();
				const day = now.getDay();
				const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
				const weekStart = new Date(now.setDate(diff));
				weekStart.setHours(0, 0, 0, 0);
				const weekStartISO = weekStart.toISOString();

				const [postsResult, followersResult, likesResult, profileResult] = await Promise.all([
					supabase
						.from('posts')
						.select('id')
						.eq('user_id', user.id)
						.gte('created_at', weekStartISO),
					supabase
						.from('followers')
						.select('*', { count: 'exact', head: true })
						.eq('following_id', user.id)
						.gte('created_at', weekStartISO),
					supabase
						.from('profile_likes')
						.select('*', { count: 'exact', head: true })
						.eq('liked_profile_id', user.id),
					supabase
						.from('users')
						.select('first_name, last_name, username, bio, heading, avatar_url, cover_photo_url')
						.eq('id', user.id)
						.maybeSingle(),
				]);

				setStats({
					postsThisWeek: postsResult.data?.length || 0,
					newConnections: followersResult.count || 0,
				});
				setProfileLikes(likesResult.count || 0);
				setProfile(profileResult.data);
			} catch {
				setStats({
					postsThisWeek: 0,
					newConnections: 0,
				});
				setProfileLikes(0);
			}
		};
		fetchStats();
	}, [user]);

	useEffect(() => {
		const fetchRecentConnections = async () => {
			if (!user) return;
			// Fetch the latest 3 users the current user is following
			const { data, error } = await supabase
				.from('followers')
				.select(`
          users:users!followers_following_id_fkey(
            id,
            first_name,
            last_name,
            username,
            avatar_url,
            heading
          )
        `)
				.eq('follower_id', user.id)
				.order('created_at', { ascending: false })
				.limit(3);
			if (!error && data) {
				setRecentConnections(
					data
						.map((f: any) => f.users)
						.filter(Boolean)
				);
			} else {
				setRecentConnections([]);
			}
		};
		fetchRecentConnections();
	}, [user]);

	useEffect(() => {
		const onProfileLikesUpdated = (e: Event) => {
			try {
				const detail = (e as CustomEvent).detail;
				if (!detail) return;
				if (detail.userId === user?.id) {
					void supabase
						.from('profile_likes')
						.select('*', { count: 'exact', head: true })
						.eq('liked_profile_id', user.id)
						.then(({ count }) => setProfileLikes(count || 0));
				}
			} catch (err) {
				// ignore malformed events
			}
		};

		window.addEventListener('profile-likes-updated', onProfileLikesUpdated as EventListener);
		return () => window.removeEventListener('profile-likes-updated', onProfileLikesUpdated as EventListener);
	}, [user]);

	return (
		<div className="w-80 space-y-4 p-4 lg:sticky lg:top-20 self-start">
			<Card className="overflow-hidden border-gray-200 shadow-sm dark:border-gray-800 dark:bg-[#161616]">
				<div className="flex items-center gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
					<Avatar className="h-12 w-12">
						<AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url || '/placeholder.svg'} />
						<AvatarFallback className="bg-emerald-700 text-white">
							{profile?.first_name?.[0] || ''}{profile?.last_name?.[0] || ''}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<h3 className="truncate font-semibold text-gray-900 dark:text-gray-100">
							{[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Your profile'}
						</h3>
						<p className="truncate text-sm text-gray-500 dark:text-gray-400">
							{profile?.username ? `@${profile.username}` : 'Profile overview'}
						</p>
					</div>
					<Button variant="ghost" size="icon" title="Edit profile" aria-label="Edit profile" onClick={() => navigate('/profile/edit')}>
						<Edit className="h-4 w-4" />
					</Button>
				</div>
				<div className="grid grid-cols-3 divide-x divide-gray-100 px-2 py-3 text-center dark:divide-gray-800">
					<div className="px-1">
						<div className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{stats.postsThisWeek}</div>
						<div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Posts this week</div>
					</div>
					<div className="px-1">
						<div className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{stats.newConnections}</div>
						<div className="mt-1 text-xs text-gray-500 dark:text-gray-400">New followers</div>
					</div>
					<div className="px-1">
						<div className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{profileLikes}</div>
						<div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Profile likes</div>
					</div>
				</div>
			</Card>

			<Card className="border-gray-200 p-4 shadow-sm dark:border-gray-800 dark:bg-[#161616]">
				<div className="mb-3 flex items-center justify-between">
					<h3 className="font-semibold text-gray-900 dark:text-gray-100">
					Recent Connections
				</h3>
					<Users className="h-4 w-4 text-gray-400" />
				</div>
				<div className="space-y-3">
					{recentConnections.length === 0 ? (
						<div className="rounded-md bg-gray-50 px-3 py-4 text-sm text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
							No recent connections
						</div>
					) : (
						recentConnections.map(connection => (
							<div
								key={connection.id}
								className="flex items-center justify-between"
							>
								<div className="flex min-w-0 items-center gap-3">
									<Avatar className="h-10 w-10">
										<AvatarImage
											src={connection.avatar_url || '/placeholder.svg'}
										/>
										<AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
											{connection.first_name?.[0]}
											{connection.last_name?.[0]}
										</AvatarFallback>
									</Avatar>
									<div>
										<h4 className="font-medium text-gray-900 dark:text-gray-100">
											{connection.first_name} {connection.last_name}
										</h4>
										<p className="text-sm text-blue-600 dark:text-blue-400">
												{connection.heading || `@${connection.username}`}
										</p>
										{/* Optionally show mutual connections if implemented */}
									</div>
								</div>
							</div>
						))
					)}
				</div>
				<Button
					variant="ghost"
					className="mt-2 h-9 w-full justify-start px-2 text-gray-600 dark:text-gray-300"
					onClick={() => navigate('/connections')}
				>
					View all connections
				</Button>
			</Card>

		</div>
	);
};
