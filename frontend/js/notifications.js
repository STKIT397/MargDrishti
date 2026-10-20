/**
 * MargDrishti — Connected In-App Notification Controller
 * Manages live notification bells, badge counters, persistent dropdowns,
 * mark-as-read state, and cross-dashboard synchronization.
 */

import {
  fetchNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  getUnreadNotificationCountApi
} from './api.js';

export class NotificationUI {
  constructor({ containerId = 'notificationBellContainer', recipientId, onSelectComplaint = null }) {
    this.container = document.getElementById(containerId);
    this.recipientId = recipientId;
    this.onSelectComplaint = onSelectComplaint;
    this.notifications = [];
    this.unreadCount = 0;
    this.isOpen = false;
    this.pollTimer = null;

    if (this.container && this.recipientId) {
      this.init();
    }
  }

  setRecipient(recipientId) {
    this.recipientId = recipientId;
    this.refresh();
  }

  init() {
    this.bindEvents();
    this.refresh();

    // Listen for updates across application
    window.addEventListener('margdrishti:updated', () => this.refresh());
    window.addEventListener('margdrishti:auth_changed', () => this.refresh());

    // Gentle polling for cross-user event updates (15s)
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.refresh(true), 15000);
  }

  destroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  bindEvents() {
    const btn = this.container.querySelector('#btnNotificationBell');
    const dropdown = this.container.querySelector('#notificationDropdown');
    const markAllBtn = this.container.querySelector('#btnMarkAllRead');

    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown();
      });
    }

    if (markAllBtn) {
      markAllBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.markAllAsRead();
      });
    }

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.container.contains(e.target)) {
        this.closeDropdown();
      }
    });
  }

  toggleDropdown() {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    const dropdown = this.container.querySelector('#notificationDropdown');
    if (dropdown) {
      dropdown.classList.remove('hidden');
      this.isOpen = true;
      this.renderList();
    }
  }

  closeDropdown() {
    const dropdown = this.container.querySelector('#notificationDropdown');
    if (dropdown) {
      dropdown.classList.add('hidden');
      this.isOpen = false;
    }
  }

  async refresh(silent = false) {
    if (!this.recipientId) return;

    try {
      const res = await fetchNotificationsApi(this.recipientId);
      if (res && Array.isArray(res.notifications)) {
        this.notifications = res.notifications;
        this.unreadCount = typeof res.unread_count === 'number' ? res.unread_count : this.notifications.filter(n => !n.is_read).length;
        this.updateBadge();
        if (this.isOpen) {
          this.renderList();
        }
      }
    } catch (err) {
      if (!silent) console.warn('[Notifications] Failed to refresh:', err.message);
    }
  }

  updateBadge() {
    const badge = this.container.querySelector('#notificationBadge');
    if (!badge) return;

    if (this.unreadCount > 0) {
      badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.textContent = '0';
      badge.classList.add('hidden');
    }
  }

  renderList() {
    const listEl = this.container.querySelector('#notificationList');
    if (!listEl) return;

    if (this.notifications.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 2rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
          <i data-lucide="bell-off" style="width: 28px; height: 28px; margin: 0 auto 8px; opacity: 0.4;"></i>
          <div>No notifications yet.</div>
          <div style="font-size: 0.72rem; margin-top: 4px; opacity: 0.8;">Updates will appear here as your complaints and tasks progress.</div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    listEl.innerHTML = this.notifications.map(n => {
      const isUnread = !n.is_read;
      const timeStr = this.formatTime(n.created_at);
      const icon = this.getEventIcon(n.event_type);

      return `
        <div class="notification-item ${isUnread ? 'unread' : ''}" 
             data-id="${n.notification_id}" 
             data-complaint-id="${n.complaint_id || ''}"
             style="display: flex; gap: 10px; padding: 0.75rem 0.85rem; border-radius: 6px; margin-bottom: 4px; cursor: pointer; transition: background 0.15s; background: ${isUnread ? '#f0f9ff' : 'transparent'}; border-left: 3px solid ${isUnread ? 'var(--cyan-dark)' : 'transparent'};">
          <div style="flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: ${this.getIconBg(n.event_type)}; color: ${this.getIconColor(n.event_type)};">
            <i data-lucide="${icon}" style="width: 14px; height: 14px;"></i>
          </div>
          <div style="flex-grow: 1; min-width: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 2px;">
              <span style="font-weight: 700; font-size: 0.78rem; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${n.title}</span>
              <span style="font-size: 0.68rem; color: var(--text-muted); white-space: nowrap;">${timeStr}</span>
            </div>
            <div style="font-size: 0.73rem; color: var(--text-secondary); line-height: 1.35; margin-bottom: 4px;">${n.message}</div>
            ${n.complaint_id ? `<span class="badge font-mono" style="font-size: 0.62rem; padding: 1px 5px; background: rgba(6, 182, 212, 0.1); color: var(--cyan-dark);">${n.complaint_id}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Bind item click
    listEl.querySelectorAll('.notification-item').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.getAttribute('data-id');
        const compId = el.getAttribute('data-complaint-id');
        await this.markAsRead(id);
        if (compId && typeof this.onSelectComplaint === 'function') {
          this.closeDropdown();
          this.onSelectComplaint(compId);
        }
      });
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async markAsRead(notificationId) {
    try {
      await markNotificationReadApi(notificationId, this.recipientId);
      const item = this.notifications.find(n => String(n.notification_id) === String(notificationId));
      if (item && !item.is_read) {
        item.is_read = true;
        this.unreadCount = Math.max(0, this.unreadCount - 1);
        this.updateBadge();
        this.renderList();
      }
    } catch (err) {
      console.warn('Failed to mark read:', err.message);
    }
  }

  async markAllAsRead() {
    try {
      await markAllNotificationsReadApi(this.recipientId);
      this.notifications.forEach(n => n.is_read = true);
      this.unreadCount = 0;
      this.updateBadge();
      this.renderList();
    } catch (err) {
      console.warn('Failed to mark all read:', err.message);
    }
  }

  formatTime(isoString) {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  }

  getEventIcon(eventType) {
    switch (eventType) {
      case 'COMPLAINT_SUBMITTED':
      case 'NEW_COMPLAINT_REPORTED':
        return 'inbox';
      case 'ENGINEER_ASSIGNED':
      case 'TASK_ACKNOWLEDGED':
        return 'user-check';
      case 'ASSIGNMENT_REASSIGNED':
        return 'refresh-cw';
      case 'REPAIR_STARTED':
        return 'wrench';
      case 'REPAIR_PROGRESS_90':
        return 'gauge';
      case 'REPAIR_COMPLETED':
        return 'clock';
      case 'COMPLAINT_RESOLVED':
        return 'check-circle-2';
      case 'REINSPECTION_REQUESTED':
        return 'alert-triangle';
      default:
        return 'bell';
    }
  }

  getIconBg(eventType) {
    switch (eventType) {
      case 'COMPLAINT_RESOLVED':
        return '#ecfdf5';
      case 'REINSPECTION_REQUESTED':
        return '#fef2f2';
      case 'REPAIR_PROGRESS_90':
      case 'REPAIR_COMPLETED':
        return '#fef3c7';
      case 'REPAIR_STARTED':
      case 'ENGINEER_ASSIGNED':
        return '#ecfeff';
      default:
        return '#f1f5f9';
    }
  }

  getIconColor(eventType) {
    switch (eventType) {
      case 'COMPLAINT_RESOLVED':
        return '#059669';
      case 'REINSPECTION_REQUESTED':
        return '#dc2626';
      case 'REPAIR_PROGRESS_90':
      case 'REPAIR_COMPLETED':
        return '#d97706';
      case 'REPAIR_STARTED':
      case 'ENGINEER_ASSIGNED':
        return '#0891b2';
      default:
        return '#64748b';
    }
  }
}
