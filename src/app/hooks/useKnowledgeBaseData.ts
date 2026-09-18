import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';

const KB_URL = `${API_BASE}/knowledge`;

function api(path: string, options: RequestInit = {}, userEmail?: string) {
  return fetch(`${KB_URL}${path}`, {
    ...options,
    headers: apiHeaders(userEmail),
  });
}

export interface Article {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  category: string;
  tags: string[];
  author: string;
  author_id?: string;
  status: 'Draft' | 'Published' | 'Archived';
  featured?: boolean;
  view_count?: number;
  like_count?: number;
  views?: number;
  likes?: number;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  article_count?: number;
  articleCount?: number;
}

export interface KBStats {
  total_articles?: number;
  totalArticles?: number;
  total_views?: number;
  totalViews?: number;
  total_likes?: number;
  totalLikes?: number;
  most_viewed?: Article[];
  mostViewed?: Article[];
  most_liked?: Article[];
  mostLiked?: Article[];
  by_category?: { category: string; count: number }[];
  byCategory?: { category: string; count: number }[];
}

export interface ArticleFilters {
  category?: string;
  tag?: string;
  search?: string;
}

export function useKnowledgeBaseData(userEmail?: string) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<KBStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchArticles = useCallback(async (filters?: ArticleFilters) => {
    try {
      const params = new URLSearchParams();
      if (filters?.category) params.set('category', filters.category);
      if (filters?.tag) params.set('tag', filters.tag);
      if (filters?.search) params.set('search', filters.search);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await api(`/articles${qs}`, {}, userEmail);
      const data = await safeJson(res);
      if (data?.success) setArticles(data.data);
    } catch (err) {
      console.error('Error fetching articles:', err);
    }
  }, []);

  const getArticle = useCallback(async (id: string): Promise<Article | null> => {
    try {
      const res = await api(`/articles/${id}`, {}, userEmail);
      const data = await safeJson(res);
      if (data?.success) {
        setArticles(prev => prev.map(a => a.id === id ? data.data : a));
        return data.data;
      }
      return null;
    } catch (err) {
      console.error('Error fetching article:', err);
      throw err;
    }
  }, []);

  const createArticle = useCallback(async (articleData: Partial<Article>): Promise<Article | null> => {
    try {
      const res = await api('/articles/create', {
        method: 'POST',
        body: JSON.stringify(articleData),
      }, userEmail);
      const data = await safeJson(res);
      if (data?.success) {
        setArticles(prev => [data.data, ...prev]);
        toast.success('Article created successfully');
        return data.data;
      }
      toast.error(data?.error ?? 'Failed to create article');
      return null;
    } catch (err) {
      toast.error('Failed to create article');
      throw err;
    }
  }, []);

  const updateArticle = useCallback(async (id: string, updates: Partial<Article>): Promise<Article | null> => {
    try {
      const res = await api('/articles/update', {
        method: 'POST',
        body: JSON.stringify({ id, ...updates }),
      }, userEmail);
      const data = await safeJson(res);
      if (data?.success) {
        setArticles(prev => prev.map(a => a.id === id ? data.data : a));
        toast.success('Article updated');
        return data.data;
      }
      toast.error(data?.error ?? 'Failed to update article');
      return null;
    } catch (err) {
      toast.error('Failed to update article');
      throw err;
    }
  }, []);

  const deleteArticle = useCallback(async (id: string): Promise<void> => {
    try {
      await api(`/articles/${id}`, { method: 'DELETE' }, userEmail);
      setArticles(prev => prev.filter(a => a.id !== id));
      toast.success('Article deleted');
    } catch (err) {
      toast.error('Failed to delete article');
      throw err;
    }
  }, []);

  const likeArticle = useCallback(async (id: string): Promise<Article | null> => {
    try {
      const res = await api(`/articles/${id}/like`, { method: 'POST' }, userEmail);
      const data = await safeJson(res);
      if (data?.success) {
        setArticles(prev => prev.map(a => a.id === id ? data.data : a));
        return data.data;
      }
      return null;
    } catch (err) {
      console.error('Error liking article:', err);
      throw err;
    }
  }, []);

  const searchArticles = useCallback(async (query: string): Promise<Article[]> => {
    try {
      const res = await api(`/search?q=${encodeURIComponent(query)}`, {}, userEmail);
      const data = await safeJson(res);
      if (data?.success) return data.data;
      return [];
    } catch (err) {
      console.error('Error searching articles:', err);
      return [];
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api('/categories', {}, userEmail);
      const data = await safeJson(res);
      if (data?.success) setCategories(data.data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api('/stats', {}, userEmail);
      const data = await safeJson(res);
      if (data?.success) setStats(data.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.allSettled([fetchArticles(), fetchCategories(), fetchStats()]);
    } finally {
      setLoading(false);
    }
  }, [fetchArticles, fetchCategories, fetchStats]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    articles,
    categories,
    stats,
    loading,
    fetchArticles,
    getArticle,
    createArticle,
    updateArticle,
    deleteArticle,
    likeArticle,
    searchArticles,
    fetchCategories,
    fetchStats,
    refresh,
  };
}
