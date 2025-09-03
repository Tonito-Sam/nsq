import React, { useState, useEffect } from 'react';
import { Store, ShoppingBag, CreditCard, Plus, Users, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProfileSection } from './ProfileSection';
import { LiveChat } from './LiveChat';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { SavedPosts } from './SavedPosts';
import { ManageOrders } from './ManageOrders';
import type { Database } from '@/types/supabase';
import CreateGroupModalFull from './CreateGroupModalFull';

const quickLinks = [
	{ icon: Store, label: 'My Store', color: 'text-blue-600', count: 0 },
	{ icon: ShoppingBag, label: 'My Orders', color: 'text-purple-600', count: 0 },
	{ icon: CreditCard, label: 'Saved Posts', color: 'text-green-600', count: 0 },
];

export const Sidebar = () => {
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [newGroupName, setNewGroupName] = useState('');
	const [newGroupDescription, setNewGroupDescription] = useState('');
	const [myGroups, setMyGroups] = useState<any[]>([]);
	const [suggestedGroups, setSuggestedGroups] = useState<any[]>([]);
	const [currentUser, setCurrentUser] = useState<any | null>(null);
	const navigate = useNavigate();
	const [savedPostsCount, setSavedPostsCount] = useState(0);
	const [ordersCount, setOrdersCount] = useState(0);
	const [storeId, setStoreId] = useState<string|null>(null);
	const { toast } = useToast();

	// ... keep existing code (all useEffect hooks and functions remain the same)

	useEffect(() => {
		// Get current user
		const getCurrentUser = async () => {
			const { data: { user } } = await supabase.auth.getUser();
			setCurrentUser(user);
		};
		getCurrentUser();
	}, []);

	useEffect(() => {
		if (currentUser) {
			fetchMyGroups();
			fetchSuggestedGroups();
		}
	}, [currentUser]);

	useEffect(() => {
		if (currentUser) {
			// Fetch user's store id
			supabase
				.from('user_stores')
				.select('id')
				.eq('user_id', currentUser.id)
				.eq('is_active', true)
				.single()
				.then(({ data }) => setStoreId(data?.id || null));
		}
	}, [currentUser]);

	useEffect(() => {
		if (!currentUser) return;
		// Fetch saved posts count
		supabase
			.from('saved_posts')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', currentUser.id)
			.then(({ count }) => setSavedPostsCount(count || 0));
		// Fetch orders received (user is store owner)
		supabase
			.from('user_stores')
			.select('id, is_active, user_id')
			.eq('user_id', currentUser.id)
			.eq('is_active', true as any)
			.single()
			.then(({ data }) => {
				if (data && typeof data === 'object' && 'id' in data && data.id) {
					setStoreId(String(data.id));
					supabase
						.from('orders')
						.select('id', { count: 'exact', head: true })
						.eq('store_id', String(data.id))
						.then(({ count }) => setOrdersCount(count || 0));
				}
			});
	}, [currentUser]);

	// Fix: Add type for group object in fetchMyGroups
	const fetchMyGroups = async () => {
		if (!currentUser) return;

		const { data, error } = await supabase
			.from('group_memberships')
			.select(`
				groups (
					id,
					name,
					description,
					avatar_url,
					created_by,
					created_at
				)
			`)
			.eq('user_id', currentUser.id);

		if (error) {
			console.error('Error fetching my groups:', error);
			return;
		}

		// Fix: data is array of { groups: GroupType }
		type GroupType = {
			id: any;
			name: any;
			description: any;
			avatar_url: any;
			created_by: any;
			created_at: any;
		};
		const groupsWithRole = (data as { groups: GroupType }[]).map(membership => ({
			...membership.groups,
			isCreator: membership.groups.created_by === currentUser.id,
			isNew: false
		}));

		setMyGroups(groupsWithRole);
	};

	const fetchSuggestedGroups = async () => {
		if (!currentUser) return;

		// Get groups user is not a member of
		const { data: membershipData } = await supabase
			.from('group_memberships')
			.select('group_id')
			.eq('user_id', currentUser.id);

		const joinedGroupIds = membershipData?.map(m => m.group_id) || [];

		let query = supabase
			.from('groups')
			.select('id, name, description, avatar_url, created_at');

		if (joinedGroupIds.length > 0) {
			query = query.not('id', 'in', `(${joinedGroupIds.join(',')})`);
		}

		const { data, error } = await query.limit(10);

		if (error) {
			console.error('Error fetching suggested groups:', error);
			return;
		}

		// Get member counts for each group
		const groupsWithCounts = await Promise.all(
			data.map(async (group: any) => {
				const { count } = await supabase
					.from('group_memberships')
					.select('*', { count: 'exact' })
					.eq('group_id', group.id);

				return {
					...group,
					members: count || 0
				};
			})
		);

		setSuggestedGroups(groupsWithCounts);
	};

	const handleCreateGroup = () => setShowCreateModal(true);
	
	const handleModalClose = () => {
		setShowCreateModal(false);
		setNewGroupName('');
		setNewGroupDescription('');
	};

	const handleGroupCreate = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!newGroupName.trim() || !currentUser) return;

		try {
			// Create the group
			const { data: groupData, error: groupError } = await supabase
				.from('groups')
				.insert({
					name: newGroupName.trim(),
					description: newGroupDescription.trim() || null,
					created_by: currentUser.id
				})
				.select()
				.single();

			if (groupError) throw groupError;

			// Add creator as admin member
			const { error: membershipError } = await supabase
				.from('group_memberships')
				.insert({
					group_id: groupData.id,
					user_id: currentUser.id,
					role: 'admin'
				});

			if (membershipError) throw membershipError;

			toast({
				title: "Group created successfully!",
				description: `${groupData.name} has been created.`
			});

			handleModalClose();
			fetchMyGroups();
			fetchSuggestedGroups();
		} catch (error) {
			console.error('Error creating group:', error);
			toast({
				title: "Error creating group",
				description: (error as Error).message,
				variant: "destructive"
			});
		}
	};

	const handleJoinGroup = async (groupId: string) => {
		if (!currentUser) return;

		try {
			const { error } = await supabase
				.from('group_memberships')
				.insert({
					group_id: groupId,
					user_id: currentUser.id,
					role: 'member'
				});

			if (error) throw error;

			toast({
				title: "Joined group successfully!",
				description: "You are now a member of this group."
			});

			fetchMyGroups();
			fetchSuggestedGroups();
		} catch (error) {
			console.error('Error joining group:', error);
			toast({
				title: "Error joining group",
				description: (error as Error).message,
				variant: "destructive"
			});
		}
	};

	const handleLeaveGroup = async (groupId: string) => {
		if (!currentUser) return;

		try {
			const { error } = await supabase
				.from('group_memberships')
				.delete()
				.eq('group_id', groupId)
				.eq('user_id', currentUser.id);

			if (error) throw error;

			toast({
				title: "Left group successfully!",
				description: "You are no longer a member of this group."
			});

			fetchMyGroups();
			fetchSuggestedGroups();
		} catch (error) {
			console.error('Error leaving group:', error);
			toast({
				title: "Error leaving group",
				description: (error as Error).message,
				variant: "destructive"
			});
		}
	};

	const handleQuickLink = (label: string) => {
		if (label === 'My Store' && storeId) navigate(`/store/${storeId}`);
		else if (label === 'My Orders' && storeId) navigate(`/store/${storeId}/orders`);
		else if (label === 'Saved Posts') navigate('/saved-posts');
	};

	return (
		<aside className="w-72 p-4 space-y-6">
			{/* Profile Section */}
			<div className="w-full">
				<ProfileSection />
			</div>

			{/* Quick Links */}
			<Card className="p-4 dark:bg-[#161616] bg-white dark:border-gray-700">
				<h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
					<Store className="h-5 w-5 mr-2 text-blue-600" />
					Quick Links
				</h3>
				<div className="space-y-3">
					<div
						className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors cursor-pointer"
						onClick={() => handleQuickLink('My Store')}
					>
						<div className="flex items-center space-x-3">
							<Store className="h-5 w-5 text-blue-600" />
							<span className="font-medium text-gray-900 dark:text-gray-100">My Store</span>
						</div>
						<Badge variant="outline" className="text-gray-600 dark:text-gray-400">{storeId ? '' : ''}</Badge>
					</div>
					<div
						className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors cursor-pointer"
						onClick={() => handleQuickLink('My Orders')}
					>
						<div className="flex items-center space-x-3">
							<ShoppingBag className="h-5 w-5 text-purple-600" />
							<span className="font-medium text-gray-900 dark:text-gray-100">My Orders</span>
						</div>
						<Badge variant="outline" className="text-gray-600 dark:text-gray-400">{ordersCount}</Badge>
					</div>
					<div
						className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors cursor-pointer"
						onClick={() => handleQuickLink('Saved Posts')}
					>
						<div className="flex items-center space-x-3">
							<CreditCard className="h-5 w-5 text-green-600" />
							<span className="font-medium text-gray-900 dark:text-gray-100">Saved Posts</span>
						</div>
						<Badge variant="outline" className="text-gray-600 dark:text-gray-400">{savedPostsCount}</Badge>
					</div>
				</div>
			</Card>

		

			{/* Groups Header with Create Button */}
			<div className="flex items-center justify-between mb-2 mt-6">
				<h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">Groups</h3>
				<Button size="icon" variant="outline" onClick={() => setShowCreateModal(true)} title="Create Group">
					<Plus className="h-5 w-5" />
				</Button>
			</div>

			{/* My Groups or Empty State */}
			<Card className="p-4 dark:bg-[#161616] bg-white dark:border-gray-700 mb-2">
				{myGroups.length === 0 ? (
					<div className="text-center text-gray-500 text-sm py-4">
						You haven't joined any groups yet.
					</div>
				) : (
					<div className="space-y-3">
						{myGroups.map((group) => (
							<div
								key={group.id}
								className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg group"
							>
								<Avatar className="h-10 w-10">
									<AvatarImage src={group.avatar_url || '/placeholder.svg'} />
									<AvatarFallback className="bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm">
										{group.name.split(' ').map((n: any) => n[0]).join('').substring(0, 2)}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1">
									<div className="flex items-center space-x-2">
										<a
											href={`/groups/${group.id}`}
											className="font-medium text-gray-900 dark:text-gray-100 text-sm hover:underline focus:outline-none"
											style={{ background: 'none', border: 'none', padding: 0 }}
										>
											{group.name}
										</a>
										{group.isNew && (
											<Badge className="bg-green-500 text-white text-xs">New</Badge>
										)}
										{group.isCreator && (
											<Badge className="bg-blue-500 text-white text-xs">Creator</Badge>
										)}
									</div>
									<p className="text-xs text-gray-500 dark:text-gray-400">
										{group.description || 'No description'}
									</p>
								</div>
								{!group.isCreator && (
									<Button 
										size="sm" 
										variant="ghost" 
										className="opacity-0 group-hover:opacity-100 text-xs h-6 px-2"
										onClick={(e) => {
											e.stopPropagation();
											handleLeaveGroup(group.id);
										}}
									>
										Leave
									</Button>
								)}
							</div>
						))}
					</div>
				)}
			</Card>

			{/* Discover Groups */}
			<div className="font-semibold text-gray-900 dark:text-gray-100 text-md mb-2 mt-4">Discover Groups</div>
			<Card className="p-4 dark:bg-[#161616] bg-white dark:border-gray-700">
				{suggestedGroups.length === 0 ? (
					<div className="text-center text-gray-500 text-sm py-4">
						No more groups to discover.
					</div>
				) : (
					<div className="space-y-3">
						{suggestedGroups.map((group) => (
							<div key={group.id} className="flex items-center justify-between">
								<div className="flex items-center space-x-3">
									<Avatar className="h-8 w-8">
										<AvatarImage src={group.avatar_url || '/placeholder.svg'} />
										<AvatarFallback className="bg-gradient-to-r from-green-500 to-teal-500 text-white text-xs">
											{group.name.split(' ').map((n: any) => n[0]).join('').substring(0, 2)}
										</AvatarFallback>
									</Avatar>
									<div>
										<p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
											{group.name}
										</p>
										<p className="text-xs text-gray-500 dark:text-gray-400">
											{group.members} members
										</p>
									</div>
								</div>
								<Button 
									size="sm" 
									variant="outline" 
									className="h-7 px-2 text-xs"
									onClick={() => handleJoinGroup(group.id)}
								>
									Join
								</Button>
							</div>
						))}
					</div>
				)}
			</Card>

			{/* Create Group Modal (shared) */}
			<CreateGroupModalFull open={showCreateModal} onOpenChange={setShowCreateModal} onGroupCreated={() => { setShowCreateModal(false); fetchMyGroups(); fetchSuggestedGroups(); }} />
		</aside>
	);
};

