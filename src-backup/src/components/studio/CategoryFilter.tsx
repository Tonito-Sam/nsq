import React from 'react';

interface CategoryFilterProps {
  categories: { name: string; icon: React.ElementType }[];
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({ categories, selectedCategory, setSelectedCategory }) => (
  <div className="flex items-center gap-3 sm:gap-3 overflow-x-auto px-0 sm:px-0 no-scrollbar py-1 ml-4 sm:ml-8" id="category-scroll-container"
    style={{
      WebkitOverflowScrolling: 'touch',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      overscrollBehaviorX: 'contain',
      scrollSnapType: 'x mandatory',
      maxWidth: '100vw',
    }}
  >
    {categories.map((category) => {
      const IconComponent = category.icon;
      const isActive = selectedCategory === category.name;
      return (
        <button
          key={category.name}
          className={`flex flex-col items-center gap-1 px-2 py-1 rounded-xl transition-colors whitespace-nowrap min-w-[40px] sm:min-w-0 focus:outline-none focus:ring-2 focus:ring-purple-400 ${isActive ? 'bg-purple-600 text-white shadow-lg' : 'bg-white/70 dark:bg-[#232946]/70 text-black dark:text-white hover:bg-purple-100 dark:hover:bg-[#312e81]'}`}
          style={{ minWidth: 40, border: 'none', scrollSnapAlign: 'start' }}
          onClick={() => setSelectedCategory(category.name)}
        >
          <IconComponent className="h-5 w-5 sm:h-4 sm:w-4" />
          <span className="text-[9px] font-medium mt-0.5 hidden sm:inline">{category.name}</span>
        </button>
      );
    })}
  </div>
);

export default CategoryFilter;
