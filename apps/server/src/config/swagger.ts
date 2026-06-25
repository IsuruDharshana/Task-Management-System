import path from "node:path";
import { fileURLToPath } from "node:url";
import swaggerJsdoc from "swagger-jsdoc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Task Management System API",
      version: "1.0.0",
    },
    
    tags: [
    { name: "Health", description: "API and database health check endpoints" },
    { name: "Auth", description: "Authentication and session management endpoints" },
    { name: "Admin Users", description: "Admin-only user management endpoints" },
    { name: "Projects", description: "Project management endpoints" },
    { name: "Members", description: "Project member management endpoints" },
    { name: "Tasks", description: "Task management endpoints" },
    { name: "Comments", description: "Task comment endpoints" },
    { name: "Attachments", description: "Task attachment endpoints" },
    { name: "Notifications", description: "Notification endpoints" },
    { name: "Activity Logs", description: "Audit/activity log endpoints" },
    { name: "Dashboard", description: "Dashboard summary endpoints" },
  ],

    servers: [
      {
        url: process.env.API_PUBLIC_URL || "http://localhost:5000/api",
        description: process.env.NODE_ENV === "production" ? "Production" : "Local",
      },
    ],
    components: {
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["admin", "project_manager", "collaborator"] },
            mustResetPassword: { type: "boolean" },
          },
        },
        AdminUser: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["admin", "project_manager", "collaborator"] },
            isActive: { type: "boolean" },
            mustResetPassword: { type: "boolean" },
            tokenVersion: { type: "integer" },
            lastLoginAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            deletedAt: { type: "string", format: "date-time", nullable: true },
          },
        },
        Project: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            description: { type: "string", nullable: true },
            status: { type: "string", enum: ["active", "completed", "archived"] },
            startDate: { type: "string", format: "date", nullable: true },
            dueDate: { type: "string", format: "date", nullable: true },
            createdBy: { type: "string", format: "uuid" },
            updatedBy: { type: "string", format: "uuid", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Member: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            projectId: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            userName: { type: "string" },
            userEmail: { type: "string", format: "email" },
            projectRole: { type: "string", enum: ["project_manager", "collaborator"] },
            projectLabel: { type: "string", nullable: true },
            addedBy: { type: "string", format: "uuid" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        EligibleMember: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["project_manager", "collaborator"] },
          },
        },
        TaskAssignee: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            taskId: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            userName: { type: "string" },
            userEmail: { type: "string", format: "email" },
            assignedBy: { type: "string", format: "uuid", nullable: true },
            assignedAt: { type: "string", format: "date-time" },
          },
        },
        Task: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            projectId: { type: "string", format: "uuid" },
            createdBy: { type: "string", format: "uuid" },
            updatedBy: { type: "string", format: "uuid", nullable: true },
            title: { type: "string" },
            description: { type: "string", nullable: true },
            priority: { type: "string", enum: ["low", "medium", "high"] },
            status: { type: "string", enum: ["to_do", "in_progress", "completed"] },
            dueDate: { type: "string", format: "date", nullable: true },
            completedAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            assignees: { type: "array", items: { $ref: "#/components/schemas/TaskAssignee" } },
          },
        },
        TaskComment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            taskId: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            userName: { type: "string" },
            commentText: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        TaskAttachment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            taskId: { type: "string", format: "uuid" },
            uploadedBy: { type: "string", format: "uuid" },
            uploadedByName: { type: "string" },
            fileName: { type: "string" },
            fileType: { type: "string", nullable: true },
            fileSize: { type: "integer", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Notification: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            userId: { type: "string", format: "uuid" },
            type: {
              type: "string",
              enum: [
                "task_assigned",
                "task_updated",
                "task_status_changed",
                "comment_added",
                "deadline_approaching",
                "admin_update",
                "project_updated",
              ],
            },
            title: { type: "string" },
            message: { type: "string" },
            entityType: { type: "string", nullable: true },
            entityId: { type: "string", nullable: true },
            metadata: { type: "object" },
            readAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ActivityLog: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            actorUserId: { type: "string", format: "uuid", nullable: true },
            actorName: { type: "string", nullable: true },
            action: { type: "string" },
            entityType: { type: "string" },
            entityId: { type: "string", nullable: true },
            metadata: { type: "object" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "veyra_access_token",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  },
  apis: [
    "./src/app.ts",
    "./src/routes/*.ts",
    "./src/controllers/*.ts",
    "./dist/app.js",
    "./dist/routes/*.js",
    "./dist/controllers/*.js",
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
