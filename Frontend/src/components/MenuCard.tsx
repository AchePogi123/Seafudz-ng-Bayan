import React from 'react'

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  image: string
}

// Helper to reliably resolve asset image URLs across Vite bundling
const getMenuImageUrl = (filename: string) => {
  return new URL(`../assets/menu/${filename}`, import.meta.url).href
}

export const CLIENT_CATEGORIES = [
  'All Menu',
  'Seafoods',
  'Value Meals',
  'Siomai',
  'Add Ons',
  'Shake & Lemonade',
  'Desserts',
  'Drinks'
]

export const CLIENT_MENU_ITEMS: MenuItem[] = [
  // 🦐 SEAFOODS / ALACARTE / BOWLS / TRAYS
  {
    id: 'all-shrimp-alacarte-199',
    name: 'All Shrimp Alacarte',
    description: 'Fresh, succulent whole shrimps sautéed in signature savory cajun butter spices.',
    price: 199,
    category: 'Seafoods',
    image: getMenuImageUrl('ALL SHRIMP_Alacarte_199 pesos.jpg'),
  },
  {
    id: 'all-shrimp-bowl-699',
    name: 'All Shrimp Bowl',
    description: 'Hearty sharing bowl packed with garlic butter shrimps and rich sauce.',
    price: 699,
    category: 'Seafoods',
    image: getMenuImageUrl('ALL SHRIMP_Bowl_699 pesos.jpg'),
  },
  {
    id: 'all-shrimp-tray-1099',
    name: 'All Shrimp Party Tray',
    description: 'Generous fiesta platter of premium shrimps for family gatherings and celebrations.',
    price: 1099,
    category: 'Seafoods',
    image: getMenuImageUrl('ALL SHRIMP_Tray_1099 pesos.jpg'),
  },
  {
    id: 'mixed-seafoods-alacarte-99',
    name: 'Mixed Seafoods Alacarte (Mini)',
    description: 'Delicious mini medley of fresh crab, shrimp, mussels, and sweet corn.',
    price: 99,
    category: 'Seafoods',
    image: getMenuImageUrl('Mixedseafoods_Mixed Seafoods Alacarte_99 pesos.jpg'),
  },
  {
    id: 'mixed-seafoods-tub-189',
    name: 'Mixed Seafoods Tub',
    description: 'Generous tub loaded with fresh mixed seafood in special butter garlic sauce.',
    price: 189,
    category: 'Seafoods',
    image: getMenuImageUrl('Mixedseafoods_Mixed Seafoods Alacarte_Tub_189 pesos.jpg'),
  },
  {
    id: 'mixed-seafoods-bowl-699',
    name: 'Mixed Seafoods Bowl',
    description: 'Feast bowl overflowing with assorted crabs, shrimp, corn, and shellfish.',
    price: 699,
    category: 'Seafoods',
    image: getMenuImageUrl('Mixedseafoods_Mixed Seafoods Alacarte_Bowl_699 pesos.jpg'),
  },
  {
    id: 'mixed-seafoods-tray-1199',
    name: 'Mixed Seafoods Fiesta Tray',
    description: 'The ultimate signature seafood fiesta tray with crabs, shrimps, and mussels.',
    price: 1199,
    category: 'Seafoods',
    image: getMenuImageUrl('Mixedseafoods_Mixed Seafoods Alacarte_Tray_1199 pesos.jpg'),
  },

  // 🍚 VALUE MEALS
  {
    id: 'chicken-pastil-35',
    name: 'Chicken Pastil',
    description: 'Savory shredded native chicken pastil served over steaming fragrant white rice.',
    price: 35,
    category: 'Value Meals',
    image: getMenuImageUrl('Chicken-Pastil_VALUE MEALS_35 pesos.jpg'),
  },
  {
    id: 'fried-noodles-35',
    name: 'Fried Noodles',
    description: 'Stir-fried savory street noodles tossed with crisp vegetables and savory sauce.',
    price: 35,
    category: 'Value Meals',
    image: getMenuImageUrl('Fried_Noodles_VALUE MEALS_35 pesos.jpg'),
  },
  {
    id: 'chao-fan-35',
    name: 'Chao Fan',
    description: 'Wok-tossed hearty fried rice with seasoned meat bits, scrambled egg, and aromatics.',
    price: 35,
    category: 'Value Meals',
    image: getMenuImageUrl('chao_fan_VALUE MEALS_35 pesos.jpg'),
  },

  // 🥟 SIOMAI
  {
    id: 'pork-siomai-5',
    name: 'Pork Siomai',
    description: 'Classic steamed pork dumpling served with chili garlic sauce and calamansi.',
    price: 5,
    category: 'Siomai',
    image: getMenuImageUrl('pork_siomai_SIOMAI_5 pesos.jpg'),
  },
  {
    id: 'beef-siomai-5',
    name: 'Beef Siomai',
    description: 'Juicy beef dumplings bursting with rich savory garlic flavors.',
    price: 5,
    category: 'Siomai',
    image: getMenuImageUrl('beef_siomai_SIOMAI_5 pesos.jpg'),
  },
  {
    id: 'chicken-siomai-5',
    name: 'Chicken Siomai',
    description: 'Tender chicken dumpling packed with seasoned aromatics.',
    price: 5,
    category: 'Siomai',
    image: getMenuImageUrl('chicken_siomai_SIOMAI__5 pesos.jpg'),
  },
  {
    id: 'sharksfin-siomai-5',
    name: 'Sharksfin Siomai',
    description: 'Special dim sum dumpling with crisp vegetables and savory filling.',
    price: 5,
    category: 'Siomai',
    image: getMenuImageUrl('sharksfin_siomai_SIOMAI_5 pesos.jpg'),
  },
  {
    id: 'japanese-siomai-6',
    name: 'Japanese Siomai',
    description: 'Steamed dumpling wrapped in Japanese nori seaweed with crabstick topping.',
    price: 6,
    category: 'Siomai',
    image: getMenuImageUrl('japanese_siomai_SIOMAI_6 pesos.jpg'),
  },

  // 🌽 SEAFOODS ADD ONS
  {
    id: 'corn-addon-20',
    name: 'Sweet Corn',
    description: 'Sweet corn cob segments simmered in rich seafood garlic butter sauce.',
    price: 20,
    category: 'Add Ons',
    image: getMenuImageUrl('Corn_SEAFOODS ADD ONS_20 pesos.jpeg'),
  },
  {
    id: 'rice-cup-20',
    name: 'Extra Steamed Rice (1 Cup)',
    description: 'Freshly steamed white fragrant rice.',
    price: 20,
    category: 'Add Ons',
    image: getMenuImageUrl('Rice_one cup_SEAFOODS ADD ONS_20 pesos.jpg'),
  },
  {
    id: 'shrimp-regular-addon-20',
    name: 'Shrimp Regular Add-On',
    description: 'Extra fresh regular shrimp cooked in signature Cajun garlic blend.',
    price: 20,
    category: 'Add Ons',
    image: getMenuImageUrl('Shrimp Regular_SEAFOODS ADD ONS_20 pesos.jpg'),
  },
  {
    id: 'shrimp-jumbo-addon-30',
    name: 'Shrimp Jumbo Add-On',
    description: 'Extra jumbo-sized succulent shrimp infused with savory spices.',
    price: 30,
    category: 'Add Ons',
    image: getMenuImageUrl('Shrimp Jumbo_SEAFOODS ADD ONS 30 pesos.jpg'),
  },
  {
    id: 'tahong-addon-30',
    name: 'Tahong (Mussels) Add-On',
    description: 'Fresh green mussels tossed in butter garlic seasoning.',
    price: 30,
    category: 'Add Ons',
    image: getMenuImageUrl('Tahong_SEAFOODS ADD ONS_30 pesos.jpg'),
  },
  {
    id: 'sausage-addon-50',
    name: 'Sliced Sausage',
    description: 'Smoked sausage rounds infused with rich seafood boil flavors.',
    price: 50,
    category: 'Add Ons',
    image: getMenuImageUrl('sausage_SEAFOODS ADD ONS_50 pesos.jpeg'),
  },
  {
    id: 'special-sauce-addon-30',
    name: 'Special Cajun Seafood Sauce',
    description: 'Signature secret spicy garlic butter seafood sauce.',
    price: 30,
    category: 'Add Ons',
    image: getMenuImageUrl('specailsauce_SEAFOODS ADD ONS_30 pesos.jpg'),
  },

  // 🍋 SHAKE & LEMONADE
  {
    id: 'lemonade-small-40',
    name: 'Fresh Lemonade (Small)',
    description: 'Hand-pressed iced sweet and tangy fresh lemon-calamansi cooler.',
    price: 40,
    category: 'Shake & Lemonade',
    image: getMenuImageUrl('Lemonade_small_SHAKE&LEMONADE_40 pesos.jpg'),
  },
  {
    id: 'lemonade-big-50',
    name: 'Fresh Lemonade (Big)',
    description: 'Large refreshing cup of freshly squeezed lemonade on ice.',
    price: 50,
    category: 'Shake & Lemonade',
    image: getMenuImageUrl('Lemonade_big_SHAKE&LEMONADE_50 pesos.jpg'),
  },
  {
    id: 'cucumber-lemonade-small-40',
    name: 'Cucumber Lemonade (Small)',
    description: 'Crisp cucumber juice blended with fresh lemon and crushed ice.',
    price: 40,
    category: 'Shake & Lemonade',
    image: getMenuImageUrl('cucumberlemonade_small_SHAKE&LEMONADE_40 pesos.jpeg'),
  },
  {
    id: 'cucumber-lemonade-big-50',
    name: 'Cucumber Lemonade (Big)',
    description: 'Large cup of cooling iced cucumber lemonade.',
    price: 50,
    category: 'Shake & Lemonade',
    image: getMenuImageUrl('cucumberLemonade big_SHAKE&LEMONADE_50 pesos.jpg'),
  },
  {
    id: 'shake-small-40',
    name: 'Fruit Shake (Small)',
    description: 'Smooth, creamy ice-blended refreshing fruit shake.',
    price: 40,
    category: 'Shake & Lemonade',
    image: getMenuImageUrl('snakes_small_SHAKE&LEMONADE_40 peso.jpg'),
  },
  {
    id: 'shake-big-50',
    name: 'Fruit Shake (Big)',
    description: 'Large ice-blended refreshing fruit shake with creamy finish.',
    price: 50,
    category: 'Shake & Lemonade',
    image: getMenuImageUrl('snakes_big_SHAKE&LEMONADE_50 peso.jpg'),
  },

  // 🍧 DESSERTS
  {
    id: 'mango-pudding-50',
    name: 'Mango Pudding',
    description: 'Silky smooth mango custard dessert topped with sweet mango syrup.',
    price: 50,
    category: 'Desserts',
    image: getMenuImageUrl('Mango Pudding_DESSERTS_50 pesos.jpg'),
  },
  {
    id: 'banana-con-yelo-50',
    name: 'Banana Con Yelo',
    description: 'Sweet caramelized saba bananas over shaved ice with rich milk.',
    price: 50,
    category: 'Desserts',
    image: getMenuImageUrl('bananaconyelo_DESSERTS_50 pesos.jpg'),
  },
  {
    id: 'ice-cream-50',
    name: 'Special Ice Cream',
    description: 'Rich and creamy scoop of ice cream for a sweet after-meal delight.',
    price: 50,
    category: 'Desserts',
    image: getMenuImageUrl('icecream_DESSERTS_50 pesos.jpg'),
  },

  // 🥤 DRINKS
  {
    id: 'mineral-water-15',
    name: 'Mineral Water (500ml)',
    description: 'Purified cold bottled drinking water.',
    price: 15,
    category: 'Drinks',
    image: getMenuImageUrl('Mineral Wate_500ml_DRINKS_15 pesos.jpg'),
  },
  {
    id: 'black-coffee-30',
    name: 'Black Coffee',
    description: 'Hot brewed rich aromatic roasted black coffee.',
    price: 30,
    category: 'Drinks',
    image: getMenuImageUrl('blackcoffee_Black Coffee_30 pesos.jpg'),
  },
  {
    id: 'coke-mismo-25',
    name: 'Coke Mismo (250ml)',
    description: 'Chilled bottle of classic refreshing Coca-Cola.',
    price: 25,
    category: 'Drinks',
    image: getMenuImageUrl('cokemismo_250ml_DRINKS_25 pesos.jpg'),
  },
  {
    id: 'coke-1-5l-110',
    name: 'Coke (1.5L)',
    description: 'Large 1.5-liter Coca-Cola bottle perfect for group sharing.',
    price: 110,
    category: 'Drinks',
    image: getMenuImageUrl('coke_1.5liters_DRINKS_110 pesos.jpg'),
  },
  {
    id: 'sprite-mismo-25',
    name: 'Sprite Mismo (250ml)',
    description: 'Chilled bottle of crisp lemon-lime Sprite soda.',
    price: 25,
    category: 'Drinks',
    image: getMenuImageUrl('spritemismo_250ml_DRINKS_25 pesos.jpg'),
  },
  {
    id: 'sprite-1-5l-100',
    name: 'Sprite (1.5L)',
    description: 'Large 1.5-liter bottle of crisp refreshing Sprite.',
    price: 100,
    category: 'Drinks',
    image: getMenuImageUrl('sprite_1.5_DRINKS_100 pesos.jpg'),
  },
  {
    id: 'royal-mismo-25',
    name: 'Royal Mismo (250ml)',
    description: 'Chilled bottle of sweet, fruity Royal Tru-Orange.',
    price: 25,
    category: 'Drinks',
    image: getMenuImageUrl('royalmismo_250ml_DRINKS_25 pesos.jpg'),
  },
  {
    id: 'royal-1-5l-100',
    name: 'Royal Tru-Orange (1.5L)',
    description: 'Large 1.5-liter bottle of fruity Royal Tru-Orange soda.',
    price: 100,
    category: 'Drinks',
    image: getMenuImageUrl('royal_1.5_DRINKS_100 pesos.jpg'),
  },
  {
    id: 'icetea-glass-20',
    name: 'House Iced Tea (Glass)',
    description: 'Chilled sweetened citrus iced tea served in a glass.',
    price: 20,
    category: 'Drinks',
    image: getMenuImageUrl('icetea_ADD ONS_DRINKS_20 pesos.jpg'),
  },
  {
    id: 'icetea-pitcher-100',
    name: 'House Iced Tea (Pitcher)',
    description: '1-liter sharing pitcher of refreshing house iced tea.',
    price: 100,
    category: 'Drinks',
    image: getMenuImageUrl('icetea_SEAFOODS ADD ONS_100 pesos.jpg'),
  },
]

