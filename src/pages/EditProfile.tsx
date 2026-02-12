import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Save, ArrowLeft, Upload } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { uploadFile } from '@/utils/mediaUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { banksByCountry } from '@/utils/banksByCountry';
import { statesByCountry } from '@/utils/statesByCountry';
import { countries } from '@/utils/countries';
import { Switch } from '@/components/ui/switch';
import { useQueryClient } from '@tanstack/react-query';
import Cropper from 'react-easy-crop';
import BirthdaysAnniversariesCard from '@/components/BirthdaysAnniversariesCard';
import type { EventItem } from '@/components/BirthdaysAnniversariesCard';
import ParentalGuidanceCard from '@/components/ParentalGuidanceCard';
import { OrganizationsTab } from '@/components/OrganizationsTab';
import type { MinorAccount } from '@/components/ParentalGuidanceCard';

interface UserData {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  bio: string;
  heading: string;
  currency: string;
  avatar_url: string;
  cover_photo_url: string;
  created_at: string;
  updated_at: string;
  verified: boolean;
  birthday?: string | null;
  anniversary1_date?: string | null;
  anniversary1_label?: string | null;
  anniversary2_date?: string | null;
  anniversary2_label?: string | null;
  anniversary3_date?: string | null;
  anniversary3_label?: string | null;
}

interface BankAccount {
  id: string;
  user_id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch_name: string;
  country: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  paypal_email?: string;
  state_province?: string;
}

