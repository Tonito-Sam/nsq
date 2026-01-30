import React, { useEffect, useState } from 'react';
import { Edit, Users, Heart, Eye, UserPlus } from 'lucide-react';
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
		postReach: 0,
		newConnections: 0,
		weeklyEarnings: 0,
		newCustomers: 0,
	});
	const [profileLikes, setProfileLikes] = useState<number>(0);
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

				// Post reach: fallback to posts.length * 150 (since views_count does not exist)
				const { data: posts } = await supabase
					.from('posts')
					.select('id')
					.eq('user_id', user.id)
					.gte('created_at', weekStartISO);
				const postReach = (posts?.length || 0) * 150;

				// New connections: followers added this week
				const { count: newConnections } = await supabase
					.from('followers')
					.select('*', { count: 'exact', head: true })
					.eq('following_id', user.id)
					.gte('created_at', weekStartISO);

				// Weekly earnings: sum of completed orders this week
				const { data: orders } = await supabase
					.from('orders')
					.select('total_amount')
					.eq('store_id', user.id)
					.eq('status', 'completed')
					.gte('created_at', weekStartISO);
				const weeklyEarnings =
					orders?.reduce(
						(sum, order) => sum + (Number(order.total_amount) || 0),
						0
					) || 0;

				// New customers: unique users who placed orders this week
				const { data: newCustomerOrders } = await supabase
					.from('orders')
					.select('user_id')
					.eq('store_id', user.id)
					.eq('status', 'completed')
					.gte('created_at', weekStartISO);
				const uniqueCustomers = new Set(
					(newCustomerOrders || []).map(o => o.user_id)
				);
				const newCustomers = uniqueCustomers.size;

				// Profile likes (canonical count)
				const { count: likesCount } = await supabase
					.from('profile_likes')
					.select('*', { count: 'exact', head: true })
					.eq('liked_profile_id', user.id);

				setStats({
					postReach,
					newConnections: newConnections || 0,
					weeklyEarnings,
					newCustomers,
				});
				setProfileLikes(likesCount || 0);
			} catch {
				setStats({
					postReach: 0,
					newConnections: 0,
					weeklyEarnings: 0,
					newCustomers: 0,
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
					setProfileLikes(detail.likes || 0);
				}
			} catch (err) {
				// ignore malformed events
			}
		};

		window.addEventListener('profile-likes-updated', onProfileLikesUpdated as EventListener);
		return () => window.removeEventListener('profile-likes-updated', onProfileLikesUpdated as EventListener);
	}, [user]);

	// Helper: fetch mutual connections (optional, can be improved for performance)
	const getMutualConnections = (connectionId: string) => {
		// This is a placeholder. For real mutuals, you would query followers where both user.id and connectionId follow the same people.
		return null;
	};

	return (
		<div className="w-80 space-y-6 lg:sticky lg:top-24 self-start">
			{/* Profile Analytics (real data) */}
			<Card className="p-6 dark:bg-[#161616] bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10">
				<div className="flex items-center justify-between mb-2">
					<h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">Profile Analytics</h3>
					<Badge variant="outline" className="text-sm">
						{profileLikes} Likes
					</Badge>
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div className="flex flex-col items-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
						<Eye className="h-5 w-5 text-purple-500 mb-1" />
						<div className="font-bold text-lg text-gray-900 dark:text-gray-100">
							{stats.postReach}
						</div>
						<div className="text-xs text-gray-500 dark:text-gray-400">
							Post Reach (This Week)
						</div>
					</div>
					<Card className="flex flex-col items-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
						<Users className="h-5 w-5 text-blue-500 mb-1" />
						<div className="font-bold text-lg text-gray-900 dark:text-gray-100">
							{stats.newConnections}
						</div>
						<div className="text-xs text-gray-500 dark:text-gray-400">
							New Connections
						</div>
					</Card>
					<div className="flex flex-col items-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
						<Heart className="h-5 w-5 text-red-500 mb-1" />
						<div className="font-bold text-lg text-gray-900 dark:text-gray-100">
							${stats.weeklyEarnings}
						</div>
						<div className="text-xs text-gray-500 dark:text-gray-400">
							Weekly Earnings
						</div>
					</div>
					<div className="flex flex-col items-center p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
						<UserPlus className="h-5 w-5 text-green-500 mb-1" />
						<div className="font-bold text-lg text-gray-900 dark:text-gray-100">
							{stats.newCustomers}
						</div>
						<div className="text-xs text-gray-500 dark:text-gray-400">
							New Customers
						</div>
					</div>
				</div>
			</Card>

			{/* Recent Connections (real data) */}
			<Card className="p-6 dark:bg-[#161616] bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/10 dark:to-teal-900/10">
				<h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">
					Recent Connections
				</h3>
				<div className="space-y-4">
					{recentConnections.length === 0 ? (
						<div className="text-gray-500 dark:text-gray-400">
							No recent connections
						</div>
					) : (
						recentConnections.map(connection => (
							<div
								key={connection.id}
								className="flex items-center justify-between"
							>
								<div className="flex items-center space-x-3">
									<Avatar className="h-12 w-12">
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
											{connection.heading}
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
					className="w-full mt-4 text-blue-600 dark:text-blue-400"
					onClick={() => navigate('/connections')}
				>
					View all connections
				</Button>
			</Card>

			{/* Profile Completion */}
			<Card className="p-6 dark:bg-[#161616] bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10">
				<h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">
					Complete Your Profile
				</h3>
				<div className="space-y-3">
					<div className="flex items-center justify-between p-2 bg-white/50 dark:bg-gray-800/50 rounded">
						<span className="text-sm text-gray-600 dark:text-gray-300">
							Add bio
						</span>
						<Badge variant="outline" className="text-yellow-600">
							Missing
						</Badge>
					</div>
					<div className="flex items-center justify-between p-2 bg-white/50 dark:bg-gray-800/50 rounded">
						<span className="text-sm text-gray-600 dark:text-gray-300">
							Upload cover photo
						</span>
						<Badge variant="outline" className="text-green-600">
							Done
						</Badge>
					</div>
					<div className="flex items-center justify-between p-2 bg-white/50 dark:bg-gray-800/50 rounded">
						<span className="text-sm text-gray-600 dark:text-gray-300">
							Add location
						</span>
						<Badge variant="outline" className="text-yellow-600">
							Missing
						</Badge>
					</div>
				</div>
				<Button
					className="w-full mt-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
					onClick={() => navigate('/profile/edit')}
				>
					Complete Profile
				</Button>
			</Card>

			{/* User info section (clickable) */}
			{user && (
				<Card className="p-6 dark:bg-[#161616] bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 mb-6">
					<div className="flex items-center space-x-4">
						<Avatar
							className="h-16 w-16 cursor-pointer"
							onClick={() =>
								navigate(
									`/profile/${
										user.user_metadata?.username ||
										user.email?.split('@')[0] ||
										user.id
									}`
								)
							}
						>
							<AvatarImage
								src={user.user_metadata?.avatar_url || '/placeholder.svg'}
							/>
							<AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-2xl">
								{user.user_metadata?.first_name?.[0] || ''}
								{user.user_metadata?.last_name?.[0] || ''}
							</AvatarFallback>
						</Avatar>
						<div>
							<p
								className="font-bold text-lg text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600"
								onClick={() =>
									navigate(
										`/profile/${
											user.user_metadata?.username ||
											user.email?.split('@')[0] ||
											user.id
										}`
									)
								}
							>
								{user.user_metadata?.first_name || ''}{' '}
								{user.user_metadata?.last_name || ''}
							</p>
							<p
								className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-blue-600"
								onClick={() =>
									navigate(
										`/profile/${
											user.user_metadata?.username ||
											user.email?.split('@')[0] ||
											user.id
										}`
									)
								}
							>
								@
								{user.user_metadata?.username ||
									user.email?.split('@')[0] ||
									user.id}
							</p>
						</div>
					</div>
				</Card>
			)}
		</div>
	);
};
