import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'PLANNING':
      return 'text-blue-400';
    case 'READY':
      return 'text-yellow-400';
    case 'EXECUTING':
      return 'text-green-400';
    case 'PAUSED':
      return 'text-orange-400';
    case 'COMPLETE':
      return 'text-emerald-400';
    case 'FAILED':
      return 'text-red-400';
    case 'ARCHIVED':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
}

export function getStatusBg(status: string): string {
  switch (status) {
    case 'PLANNING':
      return 'bg-blue-500/20';
    case 'READY':
      return 'bg-yellow-500/20';
    case 'EXECUTING':
      return 'bg-green-500/20';
    case 'PAUSED':
      return 'bg-orange-500/20';
    case 'COMPLETE':
      return 'bg-emerald-500/20';
    case 'FAILED':
      return 'bg-red-500/20';
    case 'ARCHIVED':
      return 'bg-gray-500/20';
    default:
      return 'bg-gray-500/20';
  }
}

export function getStepStatusIcon(status: string): string {
  switch (status) {
    case 'DONE':
      return '✓';
    case 'ACTIVE':
      return '●';
    case 'PENDING':
      return '○';
    case 'SKIPPED':
      return '⊘';
    case 'FAILED':
      return '✗';
    default:
      return '○';
  }
}

export function getStepStatusColor(status: string): string {
  switch (status) {
    case 'DONE':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'ACTIVE':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'PENDING':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300';
    case 'SKIPPED':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'FAILED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700/30 dark:text-gray-300';
  }
}
