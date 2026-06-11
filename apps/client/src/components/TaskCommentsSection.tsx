import React, { useEffect, useState } from "react";
import { api, APIError } from "../services/api";
import type { TaskComment, User } from "../services/api";

interface TaskCommentsSectionProps {
  taskId: string;
  currentUser: User;
  isProjectPM: boolean;
}

const COMMENT_MAX_LENGTH = 2000;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof APIError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function TaskCommentsSection({
  taskId,
  currentUser,
  isProjectPM,
}: TaskCommentsSectionProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const loadComments = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.tasks.getTaskComments(taskId);
      setComments(data.comments || []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load comments."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [taskId]);

  const validateComment = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
      setError("Comment cannot be empty.");
      return null;
    }

    if (trimmed.length > COMMENT_MAX_LENGTH) {
      setError(`Comment must not exceed ${COMMENT_MAX_LENGTH} characters.`);
      return null;
    }

    return trimmed;
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const commentText = validateComment(newComment);
    if (!commentText) return;

    setSaving(true);

    try {
      const data = await api.tasks.createTaskComment(taskId, commentText);
      setComments((current) => [...current, data.comment]);
      setNewComment("");
      setSuccess("Comment added.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add comment."));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (comment: TaskComment) => {
    setError(null);
    setSuccess(null);
    setEditingCommentId(comment.id);
    setEditText(comment.commentText);
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditText("");
  };

  const handleUpdate = async (commentId: string) => {
    setError(null);
    setSuccess(null);

    const commentText = validateComment(editText);
    if (!commentText) return;

    setSaving(true);

    try {
      const data = await api.tasks.updateTaskComment(commentId, commentText);
      setComments((current) =>
        current.map((comment) => (comment.id === commentId ? data.comment : comment))
      );
      cancelEdit();
      setSuccess("Comment updated.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update comment."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (comment: TaskComment) => {
    if (!window.confirm("Delete this comment?")) return;

    const reason = window.prompt("Reason for deletion (optional):") || undefined;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      await api.tasks.deleteTaskComment(comment.id, reason);
      setComments((current) => current.filter((item) => item.id !== comment.id));
      setSuccess("Comment deleted.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete comment."));
    } finally {
      setSaving(false);
    }
  };

  if (currentUser.role === "admin") {
    return null;
  }

  return (
    <div className="task-comments-section">
      <div className="task-comments-header">
        <h3>Comments</h3>
        <button className="btn btn-secondary btn-xs" onClick={loadComments} disabled={loading || saving}>
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

      <form className="task-comment-form" onSubmit={handleCreate}>
        <div className="form-group">
          <label htmlFor={`task-comment-${taskId}`}>Add Comment</label>
          <textarea
            id={`task-comment-${taskId}`}
            rows={3}
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            disabled={saving}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder="Write a comment"
          />
        </div>
        <div className="task-comment-form-footer">
          <span className="muted-text">
            {newComment.trim().length}/{COMMENT_MAX_LENGTH}
          </span>
          <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
            {saving ? <span className="spinner"></span> : "Add Comment"}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="task-comments-loading">
          <span className="spinner"></span>
          <span>Loading comments...</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="task-comments-empty">No comments yet.</div>
      ) : (
        <div className="task-comments-list">
          {comments.map((comment) => {
            const canEdit = comment.userId === currentUser.id;
            const canDelete = canEdit || isProjectPM;
            const isEditing = editingCommentId === comment.id;
            const isUpdated = comment.updatedAt !== comment.createdAt;

            return (
              <div key={comment.id} className="task-comment-item">
                <div className="task-comment-meta">
                  <strong>{comment.userName || "Unknown user"}</strong>
                  <span>{formatDateTime(comment.createdAt)}</span>
                  {isUpdated && <span>Edited</span>}
                </div>

                {isEditing ? (
                  <div className="task-comment-edit">
                    <textarea
                      rows={3}
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      disabled={saving}
                      maxLength={COMMENT_MAX_LENGTH}
                    />
                    <div className="task-comment-actions">
                      <button className="btn btn-secondary btn-xs" type="button" onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </button>
                      <button className="btn btn-primary btn-xs" type="button" onClick={() => handleUpdate(comment.id)} disabled={saving}>
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="task-comment-text">{comment.commentText}</p>
                    {(canEdit || canDelete) && (
                      <div className="task-comment-actions">
                        {canEdit && (
                          <button className="btn btn-secondary btn-xs" type="button" onClick={() => startEdit(comment)}>
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button className="btn btn-danger btn-xs" type="button" onClick={() => handleDelete(comment)}>
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
