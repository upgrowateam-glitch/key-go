import React from 'react';
import { Badge, Tone } from '../kit/controls';

/** Maps every status string used in the app to one consistent, accessible tone. */
export function statusTone(status: string): Tone {
  switch (status.toLowerCase()) {
    case 'available':
    case 'confirmed':
    case 'completed':
    case 'verified':
    case 'approved':
    case 'paid':
    case 'refunded':
    case 'done':
    case 'delivered':
    case 'read':
    case 'punched in':
    case 'on duty':
    case 'running':
    case 'active':
    case 'present':
      return 'success';
    case 'reserved':
    case 'pending':
    case 'requested':
    case 'quoted':
    case 'scheduled':
    case 'upcoming':
    case 'sent':
    case 'queued':
    case 'deposit paid':
    case 'draft':
      return 'info';
    case 'on rent':
    case 'on trip':
    case 'in progress':
    case 'pickup':
      return 'violet';
    case 'maintenance':
    case 'due soon':
    case 'medium':
    case 'unpaid':
    case 'return':
    case 'half day':
    case 'leave':
    case 'on leave':
    case 'finalised':
    case 'open':
      return 'warning';
    case 'sold':
    case 'cancelled':
    case 'declined':
    case 'overdue':
    case 'failed':
    case 'rejected':
    case 'high':
    case 'absent':
      return 'danger';
    case 'closed':
    case 'punched out':
    case 'off duty':
    case 'not uploaded':
    case 'low':
    default:
      return 'neutral';
  }
}

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <Badge label={status} tone={statusTone(status)} />
);
