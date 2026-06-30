export type OperationalNotificationStatus = "UNREAD" | "READ" | "ARCHIVED";

export type OperationalNotificationSeverity = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export interface OperationalNotification {
  id: string;
  type: string;
  status: OperationalNotificationStatus;
  severity: OperationalNotificationSeverity;
  title: string;
  message: string;
  actionLabel: string | null;
  actionUrl: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationCenterState {
  unreadCount: number;
  items: OperationalNotification[];
}
