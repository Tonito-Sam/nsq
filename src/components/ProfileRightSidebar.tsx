import React, { useEffect, useState } from 'react';
import { BadgeCheck, Building2, Globe2, MapPin, Store, Users, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import EditProfile from '@/pages/EditProfile';
import axios from 'axios';
import apiUrl from '@/lib/api';
import type { Organization } from '@/types/organization';

interface ProfileRightSidebarProps {
  userId: string;
  isOwnProfile: boolean;
  inlineEditorOpen: boolean;
  onInlineEditorOpenChange: (open: boolean) => void;
}

const ProfileRightSidebar: React.FC<ProfileRightSidebarProps> = ({
  userId,
  isOwnProfile,
  inlineEditorOpen,
  onInlineEditorOpenChange,
}) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isCurrent = true;
    const loadOrganizations = () => {
      setLoading(true);
      axios
        .get(apiUrl(`/api/organizations?user_id=${userId}`), { withCredentials: true })
        .then(({ data }) => {
          if (isCurrent) setOrganizations(Array.isArray(data) ? data : []);
        })
        .catch((error) => {
          console.error('Failed to load profile organizations', error);
          if (isCurrent) setOrganizations([]);
        })
        .finally(() => {
          if (isCurrent) setLoading(false);
        });
    };

    loadOrganizations();
    window.addEventListener('organizations-updated', loadOrganizations);

    return () => {
      isCurrent = false;
      window.removeEventListener('organizations-updated', loadOrganizations);
    };
  }, [userId]);

  return (
    <div className="space-y-4">
      <Card className="border-gray-200 p-4 shadow-sm dark:border-gray-800 dark:bg-[#161616]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            <h3 className="font-semibold">Organizations</h3>
          </div>
          {!loading && organizations.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{organizations.length}</span>
          )}
        </div>
        {loading ? (
          <div className="space-y-3 py-2" aria-label="Loading organizations">
            <div className="h-14 animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
            <div className="h-14 animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : organizations.length === 0 ? (
          <div className="rounded-md bg-gray-50 px-3 py-4 text-sm text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
            No organizations to show
          </div>
        ) : (
          <div className="-mx-4 divide-y divide-gray-100 dark:divide-gray-800">
            {organizations.slice(0, 3).map((org) => {
              const website = org.website
                ? (/^https?:\/\//i.test(org.website) ? org.website : `https://${org.website}`)
                : null;

              return (
                <article key={org.id} className="min-w-0">
                  <div
                    className="h-14 bg-gray-100 bg-cover bg-center dark:bg-gray-800"
                    style={org.cover_photo_url ? { backgroundImage: `url("${org.cover_photo_url}")` } : undefined}
                  />
                  <div className="px-4 pb-4">
                    <div className="-mt-7 mb-2 flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border-2 border-white bg-white shadow-sm dark:border-[#161616] dark:bg-gray-900">
                      {org.logo_url ? (
                        <img src={org.logo_url} alt={`${org.name} logo`} className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-6 w-6 text-gray-400" aria-hidden="true" />
                      )}
                    </div>
                    <button
                      className="flex max-w-full items-center gap-1 text-left font-semibold text-gray-900 hover:text-emerald-700 dark:text-gray-100 dark:hover:text-emerald-400"
                      onClick={() => navigate(`/org/${org.slug || org.id}`)}
                    >
                      <span className="truncate">{org.name}</span>
                      {org.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-blue-600" aria-label="Verified organization" />}
                    </button>
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{org.industry || 'Organization'}</p>
                    {org.location && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{org.location}</span>
                      </p>
                    )}
                    {org.description && (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-600 dark:text-gray-300">{org.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span>{Number(org.followers_count || 0).toLocaleString()} followers</span>
                      <span>{Number(org.members_count || 0).toLocaleString()} members</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate(`/org/${org.slug || org.id}`)}>
                        View organization
                      </Button>
                      {website && (
                        <Button asChild size="icon" variant="outline" aria-label={`Open ${org.name} website`} title="Open website">
                          <a href={website} target="_blank" rel="noopener noreferrer">
                            <Globe2 className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {isOwnProfile && (
          <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onInlineEditorOpenChange(!inlineEditorOpen)}
              className="w-full justify-between"
              aria-expanded={inlineEditorOpen}
            >
              {inlineEditorOpen ? 'Close profile editor' : 'Edit profile & manage organizations'}
              {inlineEditorOpen && <X className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </Card>

      {isOwnProfile && inlineEditorOpen && (
        <div className="min-w-0 rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-[#161616]">
          <EditProfile inline />
        </div>
      )}

      <Card className="border-gray-200 p-4 shadow-sm dark:border-gray-800 dark:bg-[#161616]">
        <h3 className="mb-2 font-semibold">Shortcuts</h3>
        <div className="space-y-1">
          <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => navigate('/groups')}>
            <Users className="h-4 w-4" />
            Browse groups
          </Button>
          {isOwnProfile && (
            <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => navigate('/my-store')}>
              <Store className="h-4 w-4" />
              Open my store
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ProfileRightSidebar;
