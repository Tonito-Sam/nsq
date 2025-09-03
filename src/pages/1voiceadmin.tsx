import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useUserPrivilege } from '../hooks/useUserPrivilege';

export default function OneVoiceAdmin() {
  const { privilege, loading } = useUserPrivilege();
  const [tab, setTab] = useState('users');

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;
  if (privilege !== 'admin')
    return <div className="p-6 text-red-600 font-bold">Access denied. Admins only.</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">1Voice Admin Dashboard</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex flex-wrap gap-2">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="stores">Stores</TabsTrigger>
          <TabsTrigger value="reports">Post Reports</TabsTrigger>
          <TabsTrigger value="studios">1Studio Shows</TabsTrigger>
          <TabsTrigger value="radio">Live Radio Shows</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawal Requests</TabsTrigger>
          <TabsTrigger value="transfers">Funds Transfers</TabsTrigger>
          <TabsTrigger value="tickets">Tickets & Support</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader><CardTitle>Manage Users</CardTitle></CardHeader>
            <CardContent>
              {/* TODO: Add user management table/component here */}
              <div>Users management coming soon...</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="stores">
          <Card>
            <CardHeader><CardTitle>Manage Stores</CardTitle></CardHeader>
            <CardContent>
              {/* TODO: Add store management table/component here */}
              <div>Stores management coming soon...</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="reports">
          <Card>
            <CardHeader><CardTitle>Manage Post Reports</CardTitle></CardHeader>
            <CardContent>
              {/* TODO: Add post reports management table/component here */}
              <div>Post reports management coming soon...</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="studios">
          <Card>
            <CardHeader><CardTitle>Manage 1Studio Shows</CardTitle></CardHeader>
            <CardContent>
              {/* TODO: Add 1Studio shows management table/component here */}
              <div>1Studio shows management coming soon...</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="radio">
          <Card>
            <CardHeader><CardTitle>Manage Live Radio Shows</CardTitle></CardHeader>
            <CardContent>
              {/* TODO: Add live radio shows management table/component here */}
              <div>Live radio shows management coming soon...</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="withdrawals">
          <Card>
            <CardHeader><CardTitle>Manage Withdrawal Requests</CardTitle></CardHeader>
            <CardContent>
              {/* TODO: Add withdrawal requests management table/component here */}
              <div>Withdrawal requests management coming soon...</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="transfers">
          <Card>
            <CardHeader><CardTitle>Manage Funds Transfers</CardTitle></CardHeader>
            <CardContent>
              {/* TODO: Add funds transfers management table/component here */}
              <div>Funds transfers management coming soon...</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tickets">
          <Card>
            <CardHeader><CardTitle>Manage Tickets & Support</CardTitle></CardHeader>
            <CardContent>
              {/* TODO: Add tickets/support management table/component here */}
              <div>Tickets & support management coming soon...</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
