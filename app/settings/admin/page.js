"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldOff,
  UserX,
  UserPlus,
  KeyRound,
  Clock,
  CheckCircle2,
  Mail,
  Send,
  ChevronRight,
} from "lucide-react";

export default function AdminPanel() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [adminUsers, setAdminUsers] = useState([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [newUser, setNewUser] = useState({
    email: "",
    username: "",
    password: "",
    isAdmin: false,
  });
  const [resetPasswordUserId, setResetPasswordUserId] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [adminFilter, setAdminFilter] = useState("all");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  const fetchAdminUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) setAdminUsers(await res.json());
    } catch (e) {}
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (user && !user.isAdmin) {
      router.push("/settings");
    } else if (user && user.isAdmin) {
      fetchAdminUsers();
    }
  }, [user, loading, router]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setAdminMessage("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });
    const data = await res.json();
    if (res.ok) {
      setAdminMessage(`User "${data.username}" created.`);
      setNewUser({ email: "", username: "", password: "", isAdmin: false });
      fetchAdminUsers();
    } else {
      setAdminMessage(`Error: ${data.error}`);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    setAdminMessage("");
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (res.ok) {
      setAdminMessage(`User "${username}" deleted.`);
      setAdminUsers(adminUsers.filter((u) => u.userId !== userId));
    } else {
      setAdminMessage(`Error: ${data.error}`);
    }
  };

  const handleToggleAdmin = async (userId, currentIsAdmin) => {
    setAdminMessage("");
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: !currentIsAdmin }),
    });
    const data = await res.json();
    if (res.ok) {
      setAdminUsers(
        adminUsers.map((u) =>
          u.userId === userId ? { ...u, isAdmin: !currentIsAdmin } : u
        )
      );
    } else {
      setAdminMessage(`Error: ${data.error}`);
    }
  };

  const handleResetPassword = async (userId, username) => {
    if (!resetPasswordValue.trim()) return;
    setAdminMessage("");
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: resetPasswordValue }),
    });
    const data = await res.json();
    if (res.ok) {
      setAdminMessage(`Password reset for "${username}".`);
      setResetPasswordUserId(null);
      setResetPasswordValue("");
    } else {
      setAdminMessage(`Error: ${data.error}`);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setAdminMessage("");
    setInviteSending(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdminMessage(`Invitation sent to ${inviteEmail}.`);
        setInviteEmail("");
      } else {
        setAdminMessage(`Error: ${data.error}`);
      }
    } catch {
      setAdminMessage("Error: Failed to send invitation.");
    } finally {
      setInviteSending(false);
    }
  };

  if (loading || !user) {
    return <div className="text-center mt-8">Loading...</div>;
  }

  if (!user.isAdmin) return null;

  const filteredUsers = adminUsers.filter((u) => {
    if (adminFilter === "verified") return u.isVerified;
    if (adminFilter === "pending") return !u.isVerified;
    if (adminFilter === "admins") return u.isAdmin;
    return true;
  });

  return (
    <div>
      <nav className="breadcrumb">
        <Link href="/dashboard">Dashboard</Link>
        <ChevronRight size={14} className="separator" />
        <Link href="/settings">Settings</Link>
        <ChevronRight size={14} className="separator" />
        <span>Administration</span>
      </nav>

      <div className="page-header">
        <h2>User Management</h2>
      </div>

      <div
        className="glass-panel"
        style={{
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        }}
      >
        {adminMessage && (
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "8px",
              background: adminMessage.startsWith("Error")
                ? "rgba(236,72,153,0.15)"
                : "rgba(16,185,129,0.15)",
              color: adminMessage.startsWith("Error")
                ? "var(--accent-pink)"
                : "#10b981",
            }}
          >
            {adminMessage}
          </p>
        )}

        {/* Create user form */}
        <div>
          <h4
            style={{
              margin: "0 0 0.75rem",
              fontSize: "0.9rem",
              color: "var(--text-muted)",
            }}
          >
            Create User
          </h4>
          <form
            onSubmit={handleCreateUser}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <input
              className="form-input"
              style={{
                flex: "1 1 160px",
                padding: "0.5rem",
                fontSize: "0.85rem",
              }}
              placeholder="Email"
              type="email"
              value={newUser.email}
              onChange={(e) =>
                setNewUser({ ...newUser, email: e.target.value })
              }
              required
            />
            <input
              className="form-input"
              style={{
                flex: "1 1 120px",
                padding: "0.5rem",
                fontSize: "0.85rem",
              }}
              placeholder="Username"
              value={newUser.username}
              onChange={(e) =>
                setNewUser({ ...newUser, username: e.target.value })
              }
              required
            />
            <input
              className="form-input"
              style={{
                flex: "1 1 120px",
                padding: "0.5rem",
                fontSize: "0.85rem",
              }}
              placeholder="Password"
              type="password"
              value={newUser.password}
              onChange={(e) =>
                setNewUser({ ...newUser, password: e.target.value })
              }
              required
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.85rem",
                whiteSpace: "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={newUser.isAdmin}
                onChange={(e) =>
                  setNewUser({ ...newUser, isAdmin: e.target.checked })
                }
              />
              Admin
            </label>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: "0.5rem 1rem" }}
            >
              <UserPlus size={16} /> Create
            </button>
          </form>
        </div>

        {/* Invite user by email */}
        <div>
          <h4
            style={{
              margin: "0 0 0.75rem",
              fontSize: "0.9rem",
              color: "var(--text-muted)",
            }}
          >
            <Mail
              size={14}
              style={{
                display: "inline",
                verticalAlign: "middle",
                marginRight: "0.4rem",
              }}
            />
            Invite User by Email
          </h4>
          <form
            onSubmit={handleInvite}
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              className="form-input"
              style={{
                flex: 1,
                padding: "0.5rem",
                fontSize: "0.85rem",
                minWidth: "200px",
              }}
              placeholder="Enter email address to invite..."
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: "0.5rem 1rem" }}
              disabled={inviteSending || !inviteEmail.trim()}
            >
              <Send size={16} />{" "}
              {inviteSending ? "Sending..." : "Send Invite"}
            </button>
          </form>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              margin: "0.4rem 0 0",
              opacity: 0.7,
            }}
          >
            The invitee will receive a link to create their account. No email
            verification required.
          </p>
        </div>

        {/* Filter tabs & user list */}
        <div>
          <div
            className="flex align-center"
            style={{
              margin: "0 0 0.75rem",
              gap: "0.5rem",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: "0.9rem",
                color: "var(--text-muted)",
              }}
            >
              All Users ({adminUsers.length})
            </h4>
            <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
              {[
                { key: "all", label: "All" },
                { key: "verified", label: "Verified" },
                { key: "pending", label: "Pending" },
                { key: "admins", label: "Admins" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setAdminFilter(f.key)}
                  className={`btn ${
                    adminFilter === f.key ? "btn-primary" : "btn-outline"
                  }`}
                  style={{
                    padding: "0.2rem 0.6rem",
                    fontSize: "0.75rem",
                    borderRadius: "6px",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            {filteredUsers.map((u) => (
              <div
                key={u.userId}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  padding: "0.75rem",
                  borderRadius: "10px",
                  border: !u.isVerified
                    ? "1px solid rgba(251,191,36,0.3)"
                    : "1px solid transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.875rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{u.username}</span>
                    <span style={{ opacity: 0.5 }}>{u.email}</span>
                    {u.isAdmin && (
                      <span
                        style={{
                          color: "var(--accent-blue)",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          padding: "0.1rem 0.4rem",
                          background: "rgba(59,130,246,0.15)",
                          borderRadius: "4px",
                        }}
                      >
                        ADMIN
                      </span>
                    )}
                    {u.isVerified ? (
                      <span
                        style={{
                          color: "#10b981",
                          fontSize: "0.7rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                        }}
                      >
                        <CheckCircle2 size={12} /> Verified
                      </span>
                    ) : (
                      <span
                        style={{
                          color: "#fbbf24",
                          fontSize: "0.7rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                        }}
                      >
                        <Clock size={12} /> Pending Verification
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.4rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() =>
                        handleToggleAdmin(u.userId, u.isAdmin)
                      }
                      className="btn btn-outline"
                      style={{
                        padding: "0.25rem 0.6rem",
                        fontSize: "0.75rem",
                      }}
                      title={
                        u.isAdmin
                          ? "Remove admin role"
                          : "Grant admin role"
                      }
                      disabled={u.userId === user.userId}
                    >
                      {u.isAdmin ? (
                        <ShieldOff size={13} />
                      ) : (
                        <ShieldCheck size={13} />
                      )}
                      {u.isAdmin ? " Revoke Admin" : " Make Admin"}
                    </button>
                    <button
                      onClick={() => {
                        setResetPasswordUserId(
                          resetPasswordUserId === u.userId
                            ? null
                            : u.userId
                        );
                        setResetPasswordValue("");
                      }}
                      className={`btn ${
                        resetPasswordUserId === u.userId
                          ? "btn-primary"
                          : "btn-outline"
                      }`}
                      style={{
                        padding: "0.25rem 0.6rem",
                        fontSize: "0.75rem",
                      }}
                      title="Reset password"
                    >
                      <KeyRound size={13} /> Reset Password
                    </button>
                    <button
                      onClick={() =>
                        handleDeleteUser(u.userId, u.username)
                      }
                      className="btn btn-outline"
                      style={{
                        padding: "0.25rem 0.6rem",
                        fontSize: "0.75rem",
                        color: "var(--accent-pink)",
                      }}
                      title="Delete user"
                      disabled={u.userId === user.userId}
                    >
                      <UserX size={13} /> Delete
                    </button>
                  </div>
                </div>

                {/* Inline password reset form */}
                {resetPasswordUserId === u.userId && (
                  <div
                    style={{
                      marginTop: "0.6rem",
                      display: "flex",
                      gap: "0.4rem",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      className="form-input"
                      style={{
                        flex: 1,
                        padding: "0.4rem 0.6rem",
                        fontSize: "0.8rem",
                        minWidth: "180px",
                      }}
                      type="password"
                      placeholder="New password (min 12 chars, upper/lower/digit/symbol)"
                      value={resetPasswordValue}
                      onChange={(e) =>
                        setResetPasswordValue(e.target.value)
                      }
                      autoFocus
                    />
                    <button
                      onClick={() =>
                        handleResetPassword(u.userId, u.username)
                      }
                      className="btn btn-primary"
                      style={{
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.8rem",
                      }}
                      disabled={resetPasswordValue.length < 12}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => {
                        setResetPasswordUserId(null);
                        setResetPasswordValue("");
                      }}
                      className="btn btn-outline"
                      style={{
                        padding: "0.4rem 0.6rem",
                        fontSize: "0.8rem",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
            {adminUsers.length === 0 && (
              <p
                style={{ opacity: 0.5, fontSize: "0.875rem", margin: 0 }}
              >
                No users found.
              </p>
            )}
            {adminUsers.length > 0 && filteredUsers.length === 0 && (
              <p
                style={{ opacity: 0.5, fontSize: "0.875rem", margin: 0 }}
              >
                No users match this filter.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
