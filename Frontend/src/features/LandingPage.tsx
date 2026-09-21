import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import Platter3DCard from '../components/Platter3DCard';
import BrandLogo from '../components/BrandLogo';
import { getActiveUser } from '../cryptography/cryptoSession';

// Assets
import seafoodBilaoImg from '../assets/seafood_bilao.png';
import crabBucketImg from '../assets/crab_bucket.png';
import garlicButterShrimpImg from '../assets/garlic_butter_shrimp.png';
import spicyShrimpImg from '../assets/spicy_shrimp.png';

interface DishItem {
  id: string;
  name: string;
  tag: string;
  price: number;
  serves: string;
  description: string;
  image: string;
}

const SIGNATURE_DISHES: DishItem[] = [
  {
    id: 'dish-1',
    name: 'Seafood Bilao Supreme',
    tag: 'Bestseller',
    price: 1890,
    serves: 'Serves 4 to 6 Persons',
    description: 'Generous medley of crabs, tiger prawns, sweet mussels, corn coblets, and garlic annatto rice drenched in signature garlic butter sauce.',
    image: seafoodBilaoImg
  },
  {
    id: 'dish-2',
    name: 'Imperial Cajun Crab Bucket',
    tag: "Chef's Selection",
    price: 2450,
    serves: 'Serves 3 to 4 Persons',
    description: 'Wild jumbo mud crabs tossed in our proprietary 12-spice Cajun butter blend, accompanied by warm toasted mantou buns.',
    image: crabBucketImg
  },
  {
    id: 'dish-3',
    name: 'Garlic Butter Tiger Prawns',
    tag: 'House Favorite',
    price: 890,
    serves: 'Serves 2 to 3 Persons',
    description: 'Fresh plump tiger prawns sauteed with caramelized native garlic, rich dairy butter, and thinly sliced scallions.',
    image: garlicButterShrimpImg
  },
  {
    id: 'dish-4',
    name: 'Fire-Roasted Chili Shrimp',
    tag: 'Spicy Specialty',
    price: 950,
    serves: 'Serves 2 to 3 Persons',
    description: 'Char-grilled succulent shrimps glazed with sweet bird’s eye chili marmalade and freshly squeezed calamansi.',
    image: spicyShrimpImg
  }
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
    a: 'Yes, we provide bulk bilao orders and on-site seafood boil stations for celebrations, birthdays, and corporate events. Contact our hotline at (02) 8888-SEAFOOD for custom arrangements.'
  }
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [activeUser, setActiveUser] = useState<ReturnType<typeof getActiveUser>>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

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
    navigate('/customer');
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans antialiased selection:bg-orange-500 selection:text-white">
      {/* 1. HEADER */}
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-300 ${
          isScrolled
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
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-gradient-to-r from-orange-600 to-amber-500 transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
            <a href="#specialties" onClick={(e) => handleNavClick(e, 'specialties')} className="relative py-1 text-slate-600 hover:text-orange-600 transition-colors duration-200 group">
              Specialties
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-gradient-to-r from-orange-600 to-amber-500 transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
            <a href="#standards" onClick={(e) => handleNavClick(e, 'standards')} className="relative py-1 text-slate-600 hover:text-orange-600 transition-colors duration-200 group">
              Our Standard
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-gradient-to-r from-orange-600 to-amber-500 transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
            <a href="#our-story" onClick={(e) => handleNavClick(e, 'our-story')} className="relative py-1 text-slate-600 hover:text-orange-600 transition-colors duration-200 group">
              Our Story
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-gradient-to-r from-orange-600 to-amber-500 transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
            <a href="#branches" onClick={(e) => handleNavClick(e, 'branches')} className="relative py-1 text-slate-600 hover:text-orange-600 transition-colors duration-200 group">
              Branches
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-gradient-to-r from-orange-600 to-amber-500 transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
            <a href="#faqs" onClick={(e) => handleNavClick(e, 'faqs')} className="relative py-1 text-slate-600 hover:text-orange-600 transition-colors duration-200 group">
              FAQs
              <span className="absolute bottom-0 left-0 w-0 h-[2px] bg-gradient-to-r from-orange-600 to-amber-500 transition-all duration-300 ease-out group-hover:w-full rounded-full" />
            </a>
          </nav>

          {/* Header Action Button */}
          <div className="hidden sm:flex items-center gap-3">
            {activeUser ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOrderOnline}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Order Now
                </button>
                <Link
                  to={activeUser.role === 'admin' ? '/admin-dashboard' : activeUser.role === 'cashier' ? '/pos' : '/account'}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2.5 rounded-xl transition-colors truncate max-w-[140px]"
                >
                  {activeUser.fullname || 'Account'}
                </Link>
              </div>
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
            className="lg:hidden p-2.5 rounded-xl text-slate-700 hover:text-orange-600 hover:bg-orange-50 border border-slate-200 transition-colors focus:outline-none flex items-center justify-center cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? (
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-100 px-6 py-5 shadow-lg space-y-4 text-left">
            <nav className="flex flex-col gap-3 font-semibold text-slate-700 text-sm">
              <a href="#hero" onClick={(e) => handleNavClick(e, 'hero')} className="hover:text-orange-600 py-1">Home</a>
              <a href="#specialties" onClick={(e) => handleNavClick(e, 'specialties')} className="hover:text-orange-600 py-1">Specialties</a>
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
                className="block w-full text-center bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl text-sm cursor-pointer"
              >
                Order Now
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
      <section id="hero" className="relative bg-gradient-to-b from-orange-50/50 via-white to-white pt-14 pb-20 lg:pt-20 lg:pb-28">
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
                      className={`inline-block w-[2px] h-[0.82em] bg-orange-600 ml-0.5 align-baseline transition-opacity duration-150 ${
                        isLineDrawn ? 'opacity-0' : 'opacity-100 animate-pulse'
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
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Order Now
                </button>

                <a
                  href="#specialties"
                  onClick={(e) => handleNavClick(e, 'specialties')}
                  className="bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-600 font-bold text-xs sm:text-sm px-5 py-3.5 rounded-xl border border-slate-200 hover:border-orange-300 transition-all cursor-pointer"
                >
                  View Specialties
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
        <div className="w-full bg-orange-600 text-white text-xs font-semibold py-2.5 overflow-hidden whitespace-nowrap select-none border-t border-orange-500/40">
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

      {/* 5. SIGNATURE SPECIALTIES */}
      <section id="specialties" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-700 bg-orange-100 px-3.5 py-1.5 rounded-full inline-block mb-3">
              Fresh From Our Kitchen
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Our Signature Seafood Platters
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed">
              Every dish is freshly prepared upon order using prime morning catches, natural dairy butter, and our proprietary Cajun rub.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SIGNATURE_DISHES.map((dish) => (
              <div
                key={dish.id}
                onClick={handleOrderOnline}
                className="relative h-72 sm:h-80 md:h-88 rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer border border-slate-200/80 bg-orange-50"
              >
                <img
                  src={dish.image}
                  alt={dish.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-bold text-orange-700 shadow-sm border border-orange-100/80">
                  {dish.tag}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex flex-col justify-end p-5 text-white transition-opacity duration-300">
                  <h3 className="font-extrabold text-lg sm:text-xl leading-snug drop-shadow-sm">
                    {dish.name}
                  </h3>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <button
              onClick={handleOrderOnline}
              className="inline-block bg-slate-900 hover:bg-orange-600 text-white font-bold text-sm px-8 py-3.5 rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              Explore Full Online Menu
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-extrabold text-orange-600 uppercase tracking-widest font-mono block mb-3">
                Standard 01
              </span>
              <h3 className="text-base font-bold text-slate-900 mb-2">Daily Dawn Harvest</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Directly gathered from local coastal fishports at dawn. No aged frozen inventory is ever used in our platters.
              </p>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-extrabold text-orange-600 uppercase tracking-widest font-mono block mb-3">
                Standard 02
              </span>
              <h3 className="text-base font-bold text-slate-900 mb-2">Insulated Heat Delivery</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Transported in thermal heat-retention packaging so every Cajun boil arrives sizzling and ready to feast.
              </p>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-extrabold text-orange-600 uppercase tracking-widest font-mono block mb-3">
                Standard 03
              </span>
              <h3 className="text-base font-bold text-slate-900 mb-2">Scratch-Made Sauces</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Cooked with natural dairy butter, fresh native garlic, and custom spice blends with selectable heat intensities.
              </p>
            </div>

            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-extrabold text-orange-600 uppercase tracking-widest font-mono block mb-3">
                Standard 04
              </span>
              <h3 className="text-base font-bold text-slate-900 mb-2">Bayanihan Portions</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Substantial family-scale platters designed for gatherings, celebrations, and memorable group feasts.
              </p>
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
                  <span className="text-[10px] font-bold bg-orange-600 text-white px-2 py-0.5 rounded-md">Active</span>
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
                  <span className="font-bold text-slate-800">Operating Hours:</span> 10:00 AM to 10:00 PM Daily
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
                  className="border border-slate-200 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex items-center justify-between p-5 text-left bg-white hover:bg-orange-50/30 transition-colors"
                  >
                    <span className="text-sm sm:text-base font-bold text-slate-900 pr-4">
                      {faq.q}
                    </span>
                    <span className="text-xs font-bold text-orange-600 font-mono shrink-0">
                      {isOpen ? 'Close' : 'Details'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 10. CALL TO ACTION BANNER */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-3xl p-8 sm:p-12 lg:p-16 text-center text-white shadow-lg">
            <div className="max-w-2xl mx-auto space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-3.5 py-1.5 rounded-full inline-block">
                Hot & Fresh Delivery
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                Ready for a Seafood Feast?
              </h2>

              <p className="text-sm sm:text-base text-orange-100 leading-relaxed">
                Order your favorite Seafood Bilao Feast or Cajun Boils now. We prepare each platter fresh upon ordering and deliver it hot to your door.
              </p>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={handleOrderOnline}
                  className="bg-white hover:bg-orange-50 text-orange-600 font-bold text-sm sm:text-base px-8 py-4 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Order Now
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
        className={`fixed bottom-6 right-6 z-40 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-lg shadow-orange-500/30 border border-white/25 hover:from-orange-500 hover:to-amber-400 hover:shadow-orange-500/50 hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center group ${
          showScrollTop
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
