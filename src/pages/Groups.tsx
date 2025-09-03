import React, { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Search, Plus, Settings, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import CreateGroupModal from '@/components/CreateGroupModal';
import { MobileBottomNav } from '@/components/MobileBottomNav';

const Groups = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [suggestedGroups, setSuggestedGroups] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true);
      // Fetch groups the user is a member of
      let myGroupsData: any[] = [];
      if (user) {
        const { data: memberships } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id);
        const groupIds = memberships?.map((m: any) => m.group_id) || [];
        if (groupIds.length > 0) {
          const { data: groups } = await supabase
            .from('groups')
            .select('*')
            .in('id', groupIds);
          myGroupsData = groups || [];
        }
      }
      setMyGroups(myGroupsData);
      // Fetch suggested groups (not a member)
      const { data: allGroups } = await supabase
        .from('groups')
        .select('*');
      const suggested = (allGroups || []).filter(
        (g: any) => !myGroupsData.some((mg: any) => mg.id === g.id)
      );
      setSuggestedGroups(suggested);
      setLoading(false);
    };
    fetchGroups();
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Groups</h1>
            <p className="text-gray-600 dark:text-gray-400">Connect with communities that share your interests</p>
          </div>
          <Button className="bg-gradient-to-r from-purple-600 to-pink-600" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Group
          </Button>
        </div>

        {/* Search Bar */}
        <Card className="dark:bg-[#161616] p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search groups..."
              className="pl-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* My Groups */}
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              My Groups ({myGroups.length})
            </h2>
            <div className="space-y-4">
              {myGroups.filter(g => g.name.toLowerCase().includes(search.toLowerCase())).map((group) => (
                <Card key={group.id} className="dark:bg-[#161616] cursor-pointer" onClick={() => navigate(`/groups/${group.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={group.avatar_url || '/placeholder.svg'} />
                        <AvatarFallback className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                          {group.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-lg truncate">{group.name}</h3>
                          {group.isAdmin && <Badge className="bg-green-500">Admin</Badge>}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{group.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">{group.members_count?.toLocaleString() || 0} members</span>
                        </div>
                        <div className="flex space-x-2 mt-3">
                          <Button size="sm" variant="outline" className="flex-1" onClick={e => {e.stopPropagation();navigate(`/groups/${group.id}`);}}>
                            <MessageCircle className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          {group.isAdmin && (
                            <Button size="sm" variant="outline" onClick={e => {e.stopPropagation();navigate(`/groups/${group.id}/settings`);}}>
                              <Settings className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Suggested Groups */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Suggested Groups</h2>
            <div className="space-y-4">
              {suggestedGroups.filter(g => g.name.toLowerCase().includes(search.toLowerCase())).map((group) => (
                <Card key={group.id} className="dark:bg-[#161616] cursor-pointer" onClick={() => navigate(`/groups/${group.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={group.avatar_url || '/placeholder.svg'} />
                        <AvatarFallback className="bg-gradient-to-r from-green-500 to-teal-500 text-white">
                          {group.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{group.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{group.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">{group.members_count?.toLocaleString() || 0} members</span>
                          <Button size="sm">Join</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Create Group Modal */}
        <CreateGroupModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onGroupCreated={() => window.location.reload()}
        />
      </div>
      {/* Mobile Bottom Navigation */}
      <div className="md:hidden">
        <MobileBottomNav />
      </div>
    </div>
  );
};

export default Groups;
