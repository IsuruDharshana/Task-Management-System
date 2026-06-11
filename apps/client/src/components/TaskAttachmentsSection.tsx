import React, { useEffect, useRef, useState } from "react";
import { api, APIError } from "../services/api";
import type { TaskAttachment, User } from "../services/api";

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
      const data = await api.tasks.uploadTaskAttachment(taskId, file);
      setAttachments((current) => [...current, data.attachment]);
      setSelectedFile(null);
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
    if (!window.confirm(`Delete attachment "${attachment.fileName}"?`)) return;

    const reason = window.prompt("Reason for deletion (optional):") || undefined;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      await api.tasks.deleteTaskAttachment(attachment.id, reason);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
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
          <label htmlFor={`task-attachment-${taskId}`}>Upload Attachment</label>
          <input
            id={`task-attachment-${taskId}`}
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            disabled={saving}
          />
        </div>
        <div className="task-comment-form-footer">
          <span className="muted-text">
            {selectedFile ? `${selectedFile.name} - ${formatFileSize(selectedFile.size)}` : "Max 10 MB"}
          </span>
          <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
            {saving ? <span className="spinner"></span> : "Upload"}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="task-comments-loading">
          <span className="spinner"></span>
          <span>Loading attachments...</span>
        </div>
      ) : attachments.length === 0 ? (
        <div className="task-comments-empty">No attachments yet.</div>
      ) : (
        <div className="task-attachments-list">
          {attachments.map((attachment) => {
            const canDelete = attachment.uploadedBy === currentUser.id || isProjectPM;

            return (
              <div key={attachment.id} className="task-attachment-item">
                <div className="task-attachment-main">
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
                      onClick={() => handleDelete(attachment)}
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
    </div>
  );
}
