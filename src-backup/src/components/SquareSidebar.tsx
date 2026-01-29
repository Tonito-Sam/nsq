
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Calendar, Users, TrendingUp } from 'lucide-react';

export const SquareSidebar = () => {
  const nearbyEvents = [
    {
      id: 1,
      title: 'Tech Meetup',
      date: 'Dec 15',
      location: 'Downtown',
      attendees: 45
    },
    {
      id: 2,
      title: 'Art Exhibition',
      date: 'Dec 18',
      location: 'Gallery District',
      attendees: 28
    }
  ];

  const popularPlaces = [
    { name: 'Coffee Corner', category: 'Cafe', rating: 4.8 },
    { name: 'Tech Hub', category: 'Coworking', rating: 4.6 },
    { name: 'City Park', category: 'Recreation', rating: 4.9 }
  ];

  return (
    <div className="space-y-6">
      {/* Local Events */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Nearby Events
          </h3>
          
          <div className="space-y-3">
            {nearbyEvents.map((event) => (
              <div key={event.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {event.title}
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {event.date}
                  </Badge>
                </div>
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <div className="flex items-center">
                    <MapPin className="h-3 w-3 mr-1" />
                    {event.location}
                  </div>
                  <div className="flex items-center">
                    <Users className="h-3 w-3 mr-1" />
                    {event.attendees}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <Button 
            variant="ghost" 
            className="w-full mt-4 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            View All Events
          </Button>
        </div>
      </Card>

      {/* Popular Places */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Popular Places
          </h3>
          
          <div className="space-y-3">
            {popularPlaces.map((place, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {place.name}
                  </p>
                  <p className="text-xs text-gray-500">{place.category}</p>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-yellow-500">★</span>
                  <span className="text-xs text-gray-500">{place.rating}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Location Stats */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-purple-500" />
            Your Area
          </h3>
          
          <div className="space-y-4">
            <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                2.3k
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Active Users Nearby
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  15
                </div>
                <div className="text-xs text-gray-500">
                  Check-ins Today
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  8
                </div>
                <div className="text-xs text-gray-500">
                  New Places
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Quick Actions
          </h3>
          
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" size="sm">
              <MapPin className="h-4 w-4 mr-2" />
              Check In
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Create Event
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Find Friends
            </Button>
          </div>
        </div>
      </Card>

      {/* Weather Widget */}
      <Card className="dark:bg-[#161616] border-gray-200 dark:border-gray-700">
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Local Weather
          </h3>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
              72°F
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Partly Cloudy
            </div>
            <div className="text-xs text-gray-500">
              Perfect weather for outdoor events!
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