// ... keep existing code (GroupSidebar component remains the same)

// GroupSidebar: strictly for group page
export const GroupSidebar = ({ group, stats, suggestedGroups = [] }) => {
	return (
		<aside className="w-72 p-4 space-y-6">
			{/* Group Info Card */}
			<Card className="p-4 dark:bg-[#161616] bg-white dark:border-gray-700 flex flex-col items-center text-center">
				<Avatar className="h-20 w-20 mb-2">
					<AvatarImage src={group.avatar_url || '/placeholder.svg'} />
					<AvatarFallback>{group.name?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback>
				</Avatar>
				<h2 className="text-xl font-bold mt-2 mb-1">{group.name}</h2>
				<p className="text-gray-500 text-sm mb-2">{group.description}</p>
				{group.cover_url && (
					<img
						src={group.cover_url}
						alt="Group Cover"
						className="w-full h-24 object-cover rounded mb-2"
					/>
				)}
				<div className="flex flex-wrap justify-center gap-4 mt-2 mb-2">
					<div>
						<span className="font-semibold text-lg">{stats?.members ?? 0}</span>
						<div className="text-xs text-gray-400">Members</div>
					</div>
					<div>
						<span className="font-semibold text-lg">{stats?.posts ?? 0}</span>
						<div className="text-xs text-gray-400">Posts</div>
					</div>
					<div>
						<span className="font-semibold text-lg">{stats?.views ?? 0}</span>
						<div className="text-xs text-gray-400">Views</div>
					</div>
					<div>
						<span className="font-semibold text-lg">{stats?.likes ?? 0}</span>
						<div className="text-xs text-gray-400">Likes</div>
					</div>
				</div>
			</Card>
			
			{/* Suggested Groups Card */}
			<Card className="p-4 dark:bg-[#161616] bg-white dark:border-gray-700">
				<h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center">
					<Users className="h-5 w-5 mr-2 text-purple-600" />
					Suggested Groups
				</h3>
				{suggestedGroups.length === 0 ? (
					<div className="text-xs text-gray-500">No more groups to join.</div>
				) : (
					suggestedGroups.map((sg) => (
						<div
							key={sg.id}
							className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg cursor-pointer"
							onClick={() => (window.location.href = `/groups/${sg.id}`)}
						>
							<Avatar className="h-8 w-8">
								<AvatarImage src={sg.avatar_url || '/placeholder.svg'} />
								<AvatarFallback>
									{sg.name?.charAt(0)?.toUpperCase() || '?'}
								</AvatarFallback>
							</Avatar>
							<div className="flex-1">
								<p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
									{sg.name}
								</p>
								<p className="text-xs text-gray-500 dark:text-gray-400">
									{sg.members_count || 0} members
								</p>
							</div>
						</div>
					))
				)}
			</Card>
		</aside>
	);
};
