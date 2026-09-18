import { toast } from 'sonner';

export interface PWAInstallPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type ConnectionStatus = 'online' | 'offline' | 'slow';

export class PWAService {
  private static installPrompt: PWAInstallPrompt | null = null;
  private static isStandalone = false;
  private static connectionStatus: ConnectionStatus = 'online';
  private static listeners: Set<(status: ConnectionStatus) => void> = new Set();

  /**
   * Initialize PWA service
   */
  static initialize() {
    this.checkStandalone();
    this.setupInstallPrompt();
    this.setupConnectionMonitoring();
    this.registerServiceWorker();
  }

  /**
   * Check if app is running in standalone mode
   */
  private static checkStandalone() {
    this.isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');
  }

  /**
   * Setup install prompt listener
   */
  private static setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.installPrompt = e as any;
      
      // Show install notification after 30 seconds if not installed
      setTimeout(() => {
        if (!this.isInstalled()) {
          toast.info('Install Portal Jeshan Labs', {
            description: 'Add to home screen for quick access',
            action: {
              label: 'Install',
              onClick: () => this.showInstallPrompt()
            },
            duration: 10000
          });
        }
      }, 30000);
    });

    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      toast.success('App installed successfully!', {
        description: 'You can now access Portal Jeshan Labs from your home screen'
      });
    });
  }

  /**
   * Setup connection monitoring
   */
  private static setupConnectionMonitoring() {
    // Monitor online/offline
    window.addEventListener('online', () => {
      this.updateConnectionStatus('online');
      toast.success('Back online', {
        description: 'Your connection has been restored'
      });
    });

    window.addEventListener('offline', () => {
      this.updateConnectionStatus('offline');
      toast.error('You are offline', {
        description: 'Some features may be limited'
      });
    });

    // Monitor connection quality
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const checkConnectionQuality = () => {
        if (!navigator.onLine) {
          this.updateConnectionStatus('offline');
        } else if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
          this.updateConnectionStatus('slow');
        } else {
          this.updateConnectionStatus('online');
        }
      };

      connection.addEventListener('change', checkConnectionQuality);
      checkConnectionQuality();
    }

    // Initial status
    this.updateConnectionStatus(navigator.onLine ? 'online' : 'offline');
  }

  /**
   * Update connection status and notify listeners
   */
  private static updateConnectionStatus(status: ConnectionStatus) {
    this.connectionStatus = status;
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * Subscribe to connection status changes
   */
  static onConnectionChange(listener: (status: ConnectionStatus) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current status
    listener(this.connectionStatus);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current connection status
   */
  static getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Register service worker
   */
  private static async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // Check if service worker file exists first
        const response = await fetch('/sw.js', { method: 'HEAD' });
        
        if (!response.ok) {
          console.log('Service worker file not available, skipping registration');
          return;
        }

        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });

        console.log('Service Worker registered:', registration);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                toast.info('Update available', {
                  description: 'A new version is ready',
                  action: {
                    label: 'Refresh',
                    onClick: () => window.location.reload()
                  },
                  duration: Infinity
                });
              }
            });
          }
        });
      } catch (error) {
        // Service worker registration failed - this is OK, app will work without it
        console.log('Service Worker not available in this environment');
      }
    }
  }

  /**
   * Show install prompt
   */
  static async showInstallPrompt(): Promise<boolean> {
    if (!this.installPrompt) {
      if (this.isInstalled()) {
        toast.info('Already installed', {
          description: 'The app is already installed on your device'
        });
      } else if (this.isIOS()) {
        toast.info('Install on iOS', {
          description: 'Tap the Share button and select "Add to Home Screen"',
          duration: 10000
        });
      } else {
        toast.error('Installation not available', {
          description: 'Your browser doesn\'t support app installation'
        });
      }
      return false;
    }

    try {
      await this.installPrompt.prompt();
      const { outcome } = await this.installPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        return true;
      } else {
        console.log('User dismissed the install prompt');
        return false;
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
      return false;
    }
  }

  /**
   * Check if app can be installed
   */
  static canInstall(): boolean {
    return this.installPrompt !== null || this.isIOS();
  }

  /**
   * Check if app is installed
   */
  static isInstalled(): boolean {
    return this.isStandalone;
  }

  /**
   * Check if device is iOS
   */
  static isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }

  /**
   * Check if device is mobile
   */
  static isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth < 768;
  }

  /**
   * Request notification permission
   */
  static async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      toast.error('Notifications not supported', {
        description: 'Your browser doesn\'t support notifications'
      });
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      toast.error('Notifications blocked', {
        description: 'Please enable notifications in your browser settings'
      });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        toast.success('Notifications enabled', {
          description: 'You\'ll receive important updates'
        });
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Show notification
   */
  static showNotification(title: string, options?: NotificationOptions) {
    if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
          badge: '/icons/icon-96x96.png',
          icon: '/icons/icon-192x192.png',
          ...options
        });
      });
    }
  }

  /**
   * Cache important data for offline use
   */
  static async cacheData(key: string, data: any): Promise<void> {
    try {
      if ('caches' in window) {
        const cache = await caches.open('jeshan-portal-data');
        const response = new Response(JSON.stringify(data));
        await cache.put(`/data/${key}`, response);
      } else {
        // Fallback to localStorage
        localStorage.setItem(`offline_${key}`, JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  /**
   * Get cached data
   */
  static async getCachedData(key: string): Promise<any | null> {
    try {
      if ('caches' in window) {
        const cache = await caches.open('jeshan-portal-data');
        const response = await cache.match(`/data/${key}`);
        
        if (response) {
          return await response.json();
        }
      } else {
        // Fallback to localStorage
        const data = localStorage.getItem(`offline_${key}`);
        return data ? JSON.parse(data) : null;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  /**
   * Get app info
   */
  static getAppInfo() {
    return {
      isInstalled: this.isInstalled(),
      canInstall: this.canInstall(),
      isMobile: this.isMobile(),
      isIOS: this.isIOS(),
      connectionStatus: this.connectionStatus,
      notificationPermission: 'Notification' in window ? Notification.permission : 'unsupported'
    };
  }

  /**
   * Share content (if Web Share API is supported)
   */
  static async share(data: { title?: string; text?: string; url?: string }): Promise<boolean> {
    if (!navigator.share) {
      // Fallback: copy to clipboard
      if (data.url) {
        await navigator.clipboard.writeText(data.url);
        toast.success('Link copied to clipboard');
        return true;
      }
      return false;
    }

    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing:', error);
      }
      return false;
    }
  }

  /**
   * Get battery status (if supported)
   */
  static async getBatteryStatus(): Promise<{
    level: number;
    charging: boolean;
  } | null> {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        return {
          level: battery.level * 100,
          charging: battery.charging
        };
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  /**
   * Enable wake lock (prevent screen from sleeping)
   */
  static async enableWakeLock(): Promise<(() => void) | null> {
    if ('wakeLock' in navigator) {
      try {
        const wakeLock = await (navigator as any).wakeLock.request('screen');
        
        return () => {
          wakeLock.release();
        };
      } catch (error) {
        console.error('Wake lock error:', error);
        return null;
      }
    }
    return null;
  }
}