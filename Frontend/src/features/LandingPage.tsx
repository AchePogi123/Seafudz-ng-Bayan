import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import Platter3DCard from '../components/Platter3DCard';
import BrandLogo from '../components/BrandLogo';
import { ProductImage } from '../components/ProductImage';
import { useProductImages } from '../utils/useProductImages';
import { useMenuPrices } from '../utils/menuPriceManager';
import { getActiveUser, getEmployeeWorkModule } from '../cryptography/cryptoSession';

// Assets
import seafoodBilaoImg from '../assets/seafood_bilao.png';

interface MagazinePromoConfig {
  id: string;
  badge: string;
  subheading: string;
  tastingNotes: string;
  serves: string;
  flavorProfile: string;
  highlights: string[];
}

const MAGAZINE_PROMOS: MagazinePromoConfig[] = [
  {
    id: 'mixed-seafoods-bowl-699',
    badge: '🔥 #1 BESTSELLER',
    subheading: 'The Iconic Coastal Cajun Boil',
    tastingNotes: 'An abundance of wild mud crabs, plump tiger prawns, and sea mussels drenched in our signature garlic-cajun reduction. Cooked fresh upon order with sweet Batangas corn.',
    serves: '2 to 3 Persons',
    flavorProfile: 'Aromatic Roasted Garlic & Mild Cajun Spice',
    highlights: ['Wild Mud Crabs', 'Plump Tiger Prawns', 'Sweet Batangas Corn', 'Signature Cajun Sauce'],
  },
  {
    id: 'all-shrimp-tray-1099',
    badge: '⭐ CHEF’S SIGNATURE',
    subheading: 'Pure Tiger Prawn Indulgence',
    tastingNotes: 'Over a kilogram of succulent tiger prawns bathed in golden clarified butter and minced native garlic. Designed specifically for gatherings and shrimp lovers.',
    serves: '4 to 6 Persons',
    flavorProfile: 'Rich Golden Garlic Butter Glaze',
    highlights: ['100% Tiger Prawns', 'Clarified Butter Reduction', 'Party Celebration Tray', 'Peeled-to-Dip Ease'],
  },
  {
    id: 'mixed-seafoods-tray-1199',
    badge: '👑 THE GRAND FIESTA BILAO',
    subheading: 'The Ultimate Filipino Celebration Platter',
    tastingNotes: 'Our grandest presentation on an authentic woven bamboo bilao. Loaded to the brim with giant crabs, jumbo prawns, clams, and sweet corn. The undisputed centerpiece for any feast.',
    serves: '6 to 8 Persons',
    flavorProfile: 'Special House Bilao Seasoning',
    highlights: ['Giant Coastal Crabs', 'Whole Bamboo Bilao Platter', 'Thermal Heat Packaging', 'Complimentary Garlic Dip'],
  },
  {
    id: 'all-shrimp-alacarte-199',
    badge: '🦐 SOLO DELICACY',
    subheading: 'Gourmet Sautéed Prawns for One',
    tastingNotes: 'A satisfying solo portion of succulent prawns tossed vigorously in our savory garlic butter glaze. Perfect for lunch pairings or quick late-night seafood cravings.',
    serves: 'Solo Delight (1 Person)',
    flavorProfile: 'Garlic Butter Glazed Prawns',
    highlights: ['Solo Friendly', 'Rapid Wok Sautéed', 'Pairs with Garlic Rice', 'Crispy Golden Tail'],
  },
  {
    id: 'cucumber-lemonade-big-50',
    badge: '🍋 ARTISAN REFRESHER',
    subheading: 'Cold-Pressed Citrus Palate Cleanser',
    tastingNotes: 'Crisp, garden-fresh cucumber slices blended with freshly squeezed lemons and cane nectar. Crafted intentionally to balance out the rich, savory garlic sauces of our seafood.',
    serves: '22oz Jumbo Cup',
    flavorProfile: 'Crisp Cucumber & Zesty Calamansi Lemonade',
    highlights: ['Cold-Pressed Cucumber', 'Freshly Squeezed Citrus', 'Zero Artificial Flavors', 'Ice Cold Refreshment'],
  },
  {
    id: 'chicken-pastil-35',
    badge: '⚡ SOUTHERN HERITAGE',
    subheading: 'Authentic Mindanao-Style Kagikit',
    tastingNotes: 'Tender shredded chicken slow-simmered for four hours in native ginger, garlic, and annatto aromatics. A hearty, flavorful staple wrapped hot and ready to savor.',
    serves: 'Hearty Solo Meal',
    flavorProfile: 'Savory Slow-Simmered Native Spices',
    highlights: ['4-Hour Slow Simmer', 'Mindanao Kagikit Recipe', 'Steamed Rice Pairing', 'Budget-Friendly Value'],
  },
];

