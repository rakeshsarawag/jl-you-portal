import { toast } from 'sonner';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'approval';
export type NotificationChannel = 'in_app' | 'email' | 'both';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  channel: NotificationChannel;
  recipients: string[];
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: any;
  createdAt: string;
  readAt?: string;
}

export class NotificationService {
  private static notifications: Map<string, Notification> = new Map();
  private static listeners: Set<() => void> = new Set();

  /**
   * Send a notification
   */
  static sendNotification(notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): Notification {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      read: false,
      createdAt: new Date().toISOString()
    };

    this.notifications.set(id, newNotification);
    this.saveToStorage();
    this.notifyListeners();

    // Show toast for in-app notifications
    if (notification.channel === 'in_app' || notification.channel === 'both') {
      this.showToast(newNotification);
    }

    // In a real app, send email here
    if (notification.channel === 'email' || notification.channel === 'both') {
      this.sendEmail(newNotification);
    }

    return newNotification;
  }

  /**
   * Show toast notification
   */
  private static showToast(notification: Notification): void {
    const toastConfig = {
      description: notification.message,
      action: notification.actionUrl ? {
        label: notification.actionLabel || 'View',
        onClick: () => window.location.href = notification.actionUrl!
      } : undefined
    };

    switch (notification.type) {
      case 'success':
        toast.success(notification.title, toastConfig);
        break;
      case 'error':
        toast.error(notification.title, toastConfig);
        break;
      case 'warning':
        toast.warning(notification.title, toastConfig);
        break;
      case 'approval':
      case 'info':
      default:
        toast.info(notification.title, toastConfig);
        break;
    }
  }

  /**
   * Send email notification (placeholder)
   */
  private static sendEmail(notification: Notification): void {
    // In a real app, this would call an email API
    console.log('Email notification:', {
      to: notification.recipients,
      subject: notification.title,
      body: notification.message
    });
  }

  /**
   * Get all notifications for a user
   */
  static getNotifications(userId: string, unreadOnly: boolean = false): Notification[] {
    const userNotifications = Array.from(this.notifications.values())
      .filter(n => n.recipients.includes(userId))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (unreadOnly) {
      return userNotifications.filter(n => !n.read);
    }

    return userNotifications;
  }

  /**
   * Mark notification as read
   */
  static markAsRead(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      notification.readAt = new Date().toISOString();
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Mark all as read for a user
   */
  static markAllAsRead(userId: string): void {
    let updated = false;
    this.notifications.forEach(notification => {
      if (notification.recipients.includes(userId) && !notification.read) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
        updated = true;
      }
    });

    if (updated) {
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Delete notification
   */
  static deleteNotification(notificationId: string): void {
    if (this.notifications.delete(notificationId)) {
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Get unread count for a user
   */
  static getUnreadCount(userId: string): number {
    return Array.from(this.notifications.values())
      .filter(n => n.recipients.includes(userId) && !n.read)
      .length;
  }

  /**
   * Subscribe to notification updates
   */
  static subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  private static notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }

  /**
   * Send approval notification
   */
  static sendApprovalNotification(
    approver: string,
    workflowName: string,
    message: string,
    approvalId: string
  ): Notification {
    return this.sendNotification({
      type: 'approval',
      title: 'Approval Request',
      message: `${workflowName}: ${message}`,
      channel: 'both',
      recipients: [approver],
      actionUrl: `/workflows/approvals/${approvalId}`,
      actionLabel: 'Review',
      metadata: { approvalId, workflowName }
    });
  }

  /**
   * Send workflow completion notification
   */
  static sendWorkflowCompletionNotification(
    userId: string,
    workflowName: string,
    status: 'completed' | 'failed'
  ): Notification {
    return this.sendNotification({
      type: status === 'completed' ? 'success' : 'error',
      title: `Workflow ${status === 'completed' ? 'Completed' : 'Failed'}`,
      message: `${workflowName} has ${status}`,
      channel: 'both',
      recipients: [userId],
      actionUrl: '/workflows',
      actionLabel: 'View Workflows'
    });
  }

  /**
   * Save to localStorage
   */
  private static saveToStorage(): void {
    try {
      localStorage.setItem('notifications', JSON.stringify(Array.from(this.notifications.entries())));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  }

  /**
   * Load from localStorage
   */
  static loadFromStorage(): void {
    try {
      const data = localStorage.getItem('notifications');
      if (data) {
        this.notifications = new Map(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }
}

// Load data on initialization
NotificationService.loadFromStorage();
