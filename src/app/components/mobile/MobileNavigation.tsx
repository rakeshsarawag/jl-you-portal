import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import {
  Home,
  LayoutDashboard,
  MessageSquare,
  Brain,
  User,
  Menu,
  Bell,
  Search
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface MobileNavigationProps {
  unreadMessages?: number;
  notifications?: number;
  onMenuClick?: () => void;
}

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { id: 'communications', label: 'Comms', icon: MessageSquare, path: '/communications' },
  { id: 'ai', label: 'AI', icon: Brain, path: '/ai-intelligence-dashboard' },
  { id: 'more', label: 'More', icon: Menu, path: '/menu' }
];

export function MobileNavigation({ 
  unreadMessages = 0, 
  notifications = 0,
  onMenuClick 
}: MobileNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('home');
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Auto-hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Update active tab based on current route
  useEffect(() => {
    const currentPath = location.pathname;
    const matchedItem = NAV_ITEMS.find(item => 
      item.path === currentPath || (item.path !== '/' && currentPath.startsWith(item.path))
    );
    
    if (matchedItem) {
      setActiveTab(matchedItem.id);
    }
  }, [location]);

  const handleNavClick = (item: typeof NAV_ITEMS[0]) => {
    setActiveTab(item.id);
    
    if (item.id === 'more') {
      onMenuClick?.();
    } else {
      navigate(item.path);
    }
  };

  const getBadgeCount = (id: string) => {
    switch (id) {
      case 'communications':
        return unreadMessages;
      case 'more':
        return notifications;
      default:
        return 0;
    }
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <motion.nav
        initial={{ y: 0 }}
        animate={{ y: isVisible ? 0 : 100 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 md:hidden"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badgeCount = getBadgeCount(item.id);

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {/* Active Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-blue-600 rounded-b-full"
                  />
                )}

                {/* Icon with Badge */}
                <div className="relative">
                  <Icon className={`h-6 w-6 ${isActive ? 'scale-110' : 'scale-100'} transition-transform`} />
                  {badgeCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs min-w-[18px] h-[18px] flex items-center justify-center p-0">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Badge>
                  )}
                </div>

                {/* Label */}
                <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'font-normal'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Safe area for devices with notches */}
        <div className="h-safe-area-inset-bottom bg-white" />
      </motion.nav>

      {/* Spacer to prevent content from being hidden behind nav */}
      <div className="h-16 md:hidden" />
    </>
  );
}

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
  notifications?: number;
}

export function MobileHeader({ 
  title, 
  showBack, 
  onBack,
  actions,
  notifications = 0
}: MobileHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-40 md:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {showBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack || (() => navigate(-1))}
              className="p-2 -ml-2"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Button>
          )}
          
          {title && (
            <h1 className="text-lg font-semibold truncate">{title}</h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          {actions}
          
          <Button variant="ghost" size="sm" className="p-2 relative">
            <Bell className="h-5 w-5" />
            {notifications > 0 && (
              <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs min-w-[18px] h-[18px] flex items-center justify-center p-0">
                {notifications > 99 ? '99+' : notifications}
              </Badge>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}

interface MobileFABProps {
  icon?: React.ReactNode;
  label?: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function MobileFAB({ 
  icon, 
  label = 'Add',
  onClick,
  variant = 'primary'
}: MobileFABProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`fixed bottom-20 right-4 z-40 md:hidden ${
        variant === 'primary'
          ? 'bg-blue-600 hover:bg-blue-700'
          : 'bg-gray-800 hover:bg-gray-900'
      } text-white rounded-full shadow-lg flex items-center gap-2 px-4 py-3`}
    >
      {icon || <span className="text-xl">+</span>}
      <span className="font-medium">{label}</span>
    </motion.button>
  );
}

interface MobileSearchBarProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
}

export function MobileSearchBar({ 
  placeholder = 'Search...',
  value,
  onChange,
  onFocus
}: MobileSearchBarProps) {
  return (
    <div className="sticky top-14 bg-white border-b border-gray-200 p-3 z-30 md:hidden">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export function MobileBottomSheet({ 
  isOpen, 
  onClose, 
  title,
  children,
  maxHeight = '80vh'
}: MobileBottomSheetProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50"
        style={{ maxHeight }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="px-6 pb-3 border-b">
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(80vh - 100px)' }}>
          {children}
        </div>
      </motion.div>
    </>
  );
}

interface MobilePullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function MobilePullToRefresh({ onRefresh, children }: MobilePullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPulling && window.scrollY === 0) {
      const touch = e.touches[0];
      const distance = Math.max(0, touch.clientY - 60);
      setPullDistance(Math.min(distance, 100));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60 && !isRefreshing) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    setIsPulling(false);
    setPullDistance(0);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {(isPulling || isRefreshing) && (
        <div className="flex justify-center pt-4">
          <motion.div
            animate={{ rotate: isRefreshing ? 360 : 0 }}
            transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0 }}
          >
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </motion.div>
        </div>
      )}
      
      {children}
    </div>
  );
}
