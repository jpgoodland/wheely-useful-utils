"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import {
  PlusCircle,
  PlayCircle,
  Settings,
  Trash2,
  Plus,
  ChevronRight,
  Search,
  X,
  Loader2,
  Users,
} from "lucide-react";

export default function WheelFeature() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [wheels, setWheels] = useState([]);
  const [newWheelName, setNewWheelName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingWheelId, setEditingWheelId] = useState(null);
  const [newCatNames, setNewCatNames] = useState({});
  const [shareIdentifier, setShareIdentifier] = useState("");
  const [shareRole, setShareRole] = useState("viewer");
  const [shareMessage, setShareMessage] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeWheelDetails, setActiveWheelDetails] = useState(null);

  const loadWheelDetails = async (wheelId) => {
    try {
      const res = await fetch(`/api/wheels/${wheelId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveWheelDetails(data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (!shareIdentifier || selectedUser || shareIdentifier.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(shareIdentifier.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (e) {
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [shareIdentifier, selectedUser]);

  const fetchWheels = async () => {
    try {
      const res = await fetch("/api/wheels");
      if (res.ok) {
        const data = await res.json();
        setWheels(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (user) {
      fetchWheels();
    }
  }, [user, loading, router]);

  const createWheel = async (e) => {
    e.preventDefault();
    if (!newWheelName.trim()) return;

    setIsCreating(true);
    try {
      const categories = [
        { name: "Option A", weight: 10, color: "#3b82f6" },
        { name: "Option B", weight: 10, color: "#ec4899" },
        { name: "Option C", weight: 10, color: "#10b981" },
      ];

      const res = await fetch("/api/wheels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWheelName, categories }),
      });

      if (res.ok) {
        setNewWheelName("");
        fetchWheels();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const deleteWheel = async (id) => {
    if (!confirm("Are you sure you want to delete this wheel?")) return;
    try {
      const res = await fetch(`/api/wheels/${id}`, { method: "DELETE" });
      if (res.ok) {
        setWheels(wheels.filter((w) => w.wheelId !== id));
      }
    } catch (e) {}
  };

  const handleAddCategory = async (e, wheel) => {
    e.preventDefault();
    const catName = newCatNames[wheel.wheelId];
    if (!catName?.trim()) return;

    const colors = [
      "#f87171",
      "#fbbf24",
      "#34d399",
      "#60a5fa",
      "#a78bfa",
      "#f472b6",
    ];

    let weight = 10;
    if (wheel.categories && wheel.categories.length > 0) {
      const totalW = wheel.categories.reduce((s, c) => s + c.weight, 0);
      weight = totalW / wheel.categories.length;
    }

    const newCat = {
      id: crypto.randomUUID(),
      name: catName,
      weight: Number(weight),
      color: colors[Math.floor(Math.random() * colors.length)],
      selectedCount: 0,
    };

    const newCategories = [...(wheel.categories || []), newCat];

    try {
      const res = await fetch(`/api/wheels/${wheel.wheelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateCategories",
          payload: newCategories,
        }),
      });
      if (res.ok) {
        setWheels(
          wheels.map((w) =>
            w.wheelId === wheel.wheelId
              ? { ...w, categories: newCategories }
              : w
          )
        );
        setNewCatNames({ ...newCatNames, [wheel.wheelId]: "" });
      }
    } catch (e) {}
  };

  const handleDeleteCategory = async (wheel, catId) => {
    const newCategories = wheel.categories.filter((c) => c.id !== catId);
    try {
      const res = await fetch(`/api/wheels/${wheel.wheelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateCategories",
          payload: newCategories,
        }),
      });
      if (res.ok) {
        setWheels(
          wheels.map((w) =>
            w.wheelId === wheel.wheelId
              ? { ...w, categories: newCategories }
              : w
          )
        );
      }
    } catch (e) {}
  };

  const handleCategoryNameChange = (wheelId, catId, newName) => {
    setWheels(
      wheels.map((w) => {
        if (w.wheelId !== wheelId) return w;
        return {
          ...w,
          categories: w.categories.map((c) =>
            c.id === catId ? { ...c, name: newName } : c
          ),
        };
      })
    );
  };

  const handleCategoryColorChange = (wheelId, catId, newColor) => {
    setWheels(
      wheels.map((w) => {
        if (w.wheelId !== wheelId) return w;
        return {
          ...w,
          categories: w.categories.map((c) =>
            c.id === catId ? { ...c, color: newColor } : c
          ),
        };
      })
    );
  };

  const handleCategoryNameSave = async (wheel) => {
    try {
      await fetch(`/api/wheels/${wheel.wheelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateCategories",
          payload: wheel.categories,
        }),
      });
    } catch (e) {}
  };

  const handleSelectUser = (u) => {
    setSelectedUser(u);
    setShareIdentifier(u.email || u.username);
    setSearchResults([]);
  };

  const handleClearSelectedUser = () => {
    setSelectedUser(null);
    setShareIdentifier("");
    setSearchResults([]);
  };

  const handleShare = async (e, wheel) => {
    e.preventDefault();
    setShareMessage("");
    try {
      const identifier = selectedUser
        ? selectedUser.userId
        : shareIdentifier.trim();
      const res = await fetch(`/api/wheels/${wheel.wheelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "share",
          payload: { identifier, role: shareRole },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShareMessage(data.message);
        setShareIdentifier("");
        setSelectedUser(null);
        setSearchResults([]);
        loadWheelDetails(wheel.wheelId);
        fetchWheels();
      } else {
        setShareMessage(`Error: ${data.error}`);
      }
    } catch (e) {
      setShareMessage("Failed to share.");
    }
  };

  const handleUnshare = async (wheelId, targetUserId) => {
    try {
      const res = await fetch(`/api/wheels/${wheelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unshare",
          payload: { userId: targetUserId },
        }),
      });
      if (res.ok) {
        loadWheelDetails(wheelId);
        fetchWheels();
      }
    } catch (e) {}
  };

  const handleResetProbabilities = async (wheel) => {
    const newCategories = (wheel.categories || []).map((c) => ({
      ...c,
      weight: 10,
      selectedCount: 0,
    }));
    try {
      const res = await fetch(`/api/wheels/${wheel.wheelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateCategories",
          payload: newCategories,
        }),
      });
      if (res.ok) {
        setWheels(
          wheels.map((w) =>
            w.wheelId === wheel.wheelId
              ? { ...w, categories: newCategories }
              : w
          )
        );
      }
    } catch (e) {}
  };

  if (loading || !user) {
    return <div className="text-center mt-8">Loading...</div>;
  }

  const ownedWheelsCount = wheels.filter(
    (w) => w.ownerId === user?.userId
  ).length;
  const isAtLimit = ownedWheelsCount >= 25;

  return (
    <div>
      <nav className="breadcrumb">
        <Link href="/dashboard">Dashboard</Link>
        <ChevronRight size={14} className="separator" />
        <span>Spin the Wheel</span>
      </nav>

      <div className="page-header">
        <h2>Wheel Configuration &amp; Management</h2>
      </div>

      <div className="glass-panel mb-8" style={{ padding: "1.5rem" }}>
        {isAtLimit ? (
          <div
            className="text-center"
            style={{ color: "var(--accent-pink)", fontWeight: "500" }}
          >
            You have reached the maximum allowed wheels (25). Please delete an
            existing wheel to create a new one.
          </div>
        ) : (
          <form
            onSubmit={createWheel}
            className="flex gap-4 align-center"
            style={{ flexWrap: "wrap" }}
          >
            <input
              type="text"
              className="form-input"
              placeholder="New wheel name..."
              value={newWheelName}
              onChange={(e) => setNewWheelName(e.target.value)}
              style={{ flex: 1, marginBottom: 0, minWidth: "200px" }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isCreating || !newWheelName.trim()}
            >
              <PlusCircle size={18} /> Create Wheel
            </button>
          </form>
        )}
      </div>

      <div className="wheels-grid">
        {wheels.map((w) => {
          const isOwner = w.ownerId === user.userId;
          const isCollaborator =
            isOwner ||
            (w.collaborators && w.collaborators.includes(user.userId));
          const isEditing = editingWheelId === w.wheelId;

          return (
            <div
              key={w.PK}
              className="glass-panel"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div className="flex justify-between align-center">
                <h3 style={{ margin: 0, fontSize: "1.25rem" }}>{w.name}</h3>
                {isOwner && (
                  <button
                    onClick={() => deleteWheel(w.wheelId)}
                    className="btn btn-outline"
                    style={{
                      border: "none",
                      color: "var(--accent-pink)",
                      padding: "0.25rem 0.5rem",
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <p style={{ fontSize: "0.875rem", margin: 0 }}>
                {isOwner ? "Role: Owner" : "Role: Shared Access"} •{" "}
                {w.categories?.length || 0} Categories
              </p>

              <div
                className="flex gap-4 mt-4"
                style={{ flexWrap: "wrap" }}
              >
                <Link
                  href={`/features/wheel/${w.wheelId}`}
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: "center", minWidth: "140px" }}
                >
                  <PlayCircle size={18} /> Spin Wheel
                </Link>
                {isCollaborator && (
                  <button
                    onClick={() => {
                      const nextId = isEditing ? null : w.wheelId;
                      setEditingWheelId(nextId);
                      setShareIdentifier("");
                      setSelectedUser(null);
                      setSearchResults([]);
                      setShareMessage("");
                      if (nextId) loadWheelDetails(nextId);
                    }}
                    className={`btn ${isEditing ? "btn-primary" : "btn-outline"}`}
                    style={{ padding: "0.75rem 1rem" }}
                  >
                    <Settings size={18} /> {isEditing ? "Done" : "Config"}
                  </button>
                )}
              </div>

              {isEditing && (
                <div
                  style={{
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: "12px",
                    padding: "1rem",
                    marginTop: "1rem",
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <div className="flex justify-between align-center mb-4" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                    <h4
                      style={{
                        fontSize: "0.9rem",
                        color: "var(--text-muted)",
                        margin: 0,
                      }}
                    >
                      Categories
                    </h4>
                    <button
                      onClick={() => handleResetProbabilities(w)}
                      className="btn btn-outline"
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.8rem",
                        color: "var(--accent-pink)",
                      }}
                    >
                      Reset Probabilities
                    </button>
                  </div>

                  <div
                    style={{
                      maxHeight: "200px",
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    {w.categories?.map((c) => (
                      <div
                        key={c.id}
                        className="flex justify-between align-center"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          padding: "0.5rem 0.75rem",
                          borderRadius: "6px",
                          flexWrap: "wrap",
                          gap: "0.5rem",
                        }}
                      >
                        <div className="flex align-center gap-4">
                          <input
                            type="color"
                            value={c.color || "#ffffff"}
                            onChange={(e) =>
                              handleCategoryColorChange(
                                w.wheelId,
                                c.id,
                                e.target.value
                              )
                            }
                            onBlur={() => handleCategoryNameSave(w)}
                            style={{
                              width: "24px",
                              height: "24px",
                              padding: 0,
                              border: "none",
                              borderRadius: "12px",
                              background: "transparent",
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                            title="Click to select color"
                          />
                          <input
                            value={c.name}
                            onChange={(e) =>
                              handleCategoryNameChange(
                                w.wheelId,
                                c.id,
                                e.target.value
                              )
                            }
                            onBlur={() => handleCategoryNameSave(w)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "inherit",
                              fontSize: "0.9rem",
                              borderBottom:
                                "1px dashed rgba(255,255,255,0.3)",
                              outline: "none",
                              minWidth: "100px",
                              maxWidth: "100%",
                            }}
                            title="Click to edit name"
                            maxLength={50}
                          />
                        </div>
                        <div className="flex align-center gap-4">
                          <button
                            onClick={() =>
                              handleDeleteCategory(w, c.id)
                            }
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--accent-pink)",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => handleAddCategory(e, w)}
                    className="mt-4 flex gap-2"
                    style={{
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <input
                      className="form-input"
                      style={{
                        flex: 1,
                        padding: "0.5rem",
                        fontSize: "0.85rem",
                        minWidth: "140px",
                      }}
                      placeholder="Add category..."
                      value={newCatNames[w.wheelId] || ""}
                      onChange={(e) =>
                        setNewCatNames({
                          ...newCatNames,
                          [w.wheelId]: e.target.value,
                        })
                      }
                      maxLength={50}
                    />
                    <button
                      type="submit"
                      className="btn btn-outline"
                      style={{ padding: "0.5rem" }}
                    >
                      <Plus size={16} />
                    </button>
                  </form>

                  {isOwner && (
                    <div
                      className="mt-8 pt-4"
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <h4
                        className="mb-3"
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 600,
                          margin: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <Users size={16} style={{ color: "var(--accent-blue)" }} />
                        Share Access
                      </h4>

                      {/* Active Shared Users List */}
                      {((activeWheelDetails?.collaboratorDetails?.length || 0) > 0 ||
                        (activeWheelDetails?.viewerDetails?.length || 0) > 0) && (
                        <div
                          style={{
                            marginBottom: "1rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                          }}
                        >
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            Currently shared with:
                          </span>
                          {activeWheelDetails?.collaboratorDetails?.map((cu) => (
                            <div
                              key={cu.userId}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "rgba(0,0,0,0.25)",
                                padding: "0.4rem 0.75rem",
                                borderRadius: "8px",
                                fontSize: "0.85rem",
                                gap: "0.5rem",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflow: "hidden" }}>
                                <span style={{ fontWeight: 500 }}>
                                  {cu.fullName || cu.username}
                                </span>
                                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                  @{cu.username}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    padding: "0.15rem 0.4rem",
                                    borderRadius: "4px",
                                    background: "rgba(59,130,246,0.2)",
                                    color: "#60a5fa",
                                  }}
                                >
                                  Collaborator
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUnshare(w.wheelId, cu.userId)}
                                title="Remove collaborator"
                                className="btn btn-outline"
                                style={{
                                  border: "none",
                                  color: "var(--accent-pink)",
                                  padding: "0.2rem",
                                  minWidth: "auto",
                                }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          {activeWheelDetails?.viewerDetails?.map((vu) => (
                            <div
                              key={vu.userId}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "rgba(0,0,0,0.25)",
                                padding: "0.4rem 0.75rem",
                                borderRadius: "8px",
                                fontSize: "0.85rem",
                                gap: "0.5rem",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflow: "hidden" }}>
                                <span style={{ fontWeight: 500 }}>
                                  {vu.fullName || vu.username}
                                </span>
                                <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                                  @{vu.username}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    padding: "0.15rem 0.4rem",
                                    borderRadius: "4px",
                                    background: "rgba(148,163,184,0.2)",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  Viewer
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUnshare(w.wheelId, vu.userId)}
                                title="Remove viewer"
                                className="btn btn-outline"
                                style={{
                                  border: "none",
                                  color: "var(--accent-pink)",
                                  padding: "0.2rem",
                                  minWidth: "auto",
                                }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Invite / Share Form */}
                      <form
                        onSubmit={(e) => handleShare(e, w)}
                        className="flex gap-2"
                        style={{
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            position: "relative",
                            flex: 1,
                            minWidth: "200px",
                          }}
                        >
                          {selectedUser ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: "rgba(59,130,246,0.15)",
                                border: "1px solid var(--accent-blue)",
                                borderRadius: "8px",
                                padding: "0.45rem 0.75rem",
                                fontSize: "0.85rem",
                              }}
                            >
                              <span>
                                <strong>{selectedUser.fullName}</strong>{" "}
                                <span style={{ opacity: 0.75, fontSize: "0.8rem" }}>
                                  (@{selectedUser.username})
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={handleClearSelectedUser}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--text-muted)",
                                  cursor: "pointer",
                                  padding: "2px",
                                }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                <input
                                  className="form-input"
                                  style={{
                                    width: "100%",
                                    padding: "0.5rem 2rem 0.5rem 2rem",
                                    fontSize: "0.85rem",
                                  }}
                                  placeholder="Search name, username, or email..."
                                  value={shareIdentifier}
                                  onChange={(e) => setShareIdentifier(e.target.value)}
                                  required
                                />
                                <Search
                                  size={15}
                                  style={{
                                    position: "absolute",
                                    left: "0.65rem",
                                    color: "var(--text-muted)",
                                    pointerEvents: "none",
                                  }}
                                />
                                {isSearching && (
                                  <Loader2
                                    size={15}
                                    style={{
                                      position: "absolute",
                                      right: "0.65rem",
                                      animation: "spin 1s linear infinite",
                                      color: "var(--accent-blue)",
                                    }}
                                  />
                                )}
                              </div>

                              {/* Autocomplete Dropdown */}
                              {searchResults.length > 0 && (
                                <div
                                  style={{
                                    position: "absolute",
                                    top: "calc(100% + 4px)",
                                    left: 0,
                                    right: 0,
                                    zIndex: 50,
                                    background: "#0f172a",
                                    border: "1px solid var(--glass-border)",
                                    borderRadius: "8px",
                                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                                    maxHeight: "180px",
                                    overflowY: "auto",
                                  }}
                                >
                                  {searchResults.map((result) => (
                                    <div
                                      key={result.userId}
                                      onMouseDown={() => handleSelectUser(result)}
                                      style={{
                                        padding: "0.5rem 0.75rem",
                                        cursor: "pointer",
                                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                                        fontSize: "0.85rem",
                                        transition: "background 0.15s ease",
                                      }}
                                      onMouseEnter={(e) =>
                                        (e.currentTarget.style.background =
                                          "rgba(59,130,246,0.15)")
                                      }
                                      onMouseLeave={(e) =>
                                        (e.currentTarget.style.background =
                                          "transparent")
                                      }
                                    >
                                      <div style={{ fontWeight: 500 }}>
                                        {result.fullName}{" "}
                                        <span
                                          style={{
                                            color: "var(--text-muted)",
                                            fontSize: "0.75rem",
                                          }}
                                        >
                                          @{result.username}
                                        </span>
                                      </div>
                                      <div
                                        style={{
                                          color: "var(--text-muted)",
                                          fontSize: "0.75rem",
                                        }}
                                      >
                                        {result.email}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <select
                          className="form-input"
                          style={{
                            width: "120px",
                            padding: "0.5rem",
                            fontSize: "0.85rem",
                          }}
                          value={shareRole}
                          onChange={(e) => setShareRole(e.target.value)}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="collaborator">Collaborator</option>
                        </select>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                        >
                          Share
                        </button>
                      </form>

                      {shareMessage && (
                        <p
                          className="mt-2"
                          style={{
                            fontSize: "0.85rem",
                            color: shareMessage.startsWith("Error")
                              ? "var(--accent-pink)"
                              : "#34d399",
                            margin: "0.5rem 0 0",
                          }}
                        >
                          {shareMessage}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {wheels.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              opacity: 0.6,
              padding: "2rem",
            }}
          >
            No wheels found. Create your first wheel to get started!
          </div>
        )}
      </div>
    </div>
  );
}
