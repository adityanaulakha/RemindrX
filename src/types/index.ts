export type Role = 'student' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  classId: string | null;
  role: Role;
  trustScore: number;
  isSuperAdmin?: boolean;
  program?: string;
  branch?: string;
  createdAt?: number;
  lastActive?: number;
  fcmTokens?: string[];
  collegeId?: string; // Links to Institute
  deadlinePreference?: number; // In days, default 2
  dob?: string;
  section?: string;
  rollNo?: string;
  year?: string;
}

export interface Institute {
  id: string;
  name: string;
  domains: string[]; // List of allowed email domains e.g. ["gla.ac.in", "gla.in"]
  createdAt: number;
}

export interface ClassData {
  id: string;
  name: string;
  program?: string;
  branch?: string;
  year?: string;
  section?: string;
  joinCode: string;
  adminInviteCode: string;
  adminCodeUses: number;
  adminCodeExpiry?: number; // timestamp
  admins: string[]; // array of userIds
  instituteId?: string; // Links to Institute
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  type: 'theory' | 'lab';
  credits?: number;
  classId: string;
  isActive: boolean;
  createdBy: 'system' | 'admin' | string;
}

export type Priority = 'low' | 'medium' | 'critical';

export interface Task {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  classId: string;
  deadline: number; // timestamp
  priority: Priority;
  createdBy: string;
  completedBy?: string[]; // Array of user IDs who marked this as done
}

export type PostStatus = 'unverified' | 'likely' | 'verified';

export interface Post {
  id: string;
  content: string;
  subjectId: string;
  classId?: string;
  confirmations: string[]; // userIds
  disputes: string[]; // userIds
  status: PostStatus;
  createdAt: number;
  createdBy: string;
}

export interface Resource {
  id: string;
  subjectId: string;
  fileUrl: string;
  uploadedBy: string;
  createdAt: number;
}

export interface ClassChangeRequest {
  id: string;
  userId: string;
  userName?: string;
  currentClassId: string | null;
  currentClassName?: string;
  requestedClassId: string;
  requestedClassCode?: string;
  requestedClassName?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: number; // timestamp
  endDate?: number; // optional end time
  venue: string;
  organizer: string;
  category: string;
  classId?: string;
  createdBy: string;
  goingCount: number;
  status: 'pending' | 'approved' | 'rejected';
  // Rich metadata
  registrationLink?: string;
  websiteLink?: string;
  instagramLink?: string;
  linkedinLink?: string;
  contactEmail?: string;
  contactPhone?: string;
  entryFee?: string;
  teamSize?: string;
  customFields?: { label: string; value: string }[];
  pendingUpdate?: Partial<Event>;
  moderatorRemarks?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  remarks?: string;
  type: 'event_approval' | 'event_rejection' | 'event_deletion' | 'system';
  eventId?: string;
  createdAt: number;
  read: boolean;
}

export interface EventParticipation {
  id: string;
  userId: string;
  eventId: string;
  status: 'going' | 'not_going';
}
