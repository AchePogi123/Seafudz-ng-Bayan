import React from 'react'

interface CategoryTabsProps {
  selectedCategory: string
  setSelectedCategory: (category: string) => void
  categories?: string[]
}

const DEFAULT_CATEGORIES = ['All Menu', 'Seafood', 'Shrimp', 'Crab', 'Fish', 'Squid', 'Soup', 'Sides', 'Drinks', 'Desserts']

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  selectedCategory,
  setSelectedCategory,
  categories = DEFAULT_CATEGORIES,
}) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory touch-pan-x">
      {categories.map((category) => {
        const isActive = selectedCategory === category
        return (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-150 whitespace-nowrap cursor-pointer snap-start flex-shrink-0 ${
              isActive
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'bg-white border border-neutral-200/80 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            {category}
          </button>
        )
      })}
    </div>
  )
}
