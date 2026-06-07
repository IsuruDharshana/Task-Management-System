const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export class APIError extends Error {
  code: string;
  details: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = "APIError";
    this.code = code;
    this.details = details;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${path}`;

  // Default headers
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // Required for HTTP-only JWT cookies
  });

  let payload: any;
  try {
    payload = await response.json();
  } catch (err) {
    // If not JSON, throw a general HTTP error
    if (!response.ok) {
      throw new APIError(`HTTP error ${response.status}`, "HTTP_ERROR");
    }
    return null;
  }

  if (!response.ok || !payload.success) {
    const errorMsg = payload?.error?.message || `API request failed with status ${response.status}`;
    const errorCode = payload?.error?.code || "UNKNOWN_ERROR";
    const errorDetails = payload?.error?.details || null;
    throw new APIError(errorMsg, errorCode, errorDetails);
  }

  return payload.data;
}

// Interfaces matching backend DTOs
export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "project_manager" | "collaborator";
  mustResetPassword: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "completed" | "archived";
  startDate: string | null;
  dueDate: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userEmail: string;
  projectRole: "project_manager" | "collaborator";
  projectLabel: string | null;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EligibleMember {
  id: string;
  name: string;
  email: string;
  role: "project_manager" | "collaborator";
}

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "to_do" | "in_progress" | "completed";
export type TaskSortBy = "due_date" | "priority" | "created_at";
export type TaskSortOrder = "asc" | "desc";

export interface TaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userEmail: string;
  assignedBy: string | null;
  assignedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  createdBy: string;
  updatedBy: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignees: TaskAssignee[];
}

export interface TaskListParams {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  search?: string;
  sortBy?: TaskSortBy;
  sortOrder?: TaskSortOrder;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "project_manager" | "collaborator";
  isActive: boolean;
  mustResetPassword: boolean;
  tokenVersion?: number;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export const api = {
  auth: {
    async me(): Promise<{ user: User }> {
      return request("/auth/me");
    },
    async login(email: string, password: string): Promise<{ user: User; mustResetPassword: boolean }> {
      return request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
    },
    async logout(): Promise<void> {
      return request("/auth/logout", {
        method: "POST",
      });
    },
    async resetPassword(currentPassword: string, newPassword: string): Promise<{ user: User }> {
      return request("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
    async changePassword(currentPassword: string, newPassword: string): Promise<{ user: User }> {
      return request("/auth/change-password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },
  },

  projects: {
    async list(): Promise<{ projects: Project[] }> {
      return request("/projects");
    },
    async get(projectId: string): Promise<{ project: Project }> {
      return request(`/projects/${projectId}`);
    },
    async listEligibleMembers(projectId: string): Promise<{ users: EligibleMember[] }> {
      return request(`/projects/${projectId}/eligible-members`);
    },
    async create(data: {
      name: string;
      description?: string | null;
      status?: "active" | "completed" | "archived";
      start_date?: string | null;
      due_date?: string | null;
    }): Promise<{ project: Project }> {
      return request("/projects", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async update(
      projectId: string,
      data: {
        name?: string;
        description?: string | null;
        status?: "active" | "completed" | "archived";
        start_date?: string | null;
        due_date?: string | null;
      }
    ): Promise<{ project: Project }> {
      return request(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    async delete(projectId: string, reason?: string): Promise<void> {
      return request(`/projects/${projectId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
    },
  },

  members: {
    async list(projectId: string): Promise<{ members: Member[] }> {
      return request(`/projects/${projectId}/members`);
    },
    async add(
      projectId: string,
      data: {
        user_id: string;
        project_role: "project_manager" | "collaborator";
        project_label?: string | null;
      }
    ): Promise<{ member: Member }> {
      return request(`/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async update(
      projectId: string,
      memberId: string,
      data: {
        project_role?: "project_manager" | "collaborator";
        project_label?: string | null;
      }
    ): Promise<{ member: Member }> {
      return request(`/projects/${projectId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    async remove(projectId: string, memberId: string, reason?: string): Promise<void> {
      return request(`/projects/${projectId}/members/${memberId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
    },
  },

  tasks: {
    async list(projectId: string, params?: TaskListParams): Promise<{ tasks: Task[] }> {
      const query = new URLSearchParams();

      if (params?.status) query.set("status", params.status);
      if (params?.priority) query.set("priority", params.priority);
      if (params?.assigneeId) query.set("assigneeId", params.assigneeId);
      if (params?.search) query.set("search", params.search);
      if (params?.sortBy) query.set("sortBy", params.sortBy);
      if (params?.sortOrder) query.set("sortOrder", params.sortOrder);

      const queryString = query.toString();
      return request(`/projects/${projectId}/tasks${queryString ? `?${queryString}` : ""}`);
    },
    async create(
      projectId: string,
      data: {
        title: string;
        description?: string | null;
        due_date?: string | null;
        priority?: TaskPriority;
        status?: TaskStatus;
        assignee_ids?: string[];
      }
    ): Promise<{ task: Task }> {
      return request(`/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async get(taskId: string): Promise<{ task: Task }> {
      return request(`/tasks/${taskId}`);
    },
    async update(
      taskId: string,
      data: {
        title?: string;
        description?: string | null;
        due_date?: string | null;
        priority?: TaskPriority;
        status?: TaskStatus;
      }
    ): Promise<{ task: Task }> {
      return request(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    async delete(taskId: string, reason?: string): Promise<void> {
      return request(`/tasks/${taskId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
    },
    async addAssignee(taskId: string, userId: string): Promise<{ assignee: TaskAssignee }> {
      return request(`/tasks/${taskId}/assignees`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      });
    },
    async removeAssignee(taskId: string, userId: string, reason?: string): Promise<void> {
      return request(`/tasks/${taskId}/assignees/${userId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      });
    },
  },

  admin: {
    async listUsers(params?: { search?: string; role?: string; status?: string }): Promise<{ users: AdminUser[] }> {
      const query = new URLSearchParams(params as any).toString();
      const path = `/admin/users${query ? `?${query}` : ""}`;
      return request(path);
    },
    async createUser(data: { name: string; email: string; role: "project_manager" | "collaborator" }): Promise<{ user: AdminUser }> {
      return request("/admin/users", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    async updateUser(
      userId: string,
      data: { name?: string; email?: string; role?: "project_manager" | "collaborator" }
    ): Promise<{ user: AdminUser }> {
      return request(`/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    async deactivateUser(userId: string): Promise<{ user: AdminUser }> {
      return request(`/admin/users/${userId}/deactivate`, {
        method: "PATCH",
      });
    },
    async reactivateUser(userId: string): Promise<{ user: AdminUser }> {
      return request(`/admin/users/${userId}/reactivate`, {
        method: "PATCH",
      });
    },
    async resetUserPassword(userId: string): Promise<{ user: AdminUser }> {
      return request(`/admin/users/${userId}/reset-password`, {
        method: "PATCH",
      });
    },
  },
};
