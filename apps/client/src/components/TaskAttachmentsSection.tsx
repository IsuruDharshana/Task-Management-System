import React, { useEffect, useRef, useState } from "react";
import { api, APIError } from "../services/api";
import type { TaskAttachment, User } from "../services/api";
import { Button, ConfirmDialog, EmptyState, SkeletonList, UserAvatar } from "./ui";

interface TaskAttachmentsSectionProps {
  taskId: string;
  currentUser: User;
  isProjectPM: boolean;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
]);

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(value: number | null) {
  if (value === null || value === undefined) return "Unknown size";
  if (value < 1024) return `${value} B`;

  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof APIError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function TaskAttachmentsSection({
  taskId,
  currentUser,
  isProjectPM,
}: TaskAttachmentsSectionProps) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [attachmentPendingDelete, setAttachmentPendingDelete] = useState<TaskAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadAttachments = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.tasks.getTaskAttachments(taskId);
      setAttachments(data.attachments || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load attachments."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttachments();
  }, [taskId]);

  const validateFile = (file: File | null): file is File => {
    if (!file) {
      setError("Choose a file to upload.");
      return false;
    }

    if (file.size <= 0) {
      setError("Attachment file cannot be empty.");
      return false;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("Attachment file must not exceed 10 MB.");
      return false;
    }

    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      setError("Attachment file type is not supported.");
      return false;
    }

    return true;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const file = selectedFile;
    if (!validateFile(file)) return;

    setSaving(true);

    try {
      const data = await api.tasks.uploadTaskAttachment(taskId, file, displayName);
      setAttachments((current) => [...current, data.attachment]);
      setSelectedFile(null);
      setDisplayName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess("Attachment uploaded.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to upload attachment."));
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (attachment: TaskAttachment) => {
    setError(null);
    setSuccess(null);
    setDownloadingId(attachment.id);

    try {
      const data = await api.tasks.createAttachmentDownloadUrl(attachment.id);
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create download link."));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (attachment: TaskAttachment) => {
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      await api.tasks.deleteTaskAttachment(attachment.id);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      setAttachmentPendingDelete(null);
      setSuccess("Attachment deleted.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete attachment."));
    } finally {
      setSaving(false);
    }
  };

  if (currentUser.role === "admin") {
    return null;
  }

  return (
    <div className="task-attachments-section">
      <div className="task-comments-header">
        <h3>Attachments</h3>
        <button className="btn btn-secondary btn-xs" onClick={loadAttachments} disabled={loading || saving}>
          {loading ? "Loading" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          <span className="alert-icon">!</span>
          <span className="alert-message">{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span className="alert-icon">OK</span>
          <span className="alert-message">{success}</span>
        </div>
      )}

      <form className="task-attachment-form" onSubmit={handleUpload}>
        <div className="form-group">
          <label htmlFor={`task-attachment-name-${taskId}`}>Attachment name (optional)</label>
          <input
            id={`task-attachment-name-${taskId}`}
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={saving}
            maxLength={120}
            placeholder="e.g. Project proposal"
          />
        </div>
        <div className="form-group">
          <label htmlFor={`task-attachment-${taskId}`}>Upload Attachment</label>
          <input
            id={`task-attachment-${taskId}`}
            ref={fileInputRef}
            className="attachment-file-input"
            type="file"
            onChange={handleFileChange}
            disabled={saving}
          />
        </div>
        <div className="task-comment-form-footer">
          <span className="muted-text">
            {selectedFile ? `${selectedFile.name} - ${formatFileSize(selectedFile.size)}` : "Max 10 MB"}
          </span>
          <Button type="submit" disabled={saving}>
            {saving ? <span className="spinner"></span> : "Upload"}
          </Button>
        </div>
      </form>

      {loading ? (
        <SkeletonList count={3} />
      ) : attachments.length === 0 ? (
        <EmptyState title="No attachments yet" description="Upload files, images, or supporting documents for this task." />
      ) : (
        <div className="task-attachments-list">
          {attachments.map((attachment) => {
            const canDelete = attachment.uploadedBy === currentUser.id || isProjectPM;

            return (
              <div key={attachment.id} className="task-attachment-item">
                <div className="task-attachment-main">
                  <UserAvatar name={attachment.uploadedByName || "Unknown user"} size="sm" />
                  <strong>{attachment.fileName}</strong>
                  <div className="task-comment-meta">
                    <span>{formatFileSize(attachment.fileSize)}</span>
                    <span>{attachment.uploadedByName || "Unknown user"}</span>
                    <span>{formatDateTime(attachment.createdAt)}</span>
                  </div>
                </div>
                <div className="task-comment-actions">
                  <button
                    className="btn btn-secondary btn-xs"
                    type="button"
                    onClick={() => handleDownload(attachment)}
                    disabled={downloadingId === attachment.id}
                  >
                    {downloadingId === attachment.id ? "Opening" : "Download"}
                  </button>
                  {canDelete && (
                    <button
                      className="btn btn-danger btn-xs"
                      type="button"
                      onClick={() => setAttachmentPendingDelete(attachment)}
                      disabled={saving}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(attachmentPendingDelete)}
        title="Delete attachment?"
        description={
          attachmentPendingDelete
            ? `The attachment "${attachmentPendingDelete.fileName}" will be removed from this task.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        isLoading={saving}
        onCancel={() => setAttachmentPendingDelete(null)}
        onConfirm={() => {
          if (attachmentPendingDelete) {
            return handleDelete(attachmentPendingDelete);
          }
        }}
      />
    </div>
  );
}
