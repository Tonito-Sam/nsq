import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Users, Globe2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { Input } from '../../components/ui/input';
import { supabase } from '../../integrations/supabase/client';
import { useToast } from '../../hooks/use-toast';
import WorldMap from '../../components/WorldMap';

const UsersPage = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('all');

  const fetchUsers = async () => {
    setUserLoading(true);
    try {
      let query = supabase.from('users').select('*').order('created_at', { ascending: false });
      if (userSearch) {
        query = query.ilike('username', `%${userSearch}%`);
      }
      if (userFilter !== 'all') {
        query = query.eq('privilege', userFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch users', variant: 'destructive' });
    } finally {
      setUserLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line
  }, [userSearch, userFilter]);

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="flex flex-row items-center gap-2"><Users className="h-5 w-5 text-blue-700" /><CardTitle>Manage Users</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
          <Input
            placeholder="Search by username..."
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            className="w-full md:w-64 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <select
            className="border rounded px-3 py-2 w-full md:w-48 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
          >
            <option value="all">All Privileges</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left">Avatar</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Username</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Country</th>
                <th className="px-4 py-2 text-left">Privilege</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {userLoading ? (
                <tr><td colSpan={8} className="text-center py-8">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8">No users found.</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-2">
                      <Avatar>
                        <AvatarImage src={user.avatar_url} alt={user.username} />
                        <AvatarFallback>{user.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                      </Avatar>
                    </td>
                    <td className="px-4 py-2">{user.first_name} {user.last_name}</td>
                    <td className="px-4 py-2">@{user.username}</td>
                    <td className="px-4 py-2">{user.email}</td>
                    <td className="px-4 py-2">{user.currency}</td>
                    <td className="px-4 py-2 capitalize">{user.privilege || 'user'}</td>
                    <td className="px-4 py-2">
                      {user.privilege === 'banned' ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : user.privilege === 'suspended' ? (
                        <Badge variant="secondary">Suspended</Badge>
                      ) : user.privilege === 'admin' ? (
                        <Badge variant="default">Admin</Badge>
                      ) : (
                        <Badge variant="outline">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 flex gap-2">
                      <Button size="sm" variant="outline">View</Button>
                      <Button size="sm" variant="secondary">Suspend</Button>
                      <Button size="sm" variant="destructive">Ban</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* World Map Visualization under user management */}
        <div className="mt-8">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe2 className="h-5 w-5 text-blue-700" />
                <span>User Distribution Map</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorldMap />
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

export default UsersPage;
