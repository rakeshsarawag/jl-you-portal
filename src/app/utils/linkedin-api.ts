import { projectId, publicAnonKey } from '../utils/constants';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468/linkedin`;

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${publicAnonKey}`,
});

// ============ POSTS API ============

export async function getPosts() {
  try {
    const response = await fetch(`${API_BASE}/posts`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch posts');
    return await response.json();
  } catch (error) {
    console.error('Error fetching LinkedIn posts:', error);
    throw error;
  }
}

export async function createPost(post: any) {
  try {
    const response = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(post),
    });
    if (!response.ok) throw new Error('Failed to create post');
    return await response.json();
  } catch (error) {
    console.error('Error creating LinkedIn post:', error);
    throw error;
  }
}

export async function updatePost(id: string, post: any) {
  try {
    const response = await fetch(`${API_BASE}/posts/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(post),
    });
    if (!response.ok) throw new Error('Failed to update post');
    return await response.json();
  } catch (error) {
    console.error('Error updating LinkedIn post:', error);
    throw error;
  }
}

export async function deletePost(id: string) {
  try {
    const response = await fetch(`${API_BASE}/posts/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete post');
    return await response.json();
  } catch (error) {
    console.error('Error deleting LinkedIn post:', error);
    throw error;
  }
}

export async function getPostById(id: string) {
  try {
    const response = await fetch(`${API_BASE}/posts/${id}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch post');
    return await response.json();
  } catch (error) {
    console.error('Error fetching LinkedIn post:', error);
    throw error;
  }
}

// ============ TEMPLATES API ============

export async function getTemplates() {
  try {
    const response = await fetch(`${API_BASE}/templates`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch templates');
    return await response.json();
  } catch (error) {
    console.error('Error fetching LinkedIn templates:', error);
    throw error;
  }
}

export async function createTemplate(template: any) {
  try {
    const response = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(template),
    });
    if (!response.ok) throw new Error('Failed to create template');
    return await response.json();
  } catch (error) {
    console.error('Error creating LinkedIn template:', error);
    throw error;
  }
}

export async function updateTemplate(id: string, template: any) {
  try {
    const response = await fetch(`${API_BASE}/templates/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(template),
    });
    if (!response.ok) throw new Error('Failed to update template');
    return await response.json();
  } catch (error) {
    console.error('Error updating LinkedIn template:', error);
    throw error;
  }
}

export async function deleteTemplate(id: string) {
  try {
    const response = await fetch(`${API_BASE}/templates/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete template');
    return await response.json();
  } catch (error) {
    console.error('Error deleting LinkedIn template:', error);
    throw error;
  }
}

// ============ EVENTS API ============

export async function getEvents() {
  try {
    const response = await fetch(`${API_BASE}/events`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch events');
    return await response.json();
  } catch (error) {
    console.error('Error fetching LinkedIn events:', error);
    throw error;
  }
}

export async function createEvent(event: any) {
  try {
    const response = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(event),
    });
    if (!response.ok) throw new Error('Failed to create event');
    return await response.json();
  } catch (error) {
    console.error('Error creating LinkedIn event:', error);
    throw error;
  }
}

export async function updateEvent(id: string, event: any) {
  try {
    const response = await fetch(`${API_BASE}/events/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(event),
    });
    if (!response.ok) throw new Error('Failed to update event');
    return await response.json();
  } catch (error) {
    console.error('Error updating LinkedIn event:', error);
    throw error;
  }
}

export async function deleteEvent(id: string) {
  try {
    const response = await fetch(`${API_BASE}/events/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete event');
    return await response.json();
  } catch (error) {
    console.error('Error deleting LinkedIn event:', error);
    throw error;
  }
}

// ============ ANALYTICS API ============

export async function getAnalytics() {
  try {
    const response = await fetch(`${API_BASE}/analytics`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch analytics');
    return await response.json();
  } catch (error) {
    console.error('Error fetching LinkedIn analytics:', error);
    throw error;
  }
}

export async function updateAnalytics(analytics: any) {
  try {
    const response = await fetch(`${API_BASE}/analytics`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(analytics),
    });
    if (!response.ok) throw new Error('Failed to update analytics');
    return await response.json();
  } catch (error) {
    console.error('Error updating LinkedIn analytics:', error);
    throw error;
  }
}

// ============ HASHTAGS API ============

export async function getHashtags() {
  try {
    const response = await fetch(`${API_BASE}/hashtags`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch hashtags');
    return await response.json();
  } catch (error) {
    console.error('Error fetching LinkedIn hashtags:', error);
    throw error;
  }
}

export async function saveHashtag(hashtag: any) {
  try {
    const response = await fetch(`${API_BASE}/hashtags`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(hashtag),
    });
    if (!response.ok) throw new Error('Failed to save hashtag');
    return await response.json();
  } catch (error) {
    console.error('Error saving LinkedIn hashtag:', error);
    throw error;
  }
}

// ============ SETTINGS API ============

export async function getSettings() {
  try {
    const response = await fetch(`${API_BASE}/settings`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch settings');
    return await response.json();
  } catch (error) {
    console.error('Error fetching LinkedIn settings:', error);
    throw error;
  }
}

export async function updateSettings(settings: any) {
  try {
    const response = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error('Failed to update settings');
    return await response.json();
  } catch (error) {
    console.error('Error updating LinkedIn settings:', error);
    throw error;
  }
}

// ============ FOLLOWER GROWTH API ============

export async function getFollowerGrowth() {
  try {
    const response = await fetch(`${API_BASE}/follower-growth`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch follower growth');
    return await response.json();
  } catch (error) {
    console.error('Error fetching LinkedIn follower growth:', error);
    throw error;
  }
}

export async function updateFollowerGrowth(growth: any) {
  try {
    const response = await fetch(`${API_BASE}/follower-growth`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(growth),
    });
    if (!response.ok) throw new Error('Failed to update follower growth');
    return await response.json();
  } catch (error) {
    console.error('Error updating LinkedIn follower growth:', error);
    throw error;
  }
}

// ============ STATS API ============

export async function getStats() {
  try {
    const response = await fetch(`${API_BASE}/stats`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch stats');
    return await response.json();
  } catch (error) {
    console.error('Error fetching LinkedIn stats:', error);
    throw error;
  }
}

// ============ INIT DATA API ============

export async function initializeData() {
  try {
    const response = await fetch(`${API_BASE}/init-data`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to initialize data');
    return await response.json();
  } catch (error) {
    console.error('Error initializing LinkedIn data:', error);
    throw error;
  }
}