export interface MenuCardProps {
  item: MenuItem
  onAddToCart: (item: MenuItem) => void
  isAvailable?: boolean
  onToggleAvailability?: (item: MenuItem) => void
  showAvailabilityToggle?: boolean
  allowPriceEdit?: boolean
  onUpdatePrice?: (item: MenuItem, newPrice: number) => void
}

export const MenuCard: React.FC<MenuCardProps> = ({
  item,
  onAddToCart,
  isAvailable = true,
  onToggleAvailability,
  showAvailabilityToggle = false,
  allowPriceEdit = false,
  onUpdatePrice,
}) => {
  const [isEditingPrice, setIsEditingPrice] = React.useState(false)
  const [tempPrice, setTempPrice] = React.useState(String(item.price))

  const handleSavePrice = () => {
    const parsed = parseFloat(tempPrice)
    if (!isNaN(parsed) && parsed >= 0) {
      if (onUpdatePrice) {
        onUpdatePrice(item, parsed)
      }
    }
    setIsEditingPrice(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSavePrice()
    } else if (e.key === 'Escape') {
      setIsEditingPrice(false)
    }
  }

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col h-full overflow-hidden group ${!isAvailable
          ? 'border-rose-200 bg-neutral-50/70 opacity-90'
          : 'border-neutral-200/80 shadow-2xs hover:shadow-md hover:border-orange-200'
        }`}
    >
      {/* Food Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100 flex-shrink-0">
        <img
          src={item.image}
          alt={item.name}
          className={`w-full h-full object-cover transition-transform duration-300 ease-out ${!isAvailable
              ? 'grayscale-[75%] opacity-60 contrast-125'
              : 'group-hover:scale-105'
            }`}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%23f5f5f5'/><text y='55' x='35' font-size='40'>🥘</text></svg>"
          }}
        />

        {/* Category Pill Tag */}
        <span className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-xs text-neutral-800 font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-md border border-neutral-200/60 shadow-2xs">
          {item.category}
        </span>

        {/* Unavailable Banner if item is out of stock */}
        {!isAvailable && (
          <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-[1px] flex items-center justify-center p-2 pointer-events-none">
            <span className="bg-rose-600 text-white font-extrabold text-[11px] sm:text-xs uppercase tracking-widest px-3 py-1 rounded-lg shadow-md border border-rose-400/30 flex items-center gap-1.5 animate-pulse">
              <span>🚫</span> UNAVAILABLE / SOLD OUT
            </span>
          </div>
        )}
      </div>

      {/* Food Info */}
      <div className="p-4 flex flex-col flex-grow justify-between gap-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`font-bold text-sm sm:text-base line-clamp-1 transition-colors ${!isAvailable
                  ? 'text-neutral-500 line-through'
                  : 'text-neutral-900 group-hover:text-orange-600'
                }`}
            >
              {item.name}
            </h3>
          </div>
          <p className="text-xs text-neutral-500 font-normal mt-1 line-clamp-2 min-h-[32px] leading-relaxed">
            {item.description}
          </p>
        </div>

        {/* Price & Add / Availability Toggle Action Bar */}
        <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-neutral-100 gap-2">
          {/* Price or Inline Price Editor */}
          {isEditingPrice ? (
            <div className="flex items-center gap-1 bg-orange-50/80 p-1 rounded-lg border border-orange-200">
              <span className="font-extrabold text-xs text-orange-700">₱</span>
              <input
                type="number"
                min="0"
                step="1"
                autoFocus
                value={tempPrice}
                onChange={(e) => setTempPrice(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-16 px-1.5 py-0.5 text-xs font-bold border border-orange-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={handleSavePrice}
                title="Save Price"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => setIsEditingPrice(false)}
                title="Cancel"
                className="bg-neutral-200 hover:bg-neutral-300 text-neutral-700 text-[10px] font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group/price">
              <span
                className={`font-extrabold text-base sm:text-lg shrink-0 ${!isAvailable ? 'text-neutral-400' : 'text-neutral-900'
                  }`}
              >
                ₱{item.price.toLocaleString()}
              </span>
              {allowPriceEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setTempPrice(String(item.price))
                    setIsEditingPrice(true)
                  }}
                  title="Click to edit price"
                  className="text-[10px] font-bold text-neutral-400 hover:text-orange-600 bg-neutral-100 hover:bg-orange-50 border border-neutral-200 px-1.5 py-0.5 rounded transition-all cursor-pointer"
                >
                  ✏️ Edit
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* POS Staff Stock Toggle Button (Next to +Add) */}
            {showAvailabilityToggle && onToggleAvailability && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleAvailability(item)
                }}
                title={isAvailable ? 'Click to mark this product as Unavailable' : 'Click to make this product Available'}
                className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-all cursor-pointer active:scale-95 flex items-center gap-1 shadow-2xs ${isAvailable
                    ? 'bg-neutral-50 hover:bg-rose-50 text-neutral-600 hover:text-rose-700 border-neutral-200 hover:border-rose-300'
                    : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border-emerald-300'
                  }`}
              >
                <span>{isAvailable ? '🚫 Out of Stock' : '🟢 Set Available'}</span>
              </button>
            )}

            {/* + Add to Cart Button (Available only) */}
            {isAvailable ? (
              <button
                onClick={() => onAddToCart(item)}
                className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-white bg-orange-50 hover:bg-orange-600 active:scale-95 px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-2xs"
              >
                <span>+ Add</span>
              </button>
            ) : !showAvailabilityToggle ? (
              <span className="text-xs font-bold text-neutral-400 bg-neutral-100 px-3 py-1.5 rounded-lg select-none border border-neutral-200">
                Sold Out
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

