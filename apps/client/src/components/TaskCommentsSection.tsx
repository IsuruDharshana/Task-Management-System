import React, { useCallback, useEffect, useState } from "react";
import { api, APIError } from "../services/api";
import type { TaskComment, User } from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useSuccessMessage } from "../context/SuccessMessageContext";
import { Button, ConfirmDialog, EmptyState, SkeletonComments, UserAvatar } from "./ui";

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

function CommentActionIcon({ name }: { name: "edit" | "delete" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };

  if (name === "edit") {
    return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
  }

  return <svg {...common}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>;
}

export default function TaskCommentsSection({
  taskId,
  currentUser,
  isProjectPM,
}: TaskCommentsSectionProps) {
  const { socket } = useSocket();
  const { showSuccessMessage } = useSuccessMessage();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [commentPendingDelete, setCommentPendingDelete] = useState<TaskComment | null>(null);

  const loadComments = useCallback(async () => {
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
  }, [taskId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  useEffect(() => {
    if (!socket) return;

    let refreshTimer: number | undefined;
    const handleCommentCreated = (payload: { taskId?: string }) => {
      if (payload.taskId !== taskId) return;

      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        loadComments();
      }, 250);
    };

    socket.on("comment:created", handleCommentCreated);

    return () => {
      window.clearTimeout(refreshTimer);
      socket.off("comment:created", handleCommentCreated);
    };
  }, [socket, taskId, loadComments]);

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

    const commentText = validateComment(newComment);
    if (!commentText) return;

    setSaving(true);

    try {
      const data = await api.tasks.createTaskComment(taskId, commentText);
      setComments((current) => [...current, data.comment]);
      setNewComment("");
      showSuccessMessage("Comment added successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add comment."));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (comment: TaskComment) => {
    setError(null);
    setEditingCommentId(comment.id);
    setEditText(comment.commentText);
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditText("");
  };

  const handleUpdate = async (commentId: string) => {
    setError(null);

    const commentText = validateComment(editText);
    if (!commentText) return;

    setSaving(true);

    try {
      const data = await api.tasks.updateTaskComment(commentId, commentText);
      setComments((current) =>
        current.map((comment) => (comment.id === commentId ? data.comment : comment))
      );
      cancelEdit();
      showSuccessMessage("Comment updated successfully.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update comment."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (comment: TaskComment) => {
    setError(null);
    setSaving(true);

    try {
      await api.tasks.deleteTaskComment(comment.id);
      setComments((current) => current.filter((item) => item.id !== comment.id));
      setCommentPendingDelete(null);
      showSuccessMessage("Comment deleted successfully.");
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

      <form className="task-comment-form comment-composer" onSubmit={handleCreate}>
        <UserAvatar name={currentUser.name} size="sm" />
        <div className="comment-composer-body">
          <label className="sr-only" htmlFor={`task-comment-${taskId}`}>Add Comment</label>
          <textarea
            id={`task-comment-${taskId}`}
            rows={2}
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
            disabled={saving}
            maxLength={COMMENT_MAX_LENGTH}
            placeholder="Write a comment..."
          />
          <div className="task-comment-form-footer comment-composer-footer">
            <span className="muted-text">
              {newComment.trim().length}/{COMMENT_MAX_LENGTH}
            </span>
            <Button type="submit" disabled={saving}>
              {saving ? <span className="spinner"></span> : "Add Comment"}
            </Button>
          </div>
        </div>
      </form>

      {loading ? (
        <SkeletonComments count={3} />
      ) : comments.length === 0 ? (
        <EmptyState title="No comments yet" description="Discussion and updates for this task will appear here." />
      ) : (
        <div className="task-comments-list comment-thread">
          {comments.map((comment) => {
            const canEdit = comment.userId === currentUser.id;
            const canDelete = canEdit || isProjectPM;
            const isEditing = editingCommentId === comment.id;
            const isUpdated = comment.updatedAt !== comment.createdAt;

            return (
              <div key={comment.id} className="task-comment-item comment-item">
                <UserAvatar name={comment.userName || "Unknown user"} size="sm" />
                <div className="comment-content">
                  <div className="task-comment-meta comment-meta">
                    <span className="comment-author">{comment.userName || "Unknown user"}</span>
                    <span className="comment-time">{formatDateTime(comment.createdAt)}{isUpdated ? " · Edited" : ""}</span>
                  </div>

                {isEditing ? (
                  <div className="task-comment-edit comment-edit-box">
                    <textarea
                      rows={3}
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      disabled={saving}
                      maxLength={COMMENT_MAX_LENGTH}
                    />
                    <div className="task-comment-actions comment-actions">
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
                    <p className="task-comment-text comment-bubble">{comment.commentText}</p>
                    {(canEdit || canDelete) && (
                      <div className="task-comment-actions comment-actions">
                        {canEdit && (
                          <button className="comment-action-icon" type="button" aria-label="Edit comment" title="Edit" onClick={() => startEdit(comment)}>
                            <CommentActionIcon name="edit" />
                          </button>
                        )}
                        {canDelete && (
                          <button className="comment-action-icon comment-action-icon--danger" type="button" aria-label="Delete comment" title="Delete" onClick={() => setCommentPendingDelete(comment)}>
                            <CommentActionIcon name="delete" />
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(commentPendingDelete)}
        title="Delete comment?"
        description="This comment will be removed from the task discussion. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={saving}
        onCancel={() => setCommentPendingDelete(null)}
        onConfirm={() => {
          if (commentPendingDelete) {
            return handleDelete(commentPendingDelete);
          }
        }}
      />
    </div>
  );
}

