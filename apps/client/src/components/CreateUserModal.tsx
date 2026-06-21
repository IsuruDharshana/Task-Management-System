import { useState, type FormEvent } from "react";
import { api, APIError } from "../services/api";
import type { AdminUser } from "../services/api";
import { Button, Input, Modal, Select } from "./ui";

type EditableRole = "project_manager" | "collaborator";

type CreateUserModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated?: (user: AdminUser) => void | Promise<void>;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function CreateUserModal({ open, onOpenChange, onUserCreated }: CreateUserModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EditableRole>("project_manager");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  if (!open) return null;

  const handleClose = () => {
    if (creating) return;
    setCreateError(null);
    onOpenChange(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      const result = await api.admin.createUser({ name: name.trim(), email: email.trim(), role });
      setName("");
      setEmail("");
      setRole("project_manager");
      onOpenChange(false);
      await onUserCreated?.(result.user);
    } catch (err) {
      setCreateError(getErrorMessage(err, "Failed to create user."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      title="Create New User"
      description="Add a project manager or collaborator. Temporary credentials are sent through the configured email channel."
      onClose={handleClose}
    >
      <form onSubmit={handleSubmit} className="admin-create-form admin-create-modal-form">
        {createError && <div className="alert alert-danger">{createError}</div>}
        <Input id="user-name" label="Full Name" value={name} onChange={(event) => setName(event.target.value)} required disabled={creating} />
        <Input id="user-email" type="email" label="Email Address" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={creating} />
        <Select id="user-role" label="System Role" value={role} onChange={(event) => setRole(event.target.value as EditableRole)} disabled={creating}>
          <option value="project_manager">Project Manager</option>
          <option value="collaborator">Collaborator</option>
        </Select>
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create User"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
