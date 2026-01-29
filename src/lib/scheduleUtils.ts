export const getCategoryColor = (category?: string) => {
  switch ((category || '').toLowerCase()) {
    case 'podcast': return 'bg-purple-100 border-purple-600';
    case 'sports': return 'bg-green-100 border-green-600';
    case 'music': return 'bg-yellow-100 border-yellow-600';
    case 'talk': return 'bg-blue-100 border-blue-600';
    case 'sermons': return 'bg-indigo-100 border-indigo-600';
    case 'education': return 'bg-teal-100 border-teal-600';
    case 'inspiration': return 'bg-pink-100 border-pink-600';
    case 'documentary': return 'bg-gray-100 border-gray-700';
    default: return 'bg-gray-100 border-gray-400';
  }
};

export default getCategoryColor;
