import React from 'react';
import CategoryFilter from './CategoryFilter';

interface StudioHeaderProps {
  categories: { name: string; icon: React.ElementType }[];
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  navigate: (path: string) => void;
}

const StudioHeader: React.FC<StudioHeaderProps> = ({ categories, selectedCategory, setSelectedCategory, navigate }) => (
  <header
    className="fixed top-0 left-0 right-0 z-40 px-2 py-2 sm:px-4 sm:py-3 pointer-events-auto"
    style={{ background: 'none', border: 'none', boxShadow: 'none' }}
  >
    <div className="flex items-center max-w-7xl mx-auto px-0 sm:px-0">
      {/* Favicon as Home button */}
      <button 
        onClick={() => navigate('/')} 
        className="flex items-center gap-2 text-foreground hover:text-primary transition-colors" 
        style={{ minWidth: 40 }}
        aria-label="Home"
      >
        <img src="/favicon.ico" alt="Home" className="h-8 w-8 rounded-lg shadow-sm" />
      </button>
      {/* Categories */}
      <div className="relative flex-1 flex justify-center items-center">
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />
        {/* Right arrow for horizontal scroll, only visible on mobile */}
        <button
          type="button"
          className="ml-2 bg-white/80 dark:bg-[#232946]/80 rounded-full p-1 shadow border border-gray-200 dark:border-gray-700 flex items-center justify-center z-10 hover:bg-purple-100 dark:hover:bg-[#312e81] transition sm:hidden"
          style={{ width: 24, height: 24 }}
          aria-label="Scroll right"
          onClick={() => {
            const container = document.getElementById('category-scroll-container');
            if (container) {
              container.scrollBy({ left: 80, behavior: 'smooth' });
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 5L12 10L7 15" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  </header>
);

export default StudioHeader;
