/**
 * useUserManagement Hook
 * Manage users and role assignments
 */

import { useState, useEffect } from 'react';
import { UserWithRole, UserRole } from '../../types/rbac';
import { getPrimaryRole } from '../../utils/rbac/permissionChecker';
import { projectId, publicAnonKey, safeJson, apiHeaders } from '../utils/constants';
import { toast } from 'sonner';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-1fe2c468`;

export function useUserManagement(userEmail?: string) {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/users`, {
        headers: apiHeaders(userEmail),
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await safeJson(response);
      setUsers(data?.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Create new user
  const createUser = async (userData: {
    name: string;
    email: string;
    department?: string;
    roles: UserRole[];
  }): Promise<boolean> => {
    try {
      const newUser: UserWithRole = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: userData.email,
        name: userData.name,
        roles: userData.roles,
        primaryRole: getPrimaryRole(userData.roles),
        department: userData.department,
        status: 'active',
        createdAt: new Date().toISOString(),
      };

      const response = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: apiHeaders(userEmail),
        body: JSON.stringify(newUser),
      });

      if (!response.ok) throw new Error('Failed to create user');

      await fetchUsers(); // Refresh list
      return true;
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
      return false;
    }
  };

  // Update user
  const updateUser = async (
    userId: string,
    updates: Partial<UserWithRole>
  ): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'PUT',
        headers: apiHeaders(userEmail),
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update user');

      await fetchUsers(); // Refresh list
      return true;
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
      return false;
    }
  };

  // Delete user
  const deleteUser = async (userId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/users/${userId}`, {
        method: 'DELETE',
        headers: apiHeaders(userEmail),
      });

      if (!response.ok) throw new Error('Failed to delete user');

      await fetchUsers(); // Refresh list
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
      return false;
    }
  };

  // Assign roles to user
  const assignRoles = async (userId: string, roles: UserRole[]): Promise<boolean> => {
    try {
      const primaryRole = getPrimaryRole(roles);

      const response = await fetch(`${API_BASE}/users/${userId}/roles`, {
        method: 'PUT',
        headers: apiHeaders(userEmail),
        body: JSON.stringify({ roles, primaryRole }),
      });

      if (!response.ok) throw new Error('Failed to assign roles');

      await fetchUsers(); // Refresh list
      return true;
    } catch (error) {
      console.error('Error assigning roles:', error);
      toast.error('Failed to assign roles');
      return false;
    }
  };

  // Toggle user status (active/inactive)
  const toggleUserStatus = async (userId: string): Promise<boolean> => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return false;

      const newStatus = user.status === 'active' ? 'inactive' : 'active';

      const response = await fetch(`${API_BASE}/users/${userId}/status`, {
        method: 'PUT',
        headers: apiHeaders(userEmail),
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to toggle user status');

      await fetchUsers(); // Refresh list
      toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
      return true;
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('Failed to toggle user status');
      return false;
    }
  };

  return {
    users,
    loading,
    createUser,
    updateUser,
    deleteUser,
    assignRoles,
    toggleUserStatus,
    refreshUsers: fetchUsers,
  };
}
