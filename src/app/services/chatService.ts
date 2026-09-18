import { toast } from 'sonner';

export type MessageType = 'text' | 'file' | 'image' | 'system' | 'announcement';
export type ChannelType = 'public' | 'private' | 'direct';
export type UserStatus = 'online' | 'away' | 'busy' | 'offline';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: UserStatus;
  lastSeen?: string;
  department?: string;
}

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  type: MessageType;
  content: string;
  timestamp: string;
  edited?: boolean;
  editedAt?: string;
  reactions?: Record<string, string[]>; // emoji -> userIds
  mentions?: string[]; // userIds
  attachments?: Attachment[];
  replyTo?: string; // messageId
  pinned?: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  type: ChannelType;
  avatar?: string;
  members: string[]; // userIds
  admins: string[]; // userIds
  createdBy: string;
  createdAt: string;
  lastActivity: string;
  unreadCount?: number;
  pinned?: boolean;
}

export interface DirectMessage {
  id: string;
  participants: string[]; // 2 userIds
  lastMessage?: Message;
  unreadCount?: number;
  createdAt: string;
}

export interface ActivityFeedItem {
  id: string;
  type: 'user_joined' | 'project_update' | 'document_shared' | 'announcement' | 'achievement';
  userId: string;
  userName: string;
  userAvatar?: string;
  title: string;
  description: string;
  timestamp: string;
  metadata?: any;
  reactions?: Record<string, string[]>;
}

export class ChatService {
  private static channels: Map<string, Channel> = new Map();
  private static messages: Map<string, Message[]> = new Map();
  private static directMessages: Map<string, DirectMessage> = new Map();
  private static users: Map<string, User> = new Map();
  private static activityFeed: ActivityFeedItem[] = [];
  private static currentUserId: string = 'current-user';

  /**
   * Initialize chat service
   */
  static initialize(currentUserId: string) {
    this.currentUserId = currentUserId;
    this.loadFromStorage();
    this.initializeSampleData();
  }

  /**
   * Initialize sample data
   */
  private static initializeSampleData() {
    if (this.channels.size > 0) return;

    // Create sample users
    const sampleUsers: User[] = [
      { id: 'user1', name: 'Alice Johnson', email: 'alice@jeshanlabs.com', status: 'online', department: 'Engineering' },
      { id: 'user2', name: 'Bob Smith', email: 'bob@jeshanlabs.com', status: 'online', department: 'Sales' },
      { id: 'user3', name: 'Carol Davis', email: 'carol@jeshanlabs.com', status: 'away', department: 'Marketing' },
      { id: 'user4', name: 'David Wilson', email: 'david@jeshanlabs.com', status: 'offline', department: 'HR', lastSeen: '2026-03-15T14:30:00Z' },
      { id: 'current-user', name: 'Admin User', email: 'admin@jeshanlabs.com', status: 'online', department: 'Management' },
    ];

    sampleUsers.forEach(user => this.users.set(user.id, user));

    // Create sample channels
    const sampleChannels: Channel[] = [
      {
        id: 'general',
        name: 'general',
        description: 'Company-wide announcements and discussions',
        type: 'public',
        members: ['user1', 'user2', 'user3', 'user4', 'current-user'],
        admins: ['current-user'],
        createdBy: 'current-user',
        createdAt: '2026-01-01T00:00:00Z',
        lastActivity: new Date().toISOString(),
        pinned: true
      },
      {
        id: 'engineering',
        name: 'engineering',
        description: 'Engineering team discussions',
        type: 'public',
        members: ['user1', 'current-user'],
        admins: ['current-user'],
        createdBy: 'current-user',
        createdAt: '2026-01-15T00:00:00Z',
        lastActivity: new Date().toISOString()
      },
      {
        id: 'sales',
        name: 'sales',
        description: 'Sales team coordination',
        type: 'public',
        members: ['user2', 'current-user'],
        admins: ['current-user'],
        createdBy: 'current-user',
        createdAt: '2026-01-20T00:00:00Z',
        lastActivity: new Date().toISOString()
      },
      {
        id: 'leadership',
        name: 'leadership',
        description: 'Leadership team private channel',
        type: 'private',
        members: ['current-user'],
        admins: ['current-user'],
        createdBy: 'current-user',
        createdAt: '2026-02-01T00:00:00Z',
        lastActivity: new Date().toISOString()
      }
    ];

    sampleChannels.forEach(channel => this.channels.set(channel.id, channel));

    // Create sample messages
    this.addSampleMessages();

    // Create sample activity feed
    this.initializeSampleActivityFeed();

    this.saveToStorage();
  }

