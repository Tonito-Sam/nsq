import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Shield, Clock, Eye, AlertTriangle, Settings } from 'lucide-react';

export interface MinorAccount {
  id: string;
  username: string;
  age: number;
  relationship: string;
  timeLimit: number;
  monitoringEnabled: boolean;
  chatReviewEnabled: boolean;
  restrictedWords: boolean;
}

const relationshipOptions = ['Son', 'Daughter', 'Nephew', 'Niece', 'Cousin', 'Other'];


interface ParentalGuidanceCardProps {
  minorAccounts: MinorAccount[];
  isAddingAccount: boolean;
  newAccount: MinorAccount;
  onAddAccount: () => void;
  onRemoveAccount: (index: number) => void;
  onUpdateAccount: (id: string, updates: Partial<MinorAccount>) => void;
  onSetIsAddingAccount: (val: boolean) => void;
  onSetNewAccount: (acc: MinorAccount) => void;
}

const ParentalGuidanceCard: React.FC<ParentalGuidanceCardProps> = ({
  minorAccounts,
  isAddingAccount,
  newAccount,
  onAddAccount,
  onRemoveAccount,
  onUpdateAccount,
  onSetIsAddingAccount,
  onSetNewAccount
}) => {
  const [userSuggestions, setUserSuggestions] = useState<{ id: string; username: string; birthday?: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    // Fetch all users for suggestions
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, birthday');
      if (data) setUserSuggestions(data);
    };
    fetchUsers();
  }, []);

  // Filter suggestions as user types
  const filteredSuggestions = newAccount.username.length > 0
    ? userSuggestions.filter(u => u.username.toLowerCase().includes(newAccount.username.toLowerCase()))
    : [];

  // Handle selection from suggestions
  const handleSuggestionSelect = (user: { id: string; username: string; birthday?: string }) => {
    onSetNewAccount({
      ...newAccount,
      username: user.username,
      id: user.id,
      // Optionally set age from birthday if available
      age: user.birthday ? Math.max(13, Math.min(18, getAgeFromBirthday(user.birthday))) : newAccount.age
    });
    setShowSuggestions(false);
  };

  // Helper to calculate age from birthday string (YYYY-MM-DD)
  function getAgeFromBirthday(birthday: string): number {
    const birthDate = new Date(birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  return (
    <Card className="p-6 dark:bg-[#161616]">
      <div className="flex items-center mb-4">
        <Shield className="h-5 w-5 mr-2 text-primary" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Parental Guidance Portal (PGP)
        </h2>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Monitor and manage minor accounts (ages 13-18) under your supervision
      </p>

      <div className="space-y-4">
        {minorAccounts.length === 0 && !isAddingAccount && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Shield className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              No minor accounts added yet. Add accounts to monitor and guide young users.
            </p>
            <Button
              type="button"
              variant="outline"
              className="flex items-center gap-2 mx-auto"
              onClick={() => onSetIsAddingAccount(true)}
            >
              <Plus className="h-4 w-4" />
              Add Minor Account
            </Button>
          </div>
        )}

        {/* Existing minor accounts list (no autocomplete) */}
        {minorAccounts.map(account => (
          <div key={account.id} className="space-y-4 border rounded-lg p-4 dark:border-gray-700">
            <div className="flex gap-3 items-center">
              <Input
                type="text"
                value={account.username}
                onChange={e => onUpdateAccount(account.id, { username: e.target.value })}
                placeholder="Minor's Username"
                className="dark:bg-[#161616] dark:border-gray-600"
              />
              <Input
                type="number"
                value={account.age}
                min={13}
                max={18}
                onChange={e => onUpdateAccount(account.id, { age: Number(e.target.value) })}
                className="dark:bg-[#161616] dark:border-gray-600"
              />
              <Input
                type="text"
                value={account.relationship}
                onChange={e => onUpdateAccount(account.id, { relationship: e.target.value })}
                placeholder="Relationship"
                className="dark:bg-[#161616] dark:border-gray-600"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveAccount(minorAccounts.indexOf(account))}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Advanced settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Daily Time Limit</span>
                  </div>
                  <Select
                    value={account.timeLimit.toString()}
                    onValueChange={value => onUpdateAccount(account.id, { timeLimit: parseInt(value) })}
                  >
                    <SelectTrigger className="w-20 dark:bg-[#161616] dark:border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 8, 10].map(hours => (
                        <SelectItem key={hours} value={hours.toString()}>
                          {hours}h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span className="text-sm">Activity Monitoring</span>
                  </div>
                  <Switch
                    checked={account.monitoringEnabled}
                    onCheckedChange={checked => onUpdateAccount(account.id, { monitoringEnabled: checked })}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="text-sm">Chat Review</span>
                  </div>
                  <Switch
                    checked={account.chatReviewEnabled}
                    onCheckedChange={checked => onUpdateAccount(account.id, { chatReviewEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">Restricted Words Alert</span>
                  </div>
                  <Switch
                    checked={account.restrictedWords}
                    onCheckedChange={checked => onUpdateAccount(account.id, { restrictedWords: checked })}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add new account form with autocomplete */}
        {isAddingAccount && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <Label htmlFor="minor-username">Username</Label>
                <Input
                  id="minor-username"
                  value={newAccount.username}
                  onChange={e => onSetNewAccount({ ...newAccount, username: e.target.value })}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Enter minor's username"
                  className="dark:bg-[#161616] dark:border-gray-600"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white dark:bg-[#222] border border-gray-300 dark:border-gray-700 rounded shadow-lg max-h-40 overflow-y-auto">
                    {filteredSuggestions.map(user => (
                      <div
                        key={user.id}
                        className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                        onMouseDown={() => handleSuggestionSelect(user)}
                      >
                        {user.username}
                        {user.birthday && (
                          <span className="ml-2 text-xs text-gray-500">({getAgeFromBirthday(user.birthday)} yrs)</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="minor-age">Age</Label>
                <Select
                  value={newAccount.age.toString()}
                  onValueChange={value => onSetNewAccount({ ...newAccount, age: parseInt(value) })}
                >
                  <SelectTrigger className="dark:bg-[#161616] dark:border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 6 }, (_, i) => i + 13).map(age => (
                      <SelectItem key={age} value={age.toString()}>
                        {age} years old
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="minor-relationship">Relationship</Label>
              <Select
                value={newAccount.relationship}
                onValueChange={value => onSetNewAccount({ ...newAccount, relationship: value })}
              >
                <SelectTrigger className="dark:bg-[#161616] dark:border-gray-600">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {relationshipOptions.map(option => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="time-limit">Daily Time Limit (hours)</Label>
              <Select
                value={newAccount.timeLimit.toString()}
                onValueChange={value => onSetNewAccount({ ...newAccount, timeLimit: parseInt(value) })}
              >
                <SelectTrigger className="dark:bg-[#161616] dark:border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 8, 10].map(hours => (
                    <SelectItem key={hours} value={hours.toString()}>
                      {hours} hours
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={onAddAccount} size="sm">
                Add Minor Account
              </Button>
              <Button
                variant="outline"
                onClick={() => onSetIsAddingAccount(false)}
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!isAddingAccount && minorAccounts.length > 0 && (
          <Button
            variant="outline"
            onClick={() => onSetIsAddingAccount(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Minor Account
          </Button>
        )}
      </div>
    </Card>
  );
};

export default ParentalGuidanceCard;