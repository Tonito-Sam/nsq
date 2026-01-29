import React from 'react';
import { Heart, HandHeart, Brain, MessageSquare, Music, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

const reactionTypes = [
	{ type: 'like', icon: Heart, label: 'Like', color: 'text-red-500' },
	{ type: 'applause', icon: HandHeart, label: 'Well Done', color: 'text-green-500' },
	{ type: 'thinking', icon: Brain, label: 'Thoughtful', color: 'text-purple-500' },
	{ type: 'speak-up', icon: MessageSquare, label: 'Louder', color: 'text-blue-500' },
	{ type: 'melody', icon: Music, label: 'Sweet Vibes', color: 'text-pink-500' },
	{ type: 'shut-up', icon: VolumeX, label: 'Shut Up', color: 'text-gray-500' }
];

interface PostReactionsProps {
	selectedReaction: string | null;
	currentLikes: number;
	showReactions: boolean;
	onToggleReactions: () => void;
	onReaction: (reactionType: string) => void;
}

export const PostReactions: React.FC<PostReactionsProps> = ({
	selectedReaction,
	currentLikes,
	showReactions,
	onToggleReactions,
	onReaction
}) => {
	return (
		<div className="relative">
			<Button
				variant="ghost"
				size="sm"
				onClick={onToggleReactions}
				className={`flex items-center space-x-1 px-1.5 py-0.5 md:space-x-1.5 md:px-2 md:py-1 rounded-lg transition-all duration-200 hover:scale-105 ${
					selectedReaction ? 'text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20' : 'text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
				}`}>
				{selectedReaction ? (
					<>
						{React.createElement(reactionTypes.find(r => r.type === selectedReaction)?.icon || Heart, {
							className: `h-3.5 w-3.5 md:h-4 md:w-4 ${reactionTypes.find(r => r.type === selectedReaction)?.color || 'text-red-500'} fill-current`
						})}
						<span className="text-xs md:text-sm font-medium">{currentLikes}</span>
					</>
				) : (
					<>
						<Heart className="h-3.5 w-3.5 md:h-4 md:w-4" />
						<span className="text-xs md:text-sm font-medium">{currentLikes}</span>
					</>
				)}
			</Button>

			{/* Reaction Options */}
			{showReactions && (
				<div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex space-x-1 z-20">
					{reactionTypes.map((reaction) => {
						const IconComponent = reaction.icon;
						return (
							<button
								key={reaction.type}
								onClick={() => onReaction(reaction.type)}
								className={`p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${reaction.color} hover:scale-110 transform`}
								title={reaction.label}
							>
								<IconComponent className="h-4 w-4" />
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
};