  /**
   * Add sample messages
   */
  private static addSampleMessages() {
    const generalMessages: Message[] = [
      {
        id: 'msg1',
        channelId: 'general',
        senderId: 'current-user',
        senderName: 'Admin User',
        type: 'announcement',
        content: 'Welcome to Portal Jeshan Labs! 🎉 This is the general channel for company-wide communication.',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        reactions: { '👍': ['user1', 'user2'], '🎉': ['user3'] },
        pinned: true
      },
      {
        id: 'msg2',
        channelId: 'general',
        senderId: 'user1',
        senderName: 'Alice Johnson',
        type: 'text',
        content: 'Excited to be here! Looking forward to working with everyone.',
        timestamp: new Date(Date.now() - 82800000).toISOString(),
        reactions: { '❤️': ['user2', 'user3'] }
      },
      {
        id: 'msg3',
        channelId: 'general',
        senderId: 'user2',
        senderName: 'Bob Smith',
        type: 'text',
        content: 'Just closed a major deal! 🎯',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        reactions: { '🎉': ['user1', 'current-user'], '👏': ['user3'] }
      }
    ];

    const engineeringMessages: Message[] = [
      {
        id: 'msg4',
        channelId: 'engineering',
        senderId: 'user1',
        senderName: 'Alice Johnson',
        type: 'text',
        content: 'Starting work on the new feature deployment. @Admin User can you review the specs?',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        mentions: ['current-user']
      },
      {
        id: 'msg5',
        channelId: 'engineering',
        senderId: 'current-user',
        senderName: 'Admin User',
        type: 'text',
        content: 'Will review by end of day!',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        replyTo: 'msg4'
      }
    ];

    this.messages.set('general', generalMessages);
    this.messages.set('engineering', engineeringMessages);
    this.messages.set('sales', []);
    this.messages.set('leadership', []);
  }

  /**
   * Initialize sample activity feed
   */
  private static initializeSampleActivityFeed() {
    this.activityFeed = [
      {
        id: 'act1',
        type: 'user_joined',
        userId: 'user1',
        userName: 'Alice Johnson',
        title: 'New Team Member',
        description: 'Alice Johnson joined the Engineering team',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        reactions: { '👋': ['user2', 'current-user'] }
      },
      {
        id: 'act2',
        type: 'project_update',
        userId: 'current-user',
        userName: 'Admin User',
        title: 'Portal Enhancement',
        description: 'Added 5 new applications to the portal',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        reactions: { '🚀': ['user1', 'user2', 'user3'] }
      },
      {
        id: 'act3',
        type: 'achievement',
        userId: 'user2',
        userName: 'Bob Smith',
        title: 'Sales Milestone',
        description: 'Reached $500K in quarterly sales!',
        timestamp: new Date(Date.now() - 43200000).toISOString(),
        reactions: { '🎉': ['user1', 'user3', 'current-user'], '💪': ['user1'] }
      },
      {
        id: 'act4',
        type: 'announcement',
        userId: 'current-user',
        userName: 'Admin User',
        title: 'Company Update',
        description: 'All-hands meeting scheduled for Friday at 3 PM',
        timestamp: new Date(Date.now() - 21600000).toISOString()
      }
    ];
  }

