import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PWAService, ConnectionStatus } from '../../services/pwaService';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Wifi,
  WifiOff,
  Download,
  Smartphone,
  Battery,
  BatteryCharging,
  X,
  Bell,
  Globe,
  Share2
} from 'lucide-react';
import { toast } from 'sonner';

export function PWAStatus() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('online');
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [appInfo, setAppInfo] = useState(PWAService.getAppInfo());
  const [batteryStatus, setBatteryStatus] = useState<{ level: number; charging: boolean } | null>(null);

  useEffect(() => {
    // Initialize PWA service
    PWAService.initialize();

    // Subscribe to connection changes
    const unsubscribe = PWAService.onConnectionChange((status) => {
      setConnectionStatus(status);
    });

    // Check if we should show install banner
    setTimeout(() => {
      const info = PWAService.getAppInfo();
      setAppInfo(info);
      
      if (info.canInstall && !info.isInstalled) {
        setShowInstallBanner(true);
      }
    }, 5000);

    // Get battery status
    PWAService.getBatteryStatus().then(status => {
      setBatteryStatus(status);
    });

    return unsubscribe;
  }, []);

  const handleInstall = async () => {
    const installed = await PWAService.showInstallPrompt();
    if (installed) {
      setShowInstallBanner(false);
      setAppInfo(PWAService.getAppInfo());
    }
  };

  const handleEnableNotifications = async () => {
    const enabled = await PWAService.requestNotificationPermission();
    if (enabled) {
      setAppInfo(PWAService.getAppInfo());
    }
  };

  const handleShare = async () => {
    await PWAService.share({
      title: 'Portal Jeshan Labs',
      text: 'Check out this amazing enterprise portal!',
      url: window.location.origin
    });
  };

  return (
    <>
      {/* Connection Status Indicator */}
      <AnimatePresence>
        {connectionStatus !== 'online' && (
          <motion.div
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="fixed top-0 left-0 right-0 z-50"
          >
            <div className={`${
              connectionStatus === 'offline' 
                ? 'bg-red-600' 
                : 'bg-yellow-600'
            } text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2`}>
              {connectionStatus === 'offline' ? (
                <>
                  <WifiOff className="h-4 w-4" />
                  You are offline - Some features may be limited
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4" />
                  Slow connection detected
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Install Banner */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-20 left-4 right-4 z-40 md:bottom-4"
          >
            <Card className="shadow-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Smartphone className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      Install Portal App
                    </h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Install our app for faster access and offline support
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={handleInstall} size="sm" className="bg-blue-600 hover:bg-blue-700">
                        <Download className="h-4 w-4 mr-1" />
                        Install
                      </Button>
                      <Button 
                        onClick={() => setShowInstallBanner(false)} 
                        size="sm" 
                        variant="outline"
                      >
                        Later
                      </Button>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowInstallBanner(false)}
                    variant="ghost"
                    size="sm"
                    className="p-1 -mt-1 -mr-1"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Info Badge (only show on mobile) */}
      {PWAService.isMobile() && (
        <div className="fixed top-4 right-4 z-30 md:hidden">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex flex-col gap-2"
          >
            {/* Connection Badge */}
            <Badge
              variant={connectionStatus === 'online' ? 'default' : 'destructive'}
              className="flex items-center gap-1"
            >
              {connectionStatus === 'online' ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              {connectionStatus === 'online' ? 'Online' : 'Offline'}
            </Badge>

            {/* Battery Badge */}
            {batteryStatus && (
              <Badge
                variant={batteryStatus.charging ? 'default' : 'outline'}
                className="flex items-center gap-1"
              >
                {batteryStatus.charging ? (
                  <BatteryCharging className="h-3 w-3" />
                ) : (
                  <Battery className="h-3 w-3" />
                )}
                {Math.round(batteryStatus.level)}%
              </Badge>
            )}

            {/* Installed Badge */}
            {appInfo.isInstalled && (
              <Badge className="bg-green-600 flex items-center gap-1">
                <Smartphone className="h-3 w-3" />
                Installed
              </Badge>
            )}
          </motion.div>
        </div>
      )}
    </>
  );
}

interface PWASettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PWASettingsPanel({ isOpen, onClose }: PWASettingsPanelProps) {
  const [appInfo, setAppInfo] = useState(PWAService.getAppInfo());

  const handleInstall = async () => {
    const installed = await PWAService.showInstallPrompt();
    if (installed) {
      setAppInfo(PWAService.getAppInfo());
    }
  };

  const handleEnableNotifications = async () => {
    const enabled = await PWAService.requestNotificationPermission();
    if (enabled) {
      setAppInfo(PWAService.getAppInfo());
    }
  };

  const handleShare = async () => {
    await PWAService.share({
      title: 'Portal Jeshan Labs',
      text: 'Enterprise portal with 24+ integrated applications',
      url: window.location.origin
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">PWA Settings</h3>
              <Button onClick={onClose} variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Install App */}
              {!appInfo.isInstalled && appInfo.canInstall && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Download className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">Install App</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Add to home screen for quick access
                      </p>
                      <Button onClick={handleInstall} size="sm">
                        Install Now
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {appInfo.isInstalled && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">App Installed</span>
                  </div>
                </div>
              )}

              {/* Enable Notifications */}
              {appInfo.notificationPermission !== 'granted' && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Bell className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">Enable Notifications</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Get important updates and alerts
                      </p>
                      <Button onClick={handleEnableNotifications} size="sm" variant="outline">
                        Enable
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Connection Status */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">Connection Status</span>
                  <Badge variant={appInfo.connectionStatus === 'online' ? 'default' : 'destructive'}>
                    {appInfo.connectionStatus === 'online' ? (
                      <><Wifi className="h-3 w-3 mr-1" /> Online</>
                    ) : (
                      <><WifiOff className="h-3 w-3 mr-1" /> Offline</>
                    )}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  {appInfo.connectionStatus === 'online' 
                    ? 'All features available'
                    : 'Limited functionality - Cached data only'
                  }
                </p>
              </div>

              {/* Share App */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Share2 className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">Share App</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Invite colleagues to use the portal
                    </p>
                    <Button onClick={handleShare} size="sm" variant="outline">
                      Share Link
                    </Button>
                  </div>
                </div>
              </div>

              {/* Device Info */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">Device Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Platform:</span>
                    <span className="font-medium">
                      {appInfo.isMobile ? 'Mobile' : 'Desktop'}
                      {appInfo.isIOS && ' (iOS)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Installed:</span>
                    <span className="font-medium">
                      {appInfo.isInstalled ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Notifications:</span>
                    <span className="font-medium capitalize">
                      {appInfo.notificationPermission}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
