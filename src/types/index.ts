export type Role = 'student' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  classId: string | null;
  role: Role;
  trustScore: number;
}

export interface ClassData {
  id: string;
  name: string;
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
