import { useNavigate } from "../router";

export default function ImportContacts() {
  const navigate = useNavigate();

  return (
    <div style={{ background: "var(--paper)", color: "var(--ink)", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: "560px",
          margin: "0 auto",
          padding: "64px 16px 24px",
          boxSizing: "border-box",
          minHeight: "100vh",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/home")}
          style={{
            padding: 0,
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "var(--muted)",
            fontSize: "0.95rem",
            fontWeight: 500,
          }}
        >
          ← Back
        </button>

        <div style={{ marginTop: "24px", textAlign: "center", display: "grid", gap: "14px" }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600 }}>
            Contact import coming soon
          </div>
          <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>
            You can keep adding people manually in this version.
          </div>
          <div style={{ marginTop: "8px" }}>
            <button type="button" onClick={() => navigate("/add")}>
              + Add someone
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
