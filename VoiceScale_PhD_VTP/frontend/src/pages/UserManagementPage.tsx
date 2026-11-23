import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggleBtn } from '../contexts/ThemeContext';
import { useToast } from '../components/ToastProvider';
import { useModal } from '../components/ModalProvider';
import { adminApi } from '../api/client';
import './UserManagementPage.css';

interface User {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { openModal, closeModal } = useModal();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('Fetching users using adminApi...');
      
      const response = await adminApi.getUsers();
      console.log('Users data:', response.data);
      setUsers(response.data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      patient: { label: 'Patient', color: 'var(--blue)' },
      doctor: { label: 'Doctor', color: 'var(--purple)' },
      asha: { label: 'ASHA Worker', color: 'var(--teal)' },
      admin: { label: 'Admin', color: 'var(--amber)' },
    };

    const config = roleConfig[role as keyof typeof roleConfig] || { label: role, color: 'var(--gray)' };

    return (
      <span
        className="user-role-badge"
        style={{ backgroundColor: config.color + '20', color: config.color }}
      >
        {config.label}
      </span>
    );
  };

  const handleEditRole = (user: User) => {
    openModal(
      `Change Role for ${user.full_name}`,
      'Select a new role for this user',
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="vc-form-group">
          <label>Current Role</label>
          <div style={{ padding: '8px 12px', background: 'var(--bg3)', borderRadius: 6, fontWeight: 500 }}>
            {getRoleBadge(user.role)}
          </div>
        </div>
        <div className="vc-form-group">
          <label>New Role</label>
          <select defaultValue={user.role} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }}>
            <option value="patient">Patient</option>
            <option value="doctor">Doctor</option>
            <option value="asha">ASHA Worker</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>,
      <>
        <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={closeModal}>
          <i className="bi-x" /> Cancel
        </button>
        <button 
          className="vc-btn vc-btn-teal vc-btn-sm" 
          onClick={() => {
            closeModal();
            showToast(`Role updated for ${user.full_name}`, 'var(--teal)', 'bi-person-gear');
          }}
        >
          <i className="bi-check2" /> Update Role
        </button>
      </>
    );
  };

  const handleDeleteUser = (user: User) => {
    openModal(
      `Delete User: ${user.full_name}`,
      `Are you sure you want to delete ${user.full_name}? This action cannot be undone.`,
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ padding: '12px', background: 'var(--red-a)', borderRadius: 8, border: '1px solid var(--red)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Warning:</div>
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>
            • User will lose access to all portals<br/>
            • All user data will be permanently deleted<br/>
            • This action cannot be reversed
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text4)' }}>
          User: {user.full_name} ({user.email})<br/>
          Current Role: {user.role}
        </div>
      </div>,
      <>
        <button className="vc-btn vc-btn-ghost vc-btn-sm" onClick={closeModal}>
          <i className="bi-x" /> Cancel
        </button>
        <button 
          className="vc-btn vc-btn-red vc-btn-sm" 
          onClick={() => {
            closeModal();
            // Remove user from the list
            setUsers(prevUsers => prevUsers.filter(u => u.user_id !== user.user_id));
            showToast(`${user.full_name} has been deleted`, 'var(--red)', 'bi-trash-fill');
          }}
        >
          <i className="bi-trash-fill" /> Delete User
        </button>
      </>
    );
  };

  if (loading) {
    return (
      <div className="user-management-page">
        <div className="loading">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-management-page">
        <div className="error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="user-management-page">
      {/* Header */}
      <header className="user-management-header">
        <div className="user-management-header-inner">
          <button className="back-btn" onClick={() => navigate('/admin/overview')}>
            <i className="bi-arrow-left" /> Back to Overview
          </button>
          <div className="user-management-header-right">
            <ThemeToggleBtn />
            <button className="refresh-btn" onClick={fetchUsers}>
              <i className="bi-arrow-clockwise" /> Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="user-management-content">
        <div className="user-management-title">
          <h1>User Management</h1>
          <p>Manage system users and their roles</p>
        </div>

        <div className="users-stats">
          <div className="stat-item">
            <div className="stat-number">{users.length}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{users.filter(u => u.role === 'patient').length}</div>
            <div className="stat-label">Patients</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{users.filter(u => u.role === 'doctor').length}</div>
            <div className="stat-label">Doctors</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{users.filter(u => u.role === 'asha').length}</div>
            <div className="stat-label">ASHA Workers</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{users.filter(u => u.role === 'admin').length}</div>
            <div className="stat-label">Admins</div>
          </div>
        </div>

        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.user_id}>
                  <td className="user-name">{user.full_name}</td>
                  <td className="user-email">{user.email}</td>
                  <td>{getRoleBadge(user.role)}</td>
                  <td className="user-joined">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <button className="action-btn" title="View Details" onClick={() => showToast(`Viewing details for ${user.full_name}`, 'var(--blue)', 'bi-eye')}>
                      <i className="bi-eye" />
                    </button>
                    <button className="action-btn" title="Edit Role" onClick={() => handleEditRole(user)}>
                      <i className="bi-pencil" />
                    </button>
                    <button className="action-btn" title="Delete User" onClick={() => handleDeleteUser(user)} style={{ color: 'var(--red)' }}>
                      <i className="bi-trash-fill" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
