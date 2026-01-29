
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PollOption {
  id: string;
  text: string;
  votes: number;
  media_url?: string | null;
}

interface PollCardProps {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  expiresAt: string;
  hasVoted?: boolean;
  userVote?: string;
  onVote?: (optionId: string) => void;
}

export const PollCard: React.FC<PollCardProps> = ({
  id,
  question,
  options,
  totalVotes,
  expiresAt,
  hasVoted = false,
  userVote,
  onVote
}) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(userVote || null);
  const [voted, setVoted] = useState(hasVoted);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [pollInsights, setPollInsights] = useState<{[optionId: string]: any[]}>({});

  const handleVote = (optionId: string) => {
    if (voted || isExpired) return;
    
    setSelectedOption(optionId);
    setVoted(true);
    onVote?.(optionId);
  };

  const getPercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const isExpired = new Date(expiresAt) < new Date();
  const timeRemaining = new Date(expiresAt).getTime() - new Date().getTime();
  const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));
  const daysRemaining = Math.floor(hoursRemaining / 24);

  const formatTimeRemaining = () => {
    if (isExpired) return 'Poll ended';
    if (daysRemaining > 0) return `${daysRemaining} day${daysRemaining > 1 ? 's' : ''} left`;
    if (hoursRemaining > 0) return `${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''} left`;
    return 'Less than 1 hour left';
  };

  const fetchPollInsights = async () => {
    try {
      const { data: votes, error } = await supabase
        .from('poll_votes')
        .select(`
          *,
          users:user_id (
            avatar_url,
            first_name,
            last_name,
            username
          )
        `)
        .eq('poll_id', id);
      
      if (error) {
        console.error('Error fetching poll insights:', error);
        setPollInsights({});
      } else {
        // Group votes by option for insights
        const insights: {[optionId: string]: any[]} = {};
        options.forEach(option => {
          insights[option.id] = [];
        });
        
        (votes || []).forEach(vote => {
          if (vote.option_id && insights[vote.option_id]) {
            insights[vote.option_id].push(vote);
          }
        });
        
        setPollInsights(insights);
      }
      setShowInsightsModal(true);
    } catch (err) {
      console.error('Failed to fetch poll insights:', err);
      setPollInsights({});
      setShowInsightsModal(true);
    }
  };

  return (
    <Card className="p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
      {/* Poll Question */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {question}
        </h3>
        
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
          <Clock className="h-4 w-4 mr-2" />
          <span className={`font-medium ${isExpired ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
            {formatTimeRemaining()}
          </span>
        </div>
      </div>

      {/* Poll Options */}
      <div className="space-y-4">
        {options.map((option) => {
          const percentage = getPercentage(option.votes);
          const isSelected = selectedOption === option.id;
          const showResults = voted || isExpired;

          return (
            <div key={option.id} className="relative flex items-center gap-3">
              {option.media_url && (
                <img
                  src={option.media_url}
                  alt="Option media"
                  className="w-10 h-10 object-contain rounded border cursor-pointer"
                  onClick={() => setModalImageUrl(option.media_url || null)}
                />
              )}
              {showResults ? (
                <div className="flex-1 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className={`text-base font-medium ${
                      isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {option.text}
                    </span>
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {percentage}% ({option.votes} votes)
                    </span>
                  </div>
                  <div className="relative">
                    <Progress 
                      value={percentage} 
                      className={`h-3 ${isSelected ? 'bg-purple-100 dark:bg-purple-900' : 'bg-gray-200 dark:bg-gray-700'}`}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-purple-500 rounded-full opacity-20 animate-pulse"></div>
                    )}
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full text-left justify-start p-4 h-auto text-base hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200"
                  onClick={() => handleVote(option.id)}
                  disabled={isExpired}
                >
                  <div className="w-4 h-4 rounded-full border-2 border-gray-400 mr-3 flex-shrink-0"></div>
                  {option.text}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Poll Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <button
            className="text-gray-500 dark:text-gray-400 font-semibold hover:underline focus:outline-none"
            onClick={fetchPollInsights}
            type="button"
          >
            <span className="font-semibold text-gray-700 dark:text-gray-300">{totalVotes}</span> total vote{totalVotes !== 1 ? 's' : ''}
          </button>
          {voted && !isExpired && (
            <span className="flex items-center text-purple-600 dark:text-purple-400 font-medium">
              <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
              You voted
            </span>
          )}
          {isExpired && (
            <span className="text-red-500 font-medium">
              Poll closed
            </span>
          )}
        </div>
      </div>

      {/* Poll Insights Modal */}
      {showInsightsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowInsightsModal(false)}>
          <div className="relative max-w-md w-full bg-white dark:bg-gray-900 rounded-lg shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <button
              className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-800 rounded-full p-2 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors z-10"
              onClick={() => setShowInsightsModal(false)}
              aria-label="Close"
            >
              &times;
            </button>
            
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Poll Insights</h3>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {options.map((option) => (
                <div key={option.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                      {option.text}
                    </h4>
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {pollInsights[option.id]?.length || 0} votes
                    </span>
                  </div>
                  {pollInsights[option.id]?.length > 0 ? (
                    <ul className="space-y-2">
                      {pollInsights[option.id].map((vote, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <img
                            src={vote.users?.avatar_url || '/placeholder.svg'}
                            alt="avatar"
                            className="w-6 h-6 rounded-full border"
                          />
                          <div className="text-sm">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {vote.users?.first_name || ''} {vote.users?.last_name || ''}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                              @{vote.users?.username}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-gray-500 dark:text-gray-400">No votes for this option</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Image Modal */}
      {modalImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setModalImageUrl(null)}
        >
          <div className="relative max-w-2xl w-full flex flex-col items-center">
            <img
              src={modalImageUrl}
              alt="Poll option full view"
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl select-none"
              onClick={e => e.stopPropagation()}
              draggable={false}
              loading="lazy"
            />
            <button
              className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors"
              onClick={e => {e.stopPropagation(); setModalImageUrl(null);}}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};
