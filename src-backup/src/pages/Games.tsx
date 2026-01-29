
import React from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gamepad2, Trophy, Users, Clock } from 'lucide-react';

const Games = () => {
  const games = [
    {
      id: 1,
      title: 'Quiz Master',
      description: 'Test your knowledge with daily quizzes',
      players: '1.2k',
      image: '/placeholder.svg',
      category: 'Trivia'
    },
    {
      id: 2,
      title: 'Word Chain',
      description: 'Create word chains with friends',
      players: '850',
      image: '/placeholder.svg',
      category: 'Word Game'
    },
    {
      id: 3,
      title: 'Photo Challenge',
      description: 'Daily photo challenges and contests',
      players: '2.1k',
      image: '/placeholder.svg',
      category: 'Photography'
    },
    {
      id: 4,
      title: 'Prediction Game',
      description: 'Predict outcomes and earn points',
      players: '976',
      image: '/placeholder.svg',
      category: 'Prediction'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1a1a1a]">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Games</h1>
          <p className="text-gray-600 dark:text-gray-400">Play games with friends and challenge yourself</p>
        </div>

        {/* Featured Game */}
        <Card className="dark:bg-[#161616] mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">Daily Challenge</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Complete today's challenge and earn rewards!
                </p>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    23h left
                  </div>
                  <div className="flex items-center">
                    <Trophy className="h-4 w-4 mr-1" />
                    500 points
                  </div>
                </div>
              </div>
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
                Play Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Games Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {games.map((game) => (
            <Card key={game.id} className="dark:bg-[#161616] hover:shadow-lg transition-shadow">
              <CardHeader className="p-0">
                <div className="h-48 bg-gradient-to-br from-purple-400 to-pink-400 rounded-t-lg flex items-center justify-center">
                  <Gamepad2 className="h-16 w-16 text-white opacity-80" />
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="mb-2">
                  <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                    {game.category}
                  </span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{game.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {game.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-500">
                    <Users className="h-4 w-4 mr-1" />
                    {game.players} players
                  </div>
                  <Button variant="outline" size="sm">
                    Play
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Leaderboard */}
        <Card className="dark:bg-[#161616] mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Weekly Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((rank) => (
                <div key={rank} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      rank === 1 ? 'bg-yellow-500 text-white' :
                      rank === 2 ? 'bg-gray-400 text-white' :
                      rank === 3 ? 'bg-orange-500 text-white' :
                      'bg-gray-200 dark:bg-gray-700'
                    }`}>
                      {rank}
                    </div>
                    <span className="font-medium">Player {rank}</span>
                  </div>
                  <span className="text-sm text-gray-500">{1000 - (rank * 50)} points</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Games;
