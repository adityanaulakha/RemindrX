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
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  type: 'theory' | 'lab';
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
  currentClassId: string | null;
  requestedClassId: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: number; // timestamp
  venue: string;
  organizer: string;
  category: string;
  classId?: string;
  createdBy: string;
  goingCount: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface EventParticipation {
  id: string;
  userId: string;
  eventId: string;
  status: 'going' | 'not_going';
}
