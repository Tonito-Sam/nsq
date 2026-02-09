import React, { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useOrganizations } from '@/hooks/useOrganizations';

const ProfileRightSidebar: React.FC = () => {
  const { organizations, loading, fetchOrganizations } = useOrganizations();
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-md font-semibold mb-2">Organizations</h3>
        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : organizations.length === 0 ? (
          <div className="text-sm text-gray-500">No organizations yet</div>
        ) : (
          <div className="flex flex-col gap-2">
            {organizations.slice(0, 5).map((org) => (
              <button
                key={org.id}
                className="text-left text-sm hover:underline"
                onClick={() => navigate(`/org/${org.slug || org.id}`)}
              >
                {org.name}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3">
          <Button size="sm" onClick={() => navigate('/profile/edit?tab=organizations')} className="w-full">
            Manage Organizations
          </Button>
        </div>
      </Card>

      {/* Placeholder for future right-side cards (e.g., upcoming events, quick links) */}
      <Card className="p-4">
        <h3 className="text-md font-semibold mb-2">Quick Actions</h3>
        <div className="flex flex-col gap-2">
          <Button size="sm" variant="ghost" onClick={() => navigate('/groups')}>
            View Groups
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate('/my-store')}>
            My Store
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProfileRightSidebar;