  /**
   * Get all channels
   */
  static getAllChannels(): Channel[] {
    return Array.from(this.channels.values()).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });
  }

  /**
   * Get channel by ID
   */
  static getChannel(channelId: string): Channel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Create new channel
   */
  static createChannel(channel: Omit<Channel, 'id' | 'createdAt' | 'lastActivity'>): Channel {
    const newChannel: Channel = {
      ...channel,
      id: `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    this.channels.set(newChannel.id, newChannel);
    this.messages.set(newChannel.id, []);
    this.saveToStorage();
    
    toast.success(`Channel #${newChannel.name} created`);
    return newChannel;
  }

  /**
   * Update channel
   */
  static updateChannel(channelId: string, updates: Partial<Channel>): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      this.channels.set(channelId, { ...channel, ...updates });
      this.saveToStorage();
      toast.success('Channel updated');
    }
  }

  /**
   * Delete channel
   */
  static deleteChannel(channelId: string): void {
    this.channels.delete(channelId);
    this.messages.delete(channelId);
    this.saveToStorage();
    toast.success('Channel deleted');
  }

  /**
   * Get messages for a channel
   */
  static getMessages(channelId: string): Message[] {
    return this.messages.get(channelId) || [];
  }

  /**
   * Send message
   */
  static sendMessage(message: Omit<Message, 'id' | 'timestamp'>): Message {
    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };

    const channelMessages = this.messages.get(message.channelId) || [];
    channelMessages.push(newMessage);
    this.messages.set(message.channelId, channelMessages);

    // Update channel last activity
    const channel = this.channels.get(message.channelId);
    if (channel) {
      channel.lastActivity = newMessage.timestamp;
    }

    this.saveToStorage();
    return newMessage;
  }

  /**
   * Edit message
   */
  static editMessage(messageId: string, channelId: string, newContent: string): void {
    const channelMessages = this.messages.get(channelId);
    if (channelMessages) {
      const message = channelMessages.find(m => m.id === messageId);
      if (message) {
        message.content = newContent;
        message.edited = true;
        message.editedAt = new Date().toISOString();
        this.saveToStorage();
        toast.success('Message updated');
      }
    }
  }

  /**
   * Delete message
   */
  static deleteMessage(messageId: string, channelId: string): void {
    const channelMessages = this.messages.get(channelId);
    if (channelMessages) {
      const filtered = channelMessages.filter(m => m.id !== messageId);
      this.messages.set(channelId, filtered);
      this.saveToStorage();
      toast.success('Message deleted');
    }
  }

  /**
   * Add reaction to message
   */
  static addReaction(messageId: string, channelId: string, emoji: string, userId: string): void {
    const channelMessages = this.messages.get(channelId);
    if (channelMessages) {
      const message = channelMessages.find(m => m.id === messageId);
      if (message) {
        if (!message.reactions) message.reactions = {};
        if (!message.reactions[emoji]) message.reactions[emoji] = [];
        
        if (!message.reactions[emoji].includes(userId)) {
          message.reactions[emoji].push(userId);
          this.saveToStorage();
        }
      }
    }
  }

  /**
   * Remove reaction from message
   */
  static removeReaction(messageId: string, channelId: string, emoji: string, userId: string): void {
    const channelMessages = this.messages.get(channelId);
    if (channelMessages) {
      const message = channelMessages.find(m => m.id === messageId);
      if (message && message.reactions && message.reactions[emoji]) {
        message.reactions[emoji] = message.reactions[emoji].filter(id => id !== userId);
        if (message.reactions[emoji].length === 0) {
          delete message.reactions[emoji];
        }
        this.saveToStorage();
      }
    }
  }

  /**
   * Pin message
   */
  static pinMessage(messageId: string, channelId: string): void {
    const channelMessages = this.messages.get(channelId);
    if (channelMessages) {
      const message = channelMessages.find(m => m.id === messageId);
      if (message) {
        message.pinned = !message.pinned;
        this.saveToStorage();
        toast.success(message.pinned ? 'Message pinned' : 'Message unpinned');
      }
    }
  }

  /**
   * Search messages
   */
  static searchMessages(query: string, channelId?: string): Message[] {
    const allMessages: Message[] = [];
    
    if (channelId) {
      const channelMessages = this.messages.get(channelId) || [];
      allMessages.push(...channelMessages);
    } else {
      this.messages.forEach(messages => allMessages.push(...messages));
    }

    return allMessages.filter(msg => 
      msg.content.toLowerCase().includes(query.toLowerCase()) ||
      msg.senderName.toLowerCase().includes(query.toLowerCase())
    );
  }

  /**
   * Get activity feed
   */
  static getActivityFeed(): ActivityFeedItem[] {
    return this.activityFeed.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Add activity feed item
   */
  static addActivityFeedItem(item: Omit<ActivityFeedItem, 'id' | 'timestamp'>): ActivityFeedItem {
    const newItem: ActivityFeedItem = {
      ...item,
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };

    this.activityFeed.unshift(newItem);
    this.saveToStorage();
    return newItem;
  }

  /**
   * Add reaction to activity feed item
   */
  static addActivityReaction(itemId: string, emoji: string, userId: string): void {
    const item = this.activityFeed.find(i => i.id === itemId);
    if (item) {
      if (!item.reactions) item.reactions = {};
      if (!item.reactions[emoji]) item.reactions[emoji] = [];
      
      if (!item.reactions[emoji].includes(userId)) {
        item.reactions[emoji].push(userId);
        this.saveToStorage();
      }
    }
  }

  /**
   * Get all users
   */
  static getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  /**
   * Get user by ID
   */
  static getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  /**
   * Update user status
   */
  static updateUserStatus(userId: string, status: UserStatus): void {
    const user = this.users.get(userId);
    if (user) {
      user.status = status;
      if (status === 'offline') {
        user.lastSeen = new Date().toISOString();
      }
      this.saveToStorage();
    }
  }

  /**
   * Get online users
   */
  static getOnlineUsers(): User[] {
    return Array.from(this.users.values()).filter(u => u.status === 'online');
  }

  /**
   * Get unread message count
   */
  static getUnreadCount(channelId: string): number {
    const channel = this.channels.get(channelId);
    return channel?.unreadCount || 0;
  }

  /**
   * Mark channel as read
   */
  static markAsRead(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.unreadCount = 0;
      this.saveToStorage();
    }
  }

  /**
   * Get pinned messages
   */
  static getPinnedMessages(channelId: string): Message[] {
    const channelMessages = this.messages.get(channelId) || [];
    return channelMessages.filter(m => m.pinned);
  }

  /**
   * Join channel
   */
  static joinChannel(channelId: string, userId: string): void {
    const channel = this.channels.get(channelId);
    if (channel && !channel.members.includes(userId)) {
      channel.members.push(userId);
      this.saveToStorage();
      toast.success(`Joined #${channel.name}`);
    }
  }

  /**
   * Leave channel
   */
  static leaveChannel(channelId: string, userId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.members = channel.members.filter(id => id !== userId);
      this.saveToStorage();
      toast.success(`Left #${channel.name}`);
    }
  }

  /**
   * Save to localStorage
   */
  private static saveToStorage(): void {
    try {
      localStorage.setItem('chat_channels', JSON.stringify(Array.from(this.channels.entries())));
      localStorage.setItem('chat_messages', JSON.stringify(Array.from(this.messages.entries())));
      localStorage.setItem('chat_users', JSON.stringify(Array.from(this.users.entries())));
      localStorage.setItem('activity_feed', JSON.stringify(this.activityFeed));
    } catch (error) {
      console.error('Error saving chat data:', error);
    }
  }

  /**
   * Load from localStorage
   */
  private static loadFromStorage(): void {
    try {
      const channelsData = localStorage.getItem('chat_channels');
      if (channelsData) {
        this.channels = new Map(JSON.parse(channelsData));
      }

      const messagesData = localStorage.getItem('chat_messages');
      if (messagesData) {
        this.messages = new Map(JSON.parse(messagesData));
      }

      const usersData = localStorage.getItem('chat_users');
      if (usersData) {
        this.users = new Map(JSON.parse(usersData));
      }

      const activityData = localStorage.getItem('activity_feed');
      if (activityData) {
        this.activityFeed = JSON.parse(activityData);
      }
    } catch (error) {
      console.error('Error loading chat data:', error);
    }
  }
}