const FAQ_LIST = [
  {
    q: 'How do I place an order for delivery or pickup?',
    a: 'Click "Order Now" anywhere on this page to enter our storefront. Select your items, customize your spice level and add-ons, enter your delivery address, and proceed with online payment or cash on delivery.'
  },
  {
    q: 'How far in advance should I place my order?',
    a: 'For regular dining, we recommend placing orders 1 to 2 hours before your desired mealtime. For large gatherings, corporate orders, or weekend feasts, reserving 1 day in advance guarantees your preferred delivery window.'
  },
  {
    q: 'Which areas in Metro Manila are covered for delivery?',
    a: 'We deliver across Metro Manila directly from our active flagship branch in Caloocan City. All orders are packed in thermal insulated bags to ensure your food arrives piping hot.'
  },
  {
    q: 'Can I customize the spice levels and ingredients?',
    a: 'Yes. You can select your preferred spice profile—Original Garlic Butter, Mild Cajun, or Extra Spicy—and add extra crab portions, prawns, corn, or garlic rice directly in your order summary.'
  },
  {
    q: 'Do you offer catering services for events and parties?',
    a: 'Yes, we provide bilao orders and on-site seafood boil stations for celebrations, birthdays, and corporate events. Contact our hotline at (02) 8888-SEAFOOD for custom arrangements.'
  }
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [activeUser, setActiveUser] = useState<ReturnType<typeof getActiveUser>>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const employeeModule = activeUser ? getEmployeeWorkModule(activeUser.role) : null;
  const isEmployee = Boolean(employeeModule);

  // Dynamic Product Catalog & Real-Time Images
  const { menuItems } = useProductImages();
  const { getEffectivePrice } = useMenuPrices();

  // Slideable Magazine State
  const [activeSlide, setActiveSlide] = useState(0);
  const [isSlidePaused, setIsSlidePaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const magazineItems = useMemo(() => {
    return MAGAZINE_PROMOS.map((promo) => {
      const product = menuItems.find((m) => m.id === promo.id);
      if (!product) return null;
      const effectivePrice = getEffectivePrice(product.id, product.price);
      return {
        ...product,
        effectivePrice,
        badge: promo.badge,
        subheading: promo.subheading,
        tastingNotes: promo.tastingNotes,
        serves: promo.serves,
        flavorProfile: promo.flavorProfile,
        highlights: promo.highlights,
      };
    }).filter(Boolean) as (typeof menuItems[0] & {
      effectivePrice: number;
      badge: string;
      subheading: string;
      tastingNotes: string;
      serves: string;
      flavorProfile: string;
      highlights: string[];
    })[];
  }, [menuItems, getEffectivePrice]);

  const totalSlides = magazineItems.length;

  const nextSlide = useCallback(() => {
    if (totalSlides === 0) return;
    setActiveSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    if (totalSlides === 0) return;
    setActiveSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const goToSlide = (idx: number) => {
    if (idx >= 0 && idx < totalSlides) {
      setActiveSlide(idx);
    }
  };

  // Auto-play slide advance with hover pause
  useEffect(() => {
    if (isSlidePaused || totalSlides <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % totalSlides);
    }, 6000);
    return () => clearInterval(timer);
  }, [isSlidePaused, totalSlides]);

  // Touch swipe support for mobile/tablet brochure flipping
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 45) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
    touchStartXRef.current = null;
  };

  const handleFeaturedOrder = (item: { name: string }) => {
    if (isEmployee && employeeModule) {
      navigate(employeeModule.route);
      return;
    }
    navigate(`/customer?search=${encodeURIComponent(item.name)}`);
  };

  // Typewriter and bottom highlight line animation for "Bayan."
  const [typedWord, setTypedWord] = useState('');
  const [isLineDrawn, setIsLineDrawn] = useState(false);

  useEffect(() => {
    const fullWord = 'Bayan.';
    let timeoutId: ReturnType<typeof setTimeout>;
    let isCancelled = false;

    const runTypewriter = () => {
      let currentIdx = 0;
      setIsLineDrawn(false);
      setTypedWord('');

      const typeNextChar = () => {
        if (isCancelled) return;
        if (currentIdx <= fullWord.length) {
          setTypedWord(fullWord.slice(0, currentIdx));
          if (currentIdx === fullWord.length) {
            // Finished spelling Bayan. -> trigger underline highlight
            timeoutId = setTimeout(() => {
              if (isCancelled) return;
              setIsLineDrawn(true);

              // Hold full highlight for 3.5 seconds before restarting loop
              timeoutId = setTimeout(() => {
                if (isCancelled) return;
                deleteChars();
              }, 3500);
            }, 120);
          } else {
            currentIdx++;
            timeoutId = setTimeout(typeNextChar, 140);
          }
        }
      };

      const deleteChars = () => {
        if (isCancelled) return;
        setIsLineDrawn(false);
        let delIdx = fullWord.length;

        const delNextChar = () => {
          if (isCancelled) return;
          if (delIdx >= 0) {
            setTypedWord(fullWord.slice(0, delIdx));
            if (delIdx === 0) {
              timeoutId = setTimeout(runTypewriter, 500);
            } else {
              delIdx--;
              timeoutId = setTimeout(delNextChar, 60);
            }
          }
        };

        timeoutId = setTimeout(delNextChar, 250);
      };

      timeoutId = setTimeout(typeNextChar, 400);
    };

    runTypewriter();

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    setActiveUser(getActiveUser());
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavClick = (e: React.MouseEvent<HTMLElement>, targetId: string) => {
    e.preventDefault();
    if (targetId === 'hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const el = document.getElementById(targetId);
      if (el) {
        const headerOffset = 80;
        const elementPosition = el.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth',
        });
      }
    }
    setIsMobileMenuOpen(false);
  };

  const handleOrderOnline = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (isEmployee && employeeModule) {
      navigate(employeeModule.route);
      return;
    }
    navigate('/customer');
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="landing-page min-h-screen bg-white text-slate-800 font-sans antialiased selection:bg-[#FF6900] selection:text-[#2b180c]">
      {/* 1. HEADER */}
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-300 ${isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-orange-100 py-3.5'
          : 'bg-white border-b border-slate-100 py-4.5'
          }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Revamped Aesthetic Typographic Brand Logo */}
          <BrandLogo variant="light" size="md" onClick={(e) => handleNavClick(e, 'hero')} />

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#hero" onClick={(e) => handleNavClick(e, 'hero')} className="relative py-1 text-slate-600 hover:text-orange-600 transition-colors duration-200 group">
              Home
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#FF6900] transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
            <a href="#featured" onClick={(e) => handleNavClick(e, 'featured')} className="relative py-1 text-slate-600 hover:text-orange-600 transition-colors duration-200 group">
              Bestsellers
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#FF6900] transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
            <a href="#standards" onClick={(e) => handleNavClick(e, 'standards')} className="relative py-1 text-slate-600 hover:text-orange-600 transition-colors duration-200 group">
              Our Standard
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#FF6900] transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
            <a href="#our-story" onClick={(e) => handleNavClick(e, 'our-story')} className="relative py-1 text-slate-600 hover:text-orange-600 transition-colors duration-200 group">
              Our Story
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#FF6900] transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
            <a href="#branches" onClick={(e) => handleNavClick(e, 'branches')} className="relative py-1 text-slate-600 hover:text-orange-600 transition-colors duration-200 group">
              Branches
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#FF6900] transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
            <a href="#faqs" onClick={(e) => handleNavClick(e, 'faqs')} className="relative py-1 text-slate-600 hover:text-orange-600 transition-colors duration-200 group">
              FAQs
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-[#FF6900] transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
          </nav>

          {/* Header Action Button */}
          <div className="hidden sm:flex items-center gap-3">
            {activeUser ? (
              <Link
                to={
                  employeeModule
                    ? employeeModule.route
                    : '/account'
                }
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors truncate max-w-[160px]"
                title={employeeModule ? `Go to ${employeeModule.label}` : 'Account'}
              >
                {activeUser.fullname || (employeeModule ? employeeModule.shortLabel : 'Account')}
              </Link>
            ) : (
              <Link
                to="/login"
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                Login / Register
              </Link>
            )}
          </div>

          {/* Mobile Hamburger Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-1.5 text-slate-800 hover:text-orange-600 transition-colors focus:outline-none flex items-center justify-center cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? (
              <svg className="w-6.5 h-6.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6.5 h-6.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-100 px-6 py-5 shadow-lg space-y-4 text-left">
            <nav className="flex flex-col gap-3 font-semibold text-slate-700 text-sm">
              <a href="#hero" onClick={(e) => handleNavClick(e, 'hero')} className="hover:text-orange-600 py-1">Home</a>
              <a href="#featured" onClick={(e) => handleNavClick(e, 'featured')} className="hover:text-orange-600 py-1">Bestsellers</a>
              <a href="#standards" onClick={(e) => handleNavClick(e, 'standards')} className="hover:text-orange-600 py-1">Our Standard</a>
              <a href="#our-story" onClick={(e) => handleNavClick(e, 'our-story')} className="hover:text-orange-600 py-1">Our Story</a>
              <a href="#branches" onClick={(e) => handleNavClick(e, 'branches')} className="hover:text-orange-600 py-1">Branches</a>
              <a href="#faqs" onClick={(e) => handleNavClick(e, 'faqs')} className="hover:text-orange-600 py-1">FAQs</a>
            </nav>
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <button
                onClick={(e) => {
                  setIsMobileMenuOpen(false);
                  handleOrderOnline(e);
                }}
                className="block w-full text-center bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl text-sm cursor-pointer uppercase tracking-wider"
              >
                {isEmployee && employeeModule ? employeeModule.shortLabel : 'Order Now'}
              </button>
              {!activeUser && (
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-sm"
                >
                  Login / Register
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 3. HERO SECTION */}
      <section id="hero" className="relative bg-white pt-14 pb-20 lg:pt-20 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-7 text-left space-y-6">
              {/* Category Overline with Accent Dash */}
              <div className="flex items-center gap-2">
                <span className="w-5 h-[1.5px] bg-orange-600 inline-block rounded-full"></span>
                <span className="text-[11px] sm:text-xs font-black tracking-widest text-orange-600 uppercase">
                  PHILIPPINE COASTAL KITCHEN
                </span>
              </div>

              {/* Main Headline with Custom Bayan Accent & Swoosh Underline */}
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-slate-900 tracking-tight leading-[1.18]">
                Authentic seafood feasts,<br />
                crafted for the{' '}
                <span className="relative inline-block text-orange-600">
                  {/* Invisible placeholder maintaining exact layout stability */}
                  <span className="invisible select-none">Bayan.</span>

                  {/* Animated typing text overlay with blinking typewriter cursor */}
                  <span className="absolute left-0 top-0 text-orange-600 flex items-baseline">
                    {typedWord}
                    <span
                      className={`inline-block w-[2px] h-[0.82em] bg-orange-600 ml-0.5 align-baseline transition-opacity duration-150 ${isLineDrawn ? 'opacity-0' : 'opacity-100 animate-pulse'
                        }`}
                    />
                  </span>

                  {/* Animated bottom highlight line synchronized with the writing effect */}
                  <svg
                    className="absolute -bottom-1.5 left-0 w-full h-2.5 text-orange-500 overflow-visible pointer-events-none"
                    viewBox="0 0 160 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3 8.5C45 3.5 95 3.5 157 7.5"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      style={{
                        strokeDasharray: 200,
                        strokeDashoffset: isLineDrawn ? 0 : 200,
                        transition: 'stroke-dashoffset 0.75s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                  </svg>
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm sm:text-base text-slate-600 max-w-lg leading-relaxed font-normal">
                Indulge in authentic Filipino seafood bilao platters, wild mud crabs, and butter garlic prawns. Sourced daily from local fishports and delivered with temperature-controlled thermal care straight to your table.
              </p>

              {/* Call-to-action buttons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <button
                  onClick={handleOrderOnline}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
                >
                  {isEmployee && employeeModule ? employeeModule.shortLabel : 'Order Now'}
                </button>

                {/* Mobile View: Login Button */}
                <Link
                  to={
                    activeUser
                      ? employeeModule
                        ? employeeModule.route
                        : '/account'
                      : '/login'
                  }
                  className="lg:hidden bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-600 font-bold text-xs sm:text-sm px-6 py-3.5 rounded-xl border border-slate-200 hover:border-orange-300 transition-all cursor-pointer inline-flex items-center justify-center shadow-xs"
                >
                  {activeUser ? (activeUser.role === 'customer' ? 'My Account' : (employeeModule?.shortLabel || 'Dashboard')) : 'Login'}
                </Link>

                {/* Windows / Desktop View: Our Standards */}
                <a
                  href="#standards"
                  onClick={(e) => handleNavClick(e, 'standards')}
                  className="hidden lg:inline-flex bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-600 font-bold text-xs sm:text-sm px-5 py-3.5 rounded-xl border border-slate-200 hover:border-orange-300 transition-all cursor-pointer items-center justify-center"
                >
                  Our Standards
                </a>
              </div>

              {/* Quality Metrics */}
              <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-6 max-w-lg text-left">
                <div>
                  <div className="text-sm font-black text-slate-900">4.9 / 5.0 Rating</div>
                  <span className="text-xs text-slate-500 block mt-1">15,000+ Verified Reviews</span>
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900">30 to 45 Mins</div>
                  <span className="text-xs text-slate-500 block mt-1">Fast Metro Dispatch</span>
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900">100% Guaranteed</div>
                  <span className="text-xs text-slate-500 block mt-1">Daily Dawn Catch</span>
                </div>
              </div>
            </div>

            {/* Right Hero Visual Column (Desktop & Large Screens only; hidden on mobile view) */}
            <div className="hidden lg:block lg:col-span-5">
              <Platter3DCard
                image={seafoodBilaoImg}
                title="Seafood Bilao Supreme"
                description="Mud Crabs, Plump Tiger Prawns, Tahong, Sweet Corn & Annatto Garlic Rice"
                price={1890}
                serves="Serves 4 to 6 Persons"
                tag1="Signature Feast"
                tag2="Bestseller"
                orderLink="/customer"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. KEY STATS BANNER */}
      <section className="bg-orange-50/40 border-t border-orange-100/70">
        {/* Stats Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-3">
              <span className="text-3xl sm:text-4xl font-black text-orange-600 block">250,000+</span>
              <span className="text-xs sm:text-sm font-bold text-slate-800 mt-1 block">Bilaos Delivered</span>
              <span className="text-[11px] text-slate-500 block">Across Metro Manila</span>
            </div>
            <div className="p-3">
              <span className="text-3xl sm:text-4xl font-black text-orange-600 block">1</span>
              <span className="text-xs sm:text-sm font-bold text-slate-800 mt-1 block">Active Flagship Branch</span>
              <span className="text-[11px] text-slate-500 block">Caloocan City, Metro Manila</span>
            </div>
            <div className="p-3">
              <span className="text-3xl sm:text-4xl font-black text-orange-600 block">50+</span>
              <span className="text-xs sm:text-sm font-bold text-slate-800 mt-1 block">Fishermen Partners</span>
              <span className="text-[11px] text-slate-500 block">Direct Coastal Sourcing</span>
            </div>
            <div className="p-3">
              <span className="text-3xl sm:text-4xl font-black text-orange-600 block">100%</span>
              <span className="text-xs sm:text-sm font-bold text-slate-800 mt-1 block">Freshness Guarantee</span>
              <span className="text-[11px] text-slate-500 block">No Frozen Warehousing</span>
            </div>
          </div>
        </div>

        {/* Bottom Full-Width Animated Marquee Bar */}
        <div className="w-full bg-orange-600 text-[#2b180c] text-xs font-semibold py-2.5 overflow-hidden whitespace-nowrap select-none border-t border-orange-500/40">
          <div className="animate-marquee flex items-center gap-8">
            <span className="flex items-center gap-3 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
              Fresh Catch Daily • Complimentary Metro Manila Delivery on Orders Above ₱3,000
            </span>
            <span className="text-orange-300">✦</span>
            <span className="flex items-center gap-3 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
              Wild Mud Crabs &amp; Plump Tiger Prawns • Sourced Dawn Daily
            </span>
            <span className="text-orange-300">✦</span>
            <span className="flex items-center gap-3 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
              Thermal Heat Packaging • Hot &amp; Ready Direct to Door
            </span>
            <span className="text-orange-300">✦</span>
            <span className="flex items-center gap-3 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
              Fresh Catch Daily • Complimentary Metro Manila Delivery on Orders Above ₱3,000
            </span>
            <span className="text-orange-300">✦</span>
            <span className="flex items-center gap-3 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
              Wild Mud Crabs &amp; Plump Tiger Prawns • Sourced Dawn Daily
            </span>
            <span className="text-orange-300">✦</span>
            <span className="flex items-center gap-3 tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
              Thermal Heat Packaging • Hot &amp; Ready Direct to Door
            </span>
            <span className="text-orange-300">✦</span>
          </div>
        </div>
      </section>

      {/* 5. SLIDEABLE MAGAZINE & BROCHURE SHOWCASE */}
      <section
        id="featured"
        className="py-20 bg-slate-50 border-t border-slate-200"
        onMouseEnter={() => setIsSlidePaused(true)}
        onMouseLeave={() => setIsSlidePaused(false)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Magazine Editorial Header */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-700 bg-orange-100 px-3.5 py-1.5 rounded-full inline-block mb-3">
              Culinary Magazine &amp; Brochure Showcase
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              The Seafood Chronicle
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
              Flip through our chef-curated seafood platters, giant cajun boils, and refreshing accompaniments. Prepared fresh daily with dawn-sourced coastal catches.
            </p>
          </div>

          {/* Main Magazine Slide Spread */}
          {magazineItems.length > 0 && (() => {
            const current = magazineItems[activeSlide] || magazineItems[0];
            return (
              <div
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="relative bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden transition-all duration-300"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  {/* Left Column: Big Picture Magazine Stage (Col 7) */}
                  <div className="lg:col-span-7 relative min-h-[360px] sm:min-h-[460px] lg:min-h-[540px] bg-gradient-to-br from-amber-50/70 via-orange-50/40 to-slate-100 flex items-center justify-center p-6 sm:p-12 overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-100">
                    {/* Subtle warm magazine radial ambient background */}
                    <div className="absolute inset-0 bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

                    {/* Giant Product Photo */}
                    <div className="relative z-10 w-full h-full max-h-[460px] flex items-center justify-center">
                      <ProductImage
                        src={current.image}
                        fallbackSrc={current.bundledImage}
                        alt={current.name}
                        className="w-full h-full max-h-[440px] object-contain drop-shadow-2xl transition-all duration-700 transform hover:scale-105 select-none"
                      />
                    </div>

                    {/* Floating Magazine Badges */}
                    <div className="absolute top-4 left-4 z-20">
                      <span className="bg-white/95 backdrop-blur-md text-orange-700 border border-orange-200/90 text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-md">
                        {current.badge}
                      </span>
                    </div>

                    <div className="absolute top-4 right-4 z-20">
                      <span className="bg-gradient-to-r from-orange-600 to-amber-600 text-white font-black text-sm sm:text-base px-4 py-1.5 rounded-full shadow-lg">
                        ₱{current.effectivePrice.toLocaleString()}
                      </span>
                    </div>

                    <div className="absolute bottom-4 left-4 z-20 hidden sm:inline-flex items-center gap-2 bg-slate-900/85 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-md">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>100% DAWN CATCH • STEAMED PIPING HOT</span>
                    </div>

                    {/* Left & Right Slide Navigation Arrows */}
                    <button
                      onClick={prevSlide}
                      aria-label="Previous Magazine Page"
                      className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/95 hover:bg-orange-600 text-slate-800 hover:text-white shadow-xl flex items-center justify-center transition-all cursor-pointer z-30 active:scale-90 border border-slate-200/80"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    <button
                      onClick={nextSlide}
                      aria-label="Next Magazine Page"
                      className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/95 hover:bg-orange-600 text-slate-800 hover:text-white shadow-xl flex items-center justify-center transition-all cursor-pointer z-30 active:scale-90 border border-slate-200/80"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* Right Column: Editorial Article & Specifications (Col 5) */}
                  <div className="lg:col-span-5 p-6 sm:p-9 lg:p-10 flex flex-col justify-between text-left bg-white">
                    <div>
                      {/* Top Editorial Ticker */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-600">
                          BROCHURE SPREAD 0{activeSlide + 1} / 0{totalSlides}
                        </span>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-md">
                          {current.category}
                        </span>
                      </div>

                      {/* Main Title & Subtitle */}
                      <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                        {current.name}
                      </h3>
                      <p className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-orange-600 mt-1">
                        {current.subheading}
                      </p>

                      {/* Tasting Notes / Magazine Narrative */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                          Chef's Tasting Notes &amp; Preparation
                        </span>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                          {current.tastingNotes}
                        </p>
                      </div>

                      {/* Spec Sheet Grid */}
                      <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-100">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                            Portion Serving
                          </span>
                          <span className="text-xs font-black text-slate-800 mt-0.5 block">
                            {current.serves}
                          </span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                            Signature Glaze
                          </span>
                          <span className="text-xs font-black text-slate-800 mt-0.5 block">
                            {current.flavorProfile}
                          </span>
                        </div>
                      </div>

                      {/* Ingredient Highlights Tags */}
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {current.highlights.map((tag) => (
                          <span
                            key={tag}
                            className="bg-orange-50 text-orange-800 border border-orange-100 text-[11px] font-bold px-2.5 py-1 rounded-lg"
                          >
                            ✓ {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bottom CTA & Price Section */}
                    <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
                          Menu Price
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-orange-600">
                          ₱{current.effectivePrice.toLocaleString()}
                        </span>
                      </div>

                      <button
                        onClick={() => handleFeaturedOrder(current)}
                        className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer uppercase tracking-wider"
                      >
                        <span>Order This Dish</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Slide Pagination Bar */}
                <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    {magazineItems.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => goToSlide(idx)}
                        aria-label={`Go to slide ${idx + 1}`}
                        className={`h-2.5 rounded-full transition-all cursor-pointer ${
                          activeSlide === idx
                            ? 'w-8 bg-orange-600'
                            : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                        }`}
                      />
                    ))}
                  </div>

                  <span className="text-xs text-slate-600 font-semibold">
                    Swipe or use arrows to flip • Pauses on hover
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Slideable Thumbnail Selector Strip (Brochure Deck) */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-black uppercase tracking-widest text-slate-600">
                Flip to Any Signature Item
              </span>
              <span className="text-xs text-orange-600 font-bold">
                {magazineItems.length} Featured Items
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {magazineItems.map((item, idx) => {
                const isActive = activeSlide === idx;
                return (
                  <button
                    key={item.id}
                    onClick={() => goToSlide(idx)}
                    className={`p-3 rounded-2xl text-left transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                      isActive
                        ? 'bg-white border-2 border-orange-500 shadow-lg scale-102 ring-2 ring-orange-200'
                        : 'bg-white/80 hover:bg-white border border-slate-200/90 hover:border-orange-300 shadow-xs'
                    }`}
                  >
                    <div className="w-full aspect-square rounded-xl bg-slate-50 flex items-center justify-center p-2 mb-2 overflow-hidden">
                      <ProductImage
                        src={item.image}
                        fallbackSrc={item.bundledImage}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-orange-600 block truncate">
                        {item.badge}
                      </span>
                      <h4 className="text-xs font-bold text-slate-800 truncate mt-0.5">
                        {item.name}
                      </h4>
                      <span className="text-xs font-black text-slate-700 block mt-1">
                        ₱{item.effectivePrice.toLocaleString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Promotional Advertisement Callout Banner */}
          <div className="mt-14 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600 rounded-3xl p-6 sm:p-9 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left z-10">
              <span className="inline-block bg-white/20 backdrop-blur-xs text-white text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full">
                🔥 Hot Feasting Promotion
              </span>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                Complimentary Metro Manila Delivery on Orders Above ₱3,000
              </h3>
              <p className="text-orange-100 text-xs sm:text-sm max-w-xl leading-relaxed">
                Enjoy free delivery in temperature-sealed thermal packaging. Keep your mud crabs and butter garlic prawns piping hot until your feast begins.
              </p>
            </div>
            <button
              onClick={handleOrderOnline}
              className="z-10 bg-white hover:bg-orange-50 text-orange-600 font-bold text-xs sm:text-sm px-7 py-3.5 rounded-xl shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer uppercase tracking-wider shrink-0"
            >
              Order Online Storefront
            </button>
          </div>
        </div>
      </section>

      {/* 6. OUR STANDARD (Numbered Pillar Cards) */}
      <section id="standards" className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-700 bg-orange-100 px-3.5 py-1.5 rounded-full inline-block mb-3">
              Quality Commitment
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              The Seafudz Quality Standard
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
              From our coastal supply partners to your dining table, we maintain absolute freshness and consistency.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 text-left">
            <div className="bg-white p-4 sm:p-7 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] sm:text-xs font-extrabold text-orange-600 uppercase tracking-widest font-mono block mb-1.5 sm:mb-3">
                  Standard 01
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1.5 sm:mb-2 leading-tight">Daily Dawn Harvest</h3>
                <p className="text-[11px] sm:text-sm text-slate-600 leading-relaxed">
                  Directly gathered from local coastal fishports at dawn. No aged frozen inventory is ever used in our platters.
                </p>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-7 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] sm:text-xs font-extrabold text-orange-600 uppercase tracking-widest font-mono block mb-1.5 sm:mb-3">
                  Standard 02
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1.5 sm:mb-2 leading-tight">Insulated Heat Delivery</h3>
                <p className="text-[11px] sm:text-sm text-slate-600 leading-relaxed">
                  Transported in thermal heat-retention packaging so every Cajun boil arrives sizzling and ready to feast.
                </p>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-7 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] sm:text-xs font-extrabold text-orange-600 uppercase tracking-widest font-mono block mb-1.5 sm:mb-3">
                  Standard 03
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1.5 sm:mb-2 leading-tight">Scratch-Made Sauces</h3>
                <p className="text-[11px] sm:text-sm text-slate-600 leading-relaxed">
                  Cooked with natural dairy butter, fresh native garlic, and custom spice blends with selectable heat intensities.
                </p>
              </div>
            </div>

            <div className="bg-white p-4 sm:p-7 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] sm:text-xs font-extrabold text-orange-600 uppercase tracking-widest font-mono block mb-1.5 sm:mb-3">
                  Standard 04
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1.5 sm:mb-2 leading-tight">Bayanihan Portions</h3>
                <p className="text-[11px] sm:text-sm text-slate-600 leading-relaxed">
                  Substantial family-scale platters designed for gatherings, celebrations, and memorable group feasts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. OUR STORY & MILESTONES */}
      <section id="our-story" className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Story Text */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <span className="text-xs font-bold uppercase tracking-widest text-orange-700 bg-orange-100 px-3.5 py-1.5 rounded-full inline-block">
                Our Story & Mission
              </span>

              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                From a Street Stall to Our <br />
                <span className="text-orange-600">Caloocan City Flagship</span>
              </h2>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Founded with a dedication to authentic Filipino seafood cooking, Seafudz Ng Bayan started as a modest neighborhood venture. Encouraged by customer support for our garlic butter and Cajun platters, we grew into a trusted seafood destination.
              </p>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                By purchasing directly from local coastal fishermen every day, we provide reliable earnings for fishing communities while bringing genuine ocean sweetness straight to your household.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row gap-4">
                <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 flex-1">
                  <span className="text-2xl font-black text-orange-600 block">50+</span>
                  <span className="text-xs font-bold text-slate-700 block mt-1">Fishermen Families Supported</span>
                </div>
                <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 flex-1">
                  <span className="text-2xl font-black text-orange-600 block">15+</span>
                  <span className="text-xs font-bold text-slate-700 block mt-1">Original Sauce Formulations</span>
                </div>
              </div>
            </div>

            {/* Timeline Cards */}
            <div className="lg:col-span-6 space-y-4 text-left">
              <div className="p-5 rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-orange-600 font-mono">2021 • Foundation</span>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">Phase 01</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">First Street Stall in Manila</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Started offering freshly simmered Cajun shrimp boils with a single proprietary sauce recipe.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-orange-600 font-mono">2022 • The Bilao Concept</span>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">Phase 02</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">Launch of Family Bilao Platters</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Introduced generous family bilao platters and expanded our kitchen facilities.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-orange-600 font-mono">2024 • Operations Tech</span>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">Phase 03</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">Online Storefront & Kitchen Dispatch</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Implemented live kitchen queue coordination and express thermal delivery across the metro.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-orange-300 bg-orange-50/40">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-orange-600 font-mono">Present Day</span>
                  <span className="text-[10px] font-bold bg-orange-600 text-[#2b180c] px-2 py-0.5 rounded-md">Active</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">Caloocan Flagship Hub</h4>
                <p className="text-xs text-slate-600 mt-1">
                  Serving thousands of seafood customers weekly from our primary Caloocan hub.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. BRANCH LOCATIONS */}
      <section id="branches" className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-700 bg-orange-100 px-3.5 py-1.5 rounded-full inline-block mb-3">
              Location & Operations
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Our Active Branch Location
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
              Visit our active flagship branch in Caloocan City for dine-in, takeout, or place orders for Metro Manila delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto">
            {/* Active Caloocan Branch */}
            <div className="bg-white p-8 rounded-2xl border-2 border-orange-400 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1 rounded-md uppercase tracking-wider">
                  Active Flagship Branch
                </span>
                <span className="text-xs font-bold text-emerald-700">Open Daily</span>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">Caloocan City Main Branch</h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1.5">
                Caloocan City, Metro Manila, Philippines
              </p>

              <div className="mt-6 pt-5 border-t border-slate-100 space-y-3 text-xs sm:text-sm text-slate-600">
                <div>
                  <span className="font-bold text-slate-800">Operating Hours:</span> 24/7 Daily
                </div>
                <div>
                  <span className="font-bold text-slate-800">Hotline:</span> (02) 8888-SEAFOOD / (02) 8888-7323
                </div>
                <div>
                  <span className="font-bold text-slate-800">Available Services:</span> Dine-in, Fast Takeout, Express Online Delivery
                </div>
              </div>
            </div>

            {/* Delivery Coverage Info Card */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-md uppercase tracking-wider">
                    Service Reach
                  </span>
                  <span className="text-xs font-bold text-orange-600">Insulated Delivery</span>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">Metro Manila Coverage</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                  Our Caloocan central kitchen dispatches orders across Metro Manila using thermal insulated carriers to maintain food temperature.
                </p>

                <div className="mt-6 pt-5 border-t border-slate-100 space-y-2 text-xs sm:text-sm text-slate-600">
                  <div>Average Delivery Window: 30 to 45 minutes</div>
                  <div>Complimentary Delivery: Orders above ₱3,000</div>
                  <div>Additional branch locations: In planning phase</div>
                </div>
              </div>

              <div className="mt-6 pt-4">
                <button
                  onClick={handleOrderOnline}
                  className="block w-full text-center bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm py-3 rounded-xl transition-colors cursor-pointer"
                >
                  Order From Caloocan Branch
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 9. FREQUENTLY ASKED QUESTIONS */}
      <section id="faqs" className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-700 bg-orange-100 px-3.5 py-1.5 rounded-full inline-block mb-3">
              Help & Answers
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
              Key details regarding dispatch timing, customization, payments, and event catering.
            </p>
          </div>

          <div className="space-y-3 text-left">
            {FAQ_LIST.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className={`border rounded-xl overflow-hidden transition-all duration-300 ${
                    isOpen
                      ? 'border-orange-200 bg-orange-50/10 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between p-5 text-left bg-transparent hover:bg-orange-50/30 transition-colors cursor-pointer"
                  >
                    <span className="text-sm sm:text-base font-bold text-slate-900 pr-4">
                      {faq.q}
                    </span>
                    <span
                      className={`text-xs font-bold font-mono shrink-0 transition-all duration-300 px-2.5 py-1 rounded-full ${
                        isOpen
                          ? 'text-orange-700 bg-orange-100'
                          : 'text-orange-600 bg-orange-50/80 hover:bg-orange-100'
                      }`}
                    >
                      {isOpen ? 'Close' : 'Details'}
                    </span>
                  </button>

                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100/80">
                        {faq.a}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 10. CALL TO ACTION BANNER */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#FF6900] rounded-3xl p-8 sm:p-12 lg:p-16 text-center text-[#2b180c] shadow-lg">
            <div className="max-w-2xl mx-auto space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3.5 py-1.5 rounded-full inline-block">
                Hot & Fresh Delivery
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                Ready for a Seafood Feast?
              </h2>

              <p className="text-sm sm:text-base text-black/75 leading-relaxed">
                Order your favorite Seafood Bilao Feast or Cajun Boils now. We prepare each platter fresh upon ordering and deliver it hot to your door.
              </p>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={handleOrderOnline}
                  className="bg-white hover:bg-orange-50 text-orange-600 font-bold text-sm sm:text-base px-8 py-4 rounded-xl shadow-xs transition-colors cursor-pointer uppercase tracking-wider"
                >
                  {isEmployee && employeeModule ? `Go to ${employeeModule.shortLabel}` : 'Order Now'}
                </button>
                <a
                  href="tel:0288887323"
                  className="bg-orange-700 hover:bg-orange-800 text-white font-bold text-sm sm:text-base px-7 py-4 rounded-xl border border-white/20 transition-colors"
                >
                  Call Hotline: (02) 8888-SEAFOOD
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 11. FOOTER */}
      <Footer />

      {/* 12. FLOATING SCROLL TO TOP BUTTON (RIGHTMOST BOTTOM) */}
      <button
        onClick={scrollToTop}
        aria-label="Scroll back to top"
        className={`fixed bottom-6 right-6 z-40 p-3.5 sm:p-4 rounded-2xl bg-[#FF6900] text-white shadow-lg shadow-orange-500/30 border border-white/25 hover:bg-[#a82c00] hover:shadow-orange-500/50 hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center group ${showScrollTop
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-6 pointer-events-none'
          }`}
      >
        <svg
          className="w-5 h-5 text-white transition-transform duration-200 group-hover:-translate-y-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </button>
    </div>
  );
};

export default LandingPage;