// Comprehensive list of world currencies
const CURRENCIES = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'BRL', name: 'Brazilian Real' },
  { code: 'RUB', name: 'Russian Ruble' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'TRY', name: 'Turkish Lira' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Złoty' },
  { code: 'ILS', name: 'Israeli New Shekel' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'CLP', name: 'Chilean Peso' },
  { code: 'COP', name: 'Colombian Peso' },
  { code: 'EGP', name: 'Egyptian Pound' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'MAD', name: 'Moroccan Dirham' },
  { code: 'RON', name: 'Romanian Leu' },
  { code: 'CZK', name: 'Czech Koruna' },
  { code: 'HUF', name: 'Hungarian Forint' },
  { code: 'ISK', name: 'Icelandic Króna' },
  { code: 'HRK', name: 'Croatian Kuna' },
  { code: 'BGN', name: 'Bulgarian Lev' },
  { code: 'RSD', name: 'Serbian Dinar' },
  { code: 'UAH', name: 'Ukrainian Hryvnia' },
  { code: 'KZT', name: 'Kazakhstani Tenge' },
  { code: 'QAR', name: 'Qatari Riyal' },
  { code: 'KWD', name: 'Kuwaiti Dinar' },
  { code: 'BHD', name: 'Bahraini Dinar' },
  { code: 'OMR', name: 'Omani Rial' },
  { code: 'JOD', name: 'Jordanian Dinar' },
  { code: 'LKR', name: 'Sri Lankan Rupee' },
  { code: 'NPR', name: 'Nepalese Rupee' },
  { code: 'MMK', name: 'Myanmar Kyat' },
  { code: 'KHR', name: 'Cambodian Riel' },
  { code: 'LAK', name: 'Lao Kip' },
  { code: 'MNT', name: 'Mongolian Tögrög' },
  { code: 'TWD', name: 'Taiwan Dollar' },
  { code: 'PEN', name: 'Peruvian Sol' },
  { code: 'ARS', name: 'Argentine Peso' },
  { code: 'UYU', name: 'Uruguayan Peso' },
  { code: 'BOB', name: 'Bolivian Boliviano' },
  { code: 'PYG', name: 'Paraguayan Guaraní' },
  { code: 'CRC', name: 'Costa Rican Colón' },
  { code: 'DOP', name: 'Dominican Peso' },
  { code: 'GTQ', name: 'Guatemalan Quetzal' },
  { code: 'HNL', name: 'Honduran Lempira' },
  { code: 'NIO', name: 'Nicaraguan Córdoba' },
  { code: 'PAB', name: 'Panamanian Balboa' },
  { code: 'SVC', name: 'Salvadoran Colón' },
  { code: 'TTD', name: 'Trinidad and Tobago Dollar' },
  { code: 'JMD', name: 'Jamaican Dollar' },
  { code: 'BBD', name: 'Barbadian Dollar' },
  { code: 'BZD', name: 'Belize Dollar' },
  { code: 'BSD', name: 'Bahamian Dollar' },
  { code: 'BMD', name: 'Bermudian Dollar' },
  { code: 'KYD', name: 'Cayman Islands Dollar' },
  { code: 'FJD', name: 'Fijian Dollar' },
  { code: 'WST', name: 'Samoan Tālā' },
  { code: 'TOP', name: 'Tongan Paʻanga' },
  { code: 'SBD', name: 'Solomon Islands Dollar' },
  { code: 'VUV', name: 'Vanuatu Vatu' },
  { code: 'XPF', name: 'CFP Franc' },
  { code: 'XCD', name: 'East Caribbean Dollar' },
  { code: 'ANG', name: 'Netherlands Antillean Guilder' },
  { code: 'AWG', name: 'Aruban Florin' },
  { code: 'BIF', name: 'Burundian Franc' },
  { code: 'CDF', name: 'Congolese Franc' },
  { code: 'DJF', name: 'Djiboutian Franc' },
  { code: 'GNF', name: 'Guinean Franc' },
  { code: 'RWF', name: 'Rwandan Franc' },
  { code: 'XAF', name: 'Central African CFA Franc' },
  { code: 'XOF', name: 'West African CFA Franc' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'GMD', name: 'Gambian Dalasi' },
  { code: 'MGA', name: 'Malagasy Ariary' },
  { code: 'MUR', name: 'Mauritian Rupee' },
  { code: 'SCR', name: 'Seychellois Rupee' },
  { code: 'SLL', name: 'Sierra Leonean Leone' },
  { code: 'SOS', name: 'Somali Shilling' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'ZMW', name: 'Zambian Kwacha' },
  { code: 'ZWL', name: 'Zimbabwean Dollar' },
  { code: 'GIP', name: 'Gibraltar Pound' },
  { code: 'FKP', name: 'Falkland Islands Pound' },
  { code: 'SHP', name: 'Saint Helena Pound' },
  { code: 'IMP', name: 'Manx Pound' },
  { code: 'JEP', name: 'Jersey Pound' },
  { code: 'GGP', name: 'Guernsey Pound' },
  { code: 'AOA', name: 'Angolan Kwanza' },
  { code: 'CVE', name: 'Cape Verdean Escudo' },
  { code: 'STN', name: 'São Tomé and Príncipe Dobra' },
  { code: 'ERN', name: 'Eritrean Nakfa' },
  { code: 'ETB', name: 'Ethiopian Birr' },
  { code: 'MWK', name: 'Malawian Kwacha' },
  { code: 'MZN', name: 'Mozambican Metical' },
  { code: 'NAD', name: 'Namibian Dollar' },
  { code: 'SZL', name: 'Swazi Lilangeni' },
  { code: 'TND', name: 'Tunisian Dinar' },
  { code: 'MOP', name: 'Macanese Pataca' },
  { code: 'BND', name: 'Brunei Dollar' },
  { code: 'KGS', name: 'Kyrgyzstani Som' },
  { code: 'TJS', name: 'Tajikistani Somoni' },
  { code: 'TMT', name: 'Turkmenistani Manat' },
  { code: 'UZS', name: 'Uzbekistani Som' },
  { code: 'AMD', name: 'Armenian Dram' },
  { code: 'AZN', name: 'Azerbaijani Manat' },
  { code: 'BYN', name: 'Belarusian Ruble' },
  { code: 'GEL', name: 'Georgian Lari' },
  { code: 'MDL', name: 'Moldovan Leu' },
  { code: 'YER', name: 'Yemeni Rial' },
  { code: 'IRR', name: 'Iranian Rial' },
  { code: 'IQD', name: 'Iraqi Dinar' },
  { code: 'SYP', name: 'Syrian Pound' },
  { code: 'LBP', name: 'Lebanese Pound' },
  { code: 'SDG', name: 'Sudanese Pound' },
  { code: 'SSP', name: 'South Sudanese Pound' }
].sort((a, b) => a.name.localeCompare(b.name));

const EditProfile = () => {
  // Minor Accounts (PGP) state and handlers
  const [minorAccounts, setMinorAccounts] = useState<MinorAccount[]>([]);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
    const [newAccount, setNewAccount] = useState<MinorAccount>({
      id: '',
      username: '',
      age: 13,
      relationship: '',
      timeLimit: 0,
      monitoringEnabled: false,
      chatReviewEnabled: false,
      restrictedWords: false
    });
    const handleAddAccount = () => {
      const accountWithId = { ...newAccount, id: Date.now().toString() };
      setMinorAccounts(prev => [...prev, accountWithId]);
      setIsAddingAccount(false);
      setNewAccount({
        id: '',
        username: '',
        age: 13,
        relationship: '',
        timeLimit: 0,
        monitoringEnabled: false,
        chatReviewEnabled: false,
        restrictedWords: false
      });
    };
    const handleRemoveAccount = (index: number) => {
      setMinorAccounts(prev => prev.filter((_, i) => i !== index));
    };
    const handleUpdateAccount = (id: string, updates: Partial<MinorAccount>) => {
      setMinorAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, ...updates } : acc));
    };

  // Cropper states
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropType, setCropType] = useState<'avatar' | 'cover' | ''>('');
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Bank account states
  const [bankAccount, setBankAccount] = useState<BankAccount>({
    id: '',
    user_id: '',
    bank_name: '',
    account_name: '',
    account_number: '',
    branch_name: '',
    country: '',
    is_primary: false,
    created_at: '',
    updated_at: '',
    paypal_email: '',
    state_province: ''
  });

  // Birthdays & Anniversaries event state
  const [events, setEvents] = useState<EventItem[]>([]);
  const [newEvent, setNewEvent] = useState<Omit<EventItem, 'id'>>({ title: '', date: '', type: 'birthday', relationship: '' });
  const [isAddingEvent, setIsAddingEvent] = useState(false);

  // Handler for new event form field changes
  const handleNewEventChange = (field: keyof Omit<EventItem, 'id'>, value: string) => {
    setNewEvent(prev => ({ ...prev, [field]: value }));
  };

  // Handler to add new event to events array
  const handleAddEvent = () => {
    if (!newEvent.title || !newEvent.date) return;
    setEvents(prev => [
      ...prev,
      { ...newEvent, id: Date.now().toString(), type: newEvent.type }
    ]);
    setNewEvent({ title: '', date: '', type: 'birthday', relationship: '' });
    setIsAddingEvent(false);
  };

  // Handler to remove event by id
  const handleRemoveEvent = (id: string) => {
    setEvents(prev => prev.filter(event => event.id !== id));
  };
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState({ avatar: false, cover: false });
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [formData, setFormData] = useState<UserData>({
    id: '',
    first_name: '',
    last_name: '',
    username: '',
    bio: '',
    heading: '',
    currency: 'USD',
    avatar_url: '',
    cover_photo_url: '',
    created_at: '',
    updated_at: '',
    verified: false,
    birthday: '',
    anniversary1_date: '',
    anniversary1_label: '',
    anniversary2_date: '',
    anniversary2_label: '',
    anniversary3_date: '',
    anniversary3_label: ''
  });

  // Handle birthday/anniversary changes
  const handleBirthdayChange = (birthday: string) => {
    setFormData(prev => ({ ...prev, birthday }));
  };

  const handleAnniversaryChange = (index: number, field: 'date' | 'label', value: string) => {
    const dateField = `anniversary${index + 1}_date` as keyof UserData;
    const labelField = `anniversary${index + 1}_label` as keyof UserData;
    if (field === 'date') {
      setFormData(prev => ({ ...prev, [dateField]: value }));
    } else {
      setFormData(prev => ({ ...prev, [labelField]: value }));
    }
  };

  const handleAddAnniversary = () => {
    for (let i = 1; i <= 3; i++) {
      const dateField = `anniversary${i}_date` as keyof UserData;
      if (!formData[dateField]) {
        setFormData(prev => ({ 
          ...prev, 
          [dateField]: '',
          [`anniversary${i}_label`]: ''
        }));
        break;
      }
    }
  };

  const handleRemoveAnniversary = (index: number) => {
    const dateField = `anniversary${index + 1}_date` as keyof UserData;
    const labelField = `anniversary${index + 1}_label` as keyof UserData;
    setFormData(prev => ({ 
      ...prev, 
      [dateField]: '',
      [labelField]: ''
    }));
  };

  const getAnniversaries = () => {
    const anniversaries = [];
    for (let i = 1; i <= 3; i++) {
      const date = formData[`anniversary${i}_date` as keyof UserData] as string;
      const label = formData[`anniversary${i}_label` as keyof UserData] as string;
      if (date || label) {
        anniversaries.push({ date: date || '', label: label || '' });
      }
    }
    return anniversaries;
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/auth');
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsAuthChecking(false);
      }
    };

    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!isAuthChecking && !user) {
      navigate('/auth');
      return;
    }
    if (user) {
      fetchUserData();
      fetchBankAccount();
      fetchMinorAccounts();
    }
  }, [user, navigate, isAuthChecking]);

  const fetchUserData = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setFormData({
        id: data.id,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        username: data.username || '',
        bio: data.bio || '',
        heading: data.heading || '',
        currency: data.currency || 'USD',
        avatar_url: data.avatar_url || '',
        cover_photo_url: data.cover_photo_url || '',
        created_at: data.created_at || '',
        updated_at: data.updated_at || '',
        verified: data.verified || false,
        birthday: data.birthday || '',
        anniversary1_date: data.anniversary1_date || '',
        anniversary1_label: data.anniversary1_label || '',
        anniversary2_date: data.anniversary2_date || '',
        anniversary2_label: data.anniversary2_label || '',
        anniversary3_date: data.anniversary3_date || '',
        anniversary3_label: data.anniversary3_label || '',
      });

      // Load events from user profile fields
      const loadedEvents: EventItem[] = [];
      if (data.birthday) {
        loadedEvents.push({
          id: 'birthday',
          title: 'My Birthday',
          date: data.birthday,
          type: 'birthday',
          relationship: 'Self'
        });
      }
      if (data.anniversary1_date) {
        loadedEvents.push({
          id: 'anniversary1',
          title: data.anniversary1_label || '',
          date: data.anniversary1_date,
          type: 'anniversary',
          relationship: ''
        });
      }
      if (data.anniversary2_date) {
        loadedEvents.push({
          id: 'anniversary2',
          title: data.anniversary2_label || '',
          date: data.anniversary2_date,
          type: 'anniversary',
          relationship: ''
        });
      }
      if (data.anniversary3_date) {
        loadedEvents.push({
          id: 'anniversary3',
          title: data.anniversary3_label || '',
          date: data.anniversary3_date,
          type: 'anniversary',
          relationship: ''
        });
      }
      setEvents(loadedEvents);
    }
  };

  const fetchMinorAccounts = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('pgp')
      .select('*')
      .eq('adult_user_id', user.id);
    
    if (data) {
      const loadedMinorAccounts: MinorAccount[] = data.map(pgp => ({
        id: pgp.id,
        username: pgp.minor_user_id || '', // Using minor_user_id as username for now
        age: 13, // Default age since it's not in the database
        relationship: pgp.relationship || '',
        timeLimit: pgp.time_limit || 0,
        monitoringEnabled: pgp.monitoring_enabled || false,
        chatReviewEnabled: pgp.chat_review_enabled || false,
        restrictedWords: pgp.restricted_words || false
      }));
      setMinorAccounts(loadedMinorAccounts);
    }
  };

  const fetchBankAccount = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('user_bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      setBankAccount({
        id: data.id,
        user_id: data.user_id,
        bank_name: data.bank_name || '',
        account_name: data.account_name || '',
        account_number: data.account_number || '',
        branch_name: data.branch_name || '',
        country: data.country || '',
        is_primary: data.is_primary || false,
        created_at: data.created_at || '',
        updated_at: data.updated_at || '',
        paypal_email: data.paypal_email || '',
        state_province: data.state_province || '',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Starting profile update...');
      console.log('User ID:', user?.id);
      console.log('Form Data:', formData);
      console.log('Bank Account Data:', bankAccount);
      console.log('Minor Accounts:', minorAccounts);

      // Map events to user profile fields
      let birthday = '';
      let anniversary1_date = '';
      let anniversary1_label = '';
      let anniversary2_date = '';
      let anniversary2_label = '';
      let anniversary3_date = '';
      let anniversary3_label = '';

      // Find birthday event
      const birthdayEvent = events.find(ev => ev.type === 'birthday');
      if (birthdayEvent) {
        birthday = birthdayEvent.date;
      }

      // Find up to 3 anniversary events
      const anniversaryEvents = events.filter(ev => ev.type === 'anniversary');
      if (anniversaryEvents[0]) {
        anniversary1_date = anniversaryEvents[0].date;
        anniversary1_label = anniversaryEvents[0].title;
      }
      if (anniversaryEvents[1]) {
        anniversary2_date = anniversaryEvents[1].date;
        anniversary2_label = anniversaryEvents[1].title;
      }
      if (anniversaryEvents[2]) {
        anniversary3_date = anniversaryEvents[2].date;
        anniversary3_label = anniversaryEvents[2].title;
      }

      // Update user profile
      const updates = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        username: formData.username,
        bio: formData.bio,
        heading: formData.heading,
        avatar_url: formData.avatar_url,
        cover_photo_url: formData.cover_photo_url,
        currency: formData.currency,
        birthday: birthday || null,
        anniversary1_date: anniversary1_date || null,
        anniversary1_label: anniversary1_label || null,
        anniversary2_date: anniversary2_date || null,
        anniversary2_label: anniversary2_label || null,
        anniversary3_date: anniversary3_date || null,
        anniversary3_label: anniversary3_label || null,
      };
      console.log('EditProfile update payload:', updates);
      const { error: userError, data: userData } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user?.id)
        .select();

      if (userError) {
        console.error('User update error:', userError);
        throw userError;
      }
      console.log('User profile updated successfully:', userData);

      // Update bank account details
      if (bankAccount.id) {
        console.log('Updating existing bank account:', bankAccount.id);
        const { error: bankError, data: bankData } = await supabase
          .from('user_bank_accounts')
          .update({
            bank_name: bankAccount.bank_name,
            account_name: bankAccount.account_name,
            account_number: bankAccount.account_number,
            branch_name: bankAccount.branch_name,
            country: bankAccount.country,
            is_primary: bankAccount.is_primary,
            paypal_email: bankAccount.paypal_email,
            state_province: bankAccount.state_province
          })
          .eq('id', bankAccount.id)
          .select();

        if (bankError) {
          console.error('Bank account update error:', bankError);
          throw bankError;
        }
        console.log('Bank account updated successfully:', bankData);
      } else {
        console.log('Creating new bank account...');
        const { error: bankError, data: bankData } = await supabase
          .from('user_bank_accounts')
          .insert({
            user_id: user?.id,
            bank_name: bankAccount.bank_name,
            account_name: bankAccount.account_name,
            account_number: bankAccount.account_number,
            branch_name: bankAccount.branch_name,
            country: bankAccount.country,
            is_primary: bankAccount.is_primary,
            paypal_email: bankAccount.paypal_email,
            state_province: bankAccount.state_province
          })
          .select();

        if (bankError) {
          console.error('Bank account creation error:', bankError);
          throw bankError;
        }
        console.log('Bank account created successfully:', bankData);
      }


      // Handle minor accounts (PGP)
      // First, delete existing records for this user
      const { error: deleteError } = await supabase
        .from('pgp')
        .delete()
        .eq('adult_user_id', user?.id);

      if (deleteError) {
        console.error('Error deleting existing PGP records:', deleteError);
      }

      // Then insert new records
      if (minorAccounts.length > 0) {
        // For each minor, look up their UUID in the users table
        const pgpRecords: any[] = [];
        for (const account of minorAccounts) {
          // Try to find the user by username (or email if you want)
          let minorUserId = null;
          if (account.username) {
            const { data: minorUser, error: minorUserError } = await supabase
              .from('users')
              .select('id')
              .or(`username.eq.${account.username},email.eq.${account.username}`)
              .single();
            if (minorUserError) {
              console.error(`Could not find user for minor account: ${account.username}`, minorUserError);
              toast({
                title: 'Minor user not found',
                description: `No user found for minor: ${account.username}`,
                variant: 'destructive',
              });
              continue; // Skip this minor
            }
            minorUserId = minorUser?.id;
          }
          if (!minorUserId) {
            toast({
              title: 'Minor user not found',
              description: `No user found for minor: ${account.username}`,
              variant: 'destructive',
            });
            continue;
          }
          pgpRecords.push({
            adult_user_id: user?.id,
            minor_user_id: minorUserId,
            relationship: account.relationship,
            time_limit: account.timeLimit,
            monitoring_enabled: account.monitoringEnabled,
            chat_review_enabled: account.chatReviewEnabled,
            restricted_words: account.restrictedWords,
            reels_oversight: false, // Default values for missing fields
            uploaded_reels: 0,
            series_subscriptions: 0
          });
        }

        if (pgpRecords.length > 0) {
          const { error: pgpError, data: pgpData } = await supabase
            .from('pgp')
            .insert(pgpRecords)
            .select();

          if (pgpError) {
            console.error('PGP records creation error:', pgpError);
            throw pgpError;
          }
          console.log('PGP records created successfully:', pgpData);
        }
      }

      toast({
        title: "Profile updated successfully!",
        description: "Your changes have been saved.",
      });
      
  // Removed redirect to /profile after saving for debugging
    } catch (error: any) {
      console.error('Error updating profile:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBankInputChange = (field: string, value: string) => {
    if (field === 'is_primary') {
      setBankAccount(prev => ({ ...prev, is_primary: value === 'true' }));
    } else {
      setBankAccount(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleFileUpload = async (type: 'avatar' | 'cover', file: File) => {
    if (!user) return;
    // For cover photos or avatars, open the cropper instead of direct upload
    if (type === 'cover' || type === 'avatar') {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setCropImage(e.target.result as string);
          setCropType(type);
          setCropModalOpen(true);
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    // For avatars, proceed with direct upload (or you can add cropping here too)
    try {
      setUploading(prev => ({ ...prev, [type]: true }));
      const bucket = 'posts';
      const folder = type === 'avatar' ? 'avatars/' : 'covers/';
      const mediaUrl = await uploadFile(file, bucket, folder, user.id);
      const fieldName = type === 'avatar' ? 'avatar_url' : 'cover_photo_url';
      setFormData(prev => ({ ...prev, [fieldName]: mediaUrl }));
      
      const result = await supabase
        .from('users')
        .update({ [fieldName]: mediaUrl })
        .eq('id', user.id)
        .select();
      if (result.error) throw result.error;
      
      toast({
        title: 'Success!',
        description: `${type === 'avatar' ? 'Profile picture' : 'Cover photo'} updated successfully.`,
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload file',
        variant: 'destructive',
      });
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const triggerFileUpload = (type: 'avatar' | 'cover') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileUpload(type, file);
      }
    };
    input.click();
  };

  const onCropComplete = (_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not create canvas context');
    }

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        }
      }, 'image/jpeg', 0.8);
    });
  };

  const handleCropSave = async () => {
    if (!cropImage || !croppedAreaPixels || !cropType || !user) return;
    try {
      setUploading(prev => ({ ...prev, [cropType]: true }));
      const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], `${cropType}.jpg`, { type: 'image/jpeg' });
      const bucket = 'posts';
      const folder = cropType === 'avatar' ? 'avatars/' : 'covers/';
      const fieldName = cropType === 'avatar' ? 'avatar_url' : 'cover_photo_url';
      const mediaUrl = await uploadFile(croppedFile, bucket, folder, user.id);
      setFormData(prev => ({ ...prev, [fieldName]: mediaUrl }));
      const result = await supabase
        .from('users')
        .update({ [fieldName]: mediaUrl })
        .eq('id', user.id)
        .select();
      if (result.error) throw result.error;
      toast({
        title: 'Success!',
        description: `${cropType === 'avatar' ? 'Profile picture' : 'Cover photo'} updated successfully.`,
      });
    } catch (error: any) {
      console.error('Error updating image:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update image',
        variant: 'destructive',
      });
    } finally {
      setUploading(prev => ({ ...prev, [cropType!]: false }));
      setCropModalOpen(false);
      setCropImage(null);
  setCropType('');
    }
  };

  if (isAuthChecking) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-500 dark:text-gray-400">Loading...</div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-500 dark:text-gray-400">Please log in to edit your profile</div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/profile')}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Profile</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Card */}
          <Card className="p-6 dark:bg-[#161616]">
            {/* Cover Photo Section */}
            <div className="relative">
              <div 
                className="h-48 bg-gradient-to-r from-purple-600 via-yellow-400 to-purple-600 relative rounded-lg overflow-hidden"
                style={{
                  backgroundImage: formData.cover_photo_url ? `url(${formData.cover_photo_url})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              >
                <div className="absolute inset-0 bg-black/20"></div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white z-10"
                  onClick={() => triggerFileUpload('cover')}
                  disabled={uploading.cover}
                >
                  {uploading.cover ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
                {!formData.cover_photo_url && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white/80 text-center">
                      <Camera className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Add cover photo</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Avatar Section */}
            <div className="text-center relative -mt-20 mb-4">
              <div className="relative inline-block">
                <Avatar className="h-32 w-32 border-4 border-white shadow-lg">
                  <AvatarImage src={formData.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-2xl">
                    {formData.first_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute bottom-2 right-2 bg-white/90 hover:bg-white shadow-md rounded-full h-8 w-8 p-0"
                  onClick={() => triggerFileUpload('avatar')}
                  disabled={uploading.avatar}
                >
                  {uploading.avatar ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Name
                </label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  className="dark:bg-[#161616] dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Name
                </label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  className="dark:bg-[#161616] dark:border-gray-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <Input
                value={formData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="dark:bg-[#161616] dark:border-gray-600"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Header (Title/Designation)
              </label>
              <Input
                value={formData.heading}
                onChange={(e) => handleInputChange('heading', e.target.value)}
                placeholder="e.g., Software Engineer, Designer, CEO"
                className="dark:bg-[#161616] dark:border-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Bio
              </label>
              <Textarea
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Tell us about yourself..."
                className="dark:bg-[#161616] dark:border-gray-600"
                rows={4}
              />
            </div>
          </Card>

          {/* Birthdays & Anniversaries Card */}
          <BirthdaysAnniversariesCard
            events={events}
            isAddingEvent={isAddingEvent}
            newEvent={newEvent}
            onAddEvent={handleAddEvent}
            onRemoveEvent={handleRemoveEvent}
            onNewEventChange={handleNewEventChange}
            setIsAddingEvent={setIsAddingEvent}
          />

          <ParentalGuidanceCard
            minorAccounts={minorAccounts}
            isAddingAccount={isAddingAccount}
            newAccount={newAccount}
            onAddAccount={handleAddAccount}
            onRemoveAccount={handleRemoveAccount}
            onUpdateAccount={handleUpdateAccount}
            onSetIsAddingAccount={setIsAddingAccount}
            onSetNewAccount={setNewAccount}
          />

          {/* Organizations management */}
          <div>
            <OrganizationsTab />
          </div>

          {/* Bank Account Card */}
          <Card className="p-6 dark:bg-[#161616]">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Bank Account Details</h2>
            <div className="space-y-4">
              {/* Country Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Country
                </label>
                <Select
                  value={bankAccount.country}
                  onValueChange={(value) => {
                    handleBankInputChange('country', value);
                    // Reset bank and state when country changes
                    handleBankInputChange('bank_name', '');
                    handleBankInputChange('state_province', '');
                  }}
                >
                  <SelectTrigger className="dark:bg-[#161616] dark:border-gray-600">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* State/Province Selection */}
              {bankAccount.country && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    State/Province
                  </label>
                  <Select
                    value={bankAccount.state_province}
                    onValueChange={(value) => handleBankInputChange('state_province', value)}
                  >
                    <SelectTrigger className="dark:bg-[#161616] dark:border-gray-600">
                      <SelectValue placeholder="Select state/province" />
                    </SelectTrigger>
                    <SelectContent>
                      {statesByCountry[bankAccount.country] ? (
                        statesByCountry[bankAccount.country].map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="other" disabled>
                          No states/provinces available for this country
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Bank Selection */}
              {bankAccount.country && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bank
                  </label>
                  <Select
                    value={bankAccount.bank_name}
                    onValueChange={(value) => handleBankInputChange('bank_name', value)}
                  >
                    <SelectTrigger className="dark:bg-[#161616] dark:border-gray-600">
                      <SelectValue placeholder="Select bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banksByCountry[bankAccount.country] ? (
                        banksByCountry[bankAccount.country].map((bank) => (
                          <SelectItem key={bank.code} value={bank.name}>
                            {bank.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="other" disabled>
                          No banks available for this country
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Account Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account Number
                </label>
                <Input
                  value={bankAccount.account_number}
                  onChange={(e) => handleBankInputChange('account_number', e.target.value)}
                  className="dark:bg-[#161616] dark:border-gray-600"
                />
              </div>

              {/* Account Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account Name
                </label>
                <Input
                  value={bankAccount.account_name}
                  onChange={(e) => handleBankInputChange('account_name', e.target.value)}
                  className="dark:bg-[#161616] dark:border-gray-600"
                />
              </div>

              {/* Branch Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Branch Name
                </label>
                <Input
                  value={bankAccount.branch_name || ''}
                  onChange={(e) => handleBankInputChange('branch_name', e.target.value)}
                  className="dark:bg-[#161616] dark:border-gray-600"
                />
              </div>

              {/* PayPal Section */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Receive payments via PayPal
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Enable this to receive payments through PayPal
                    </p>
                  </div>
                  <Switch
                    checked={bankAccount.is_primary}
                    onCheckedChange={(checked) => {
                      setBankAccount(prev => ({ ...prev, is_primary: checked }));
                      if (!checked) {
                        setBankAccount(prev => ({ ...prev, paypal_email: '' }));
                      }
                    }}
                  />
                </div>

                {bankAccount.is_primary && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      PayPal Email
                    </label>
                    <Input
                      value={bankAccount.paypal_email}
                      onChange={(e) => handleBankInputChange('paypal_email', e.target.value)}
                      className="dark:bg-[#161616] dark:border-gray-600"
                      type="email"
                      placeholder="your.paypal@email.com"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Currency Card */}
          <Card className="p-6 dark:bg-[#161616]">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Preferred Currency</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Your Base Currency
                </label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => handleInputChange('currency', value)}
                >
                  <SelectTrigger className="dark:bg-[#161616] dark:border-gray-600">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {Array.from(new Set(CURRENCIES.map(c => c.code)))
                      .map(code => {
                        const currency = CURRENCIES.find(c => c.code === code);
                        return currency ? (
                          <SelectItem key={`currency-${code}`} value={code}>
                            {code} - {currency.name}
                          </SelectItem>
                        ) : null;
                      })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            disabled={loading}
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>

        {/* Improved Cropper Modal */}
        {cropModalOpen && cropImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[90vw] max-w-2xl">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
                Adjust Your {cropType === 'avatar' ? 'Profile Picture' : 'Cover Photo'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Move and zoom to select the area you want to show in your {cropType === 'avatar' ? 'profile picture' : 'cover photo'}.
              </p>
              <div className="relative w-full h-80 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                <Cropper
                  image={cropImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={cropType === 'avatar' ? 1 : 3}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  showGrid={false}
                  style={{
                    containerStyle: {
                      width: '100%',
                      height: '100%',
                      position: 'relative'
                    }
                  }}
                />
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Zoom: {Math.round(zoom * 100)}%
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <Button 
                  onClick={() => {
                    setCropModalOpen(false);
                    setCropImage(null);
                    setCropType('');
                  }} 
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCropSave}
                  disabled={uploading[cropType === 'avatar' ? 'avatar' : 'cover']}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {uploading[cropType === 'avatar' ? 'avatar' : 'cover'] ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    `Save ${cropType === 'avatar' ? 'Profile Picture' : 'Cover Photo'}`
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default EditProfile;