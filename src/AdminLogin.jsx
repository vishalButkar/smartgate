
import { useState } from "react";
import { supabase } from "./supabase";


function AdminLogin({ goHome }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [admin, setAdmin] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    students: "—",
    requests: "—",
    approvers: "—",
  });

  const handleLogin = async (event) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      // Authenticate using Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      // Verify that this account has the Administrator role
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, designation")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile || profile.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("Administrator access denied. This account is not authorized.");
      }

      setAdmin(profile);
      setPassword("");

      // Load dashboard counts
      const [studentResult, requestResult, approverResult] =
        await Promise.all([
          supabase
            .from("student_master")
            .select("uid", { count: "exact", head: true }),

          supabase
            .from("gate_passes")
            .select("id", { count: "exact", head: true }),

          supabase
            .from("department_approvers")
            .select("id", { count: "exact", head: true }),
        ]);

      setStats({
        students: studentResult.error ? "—" : studentResult.count ?? 0,
        requests: requestResult.error ? "—" : requestResult.count ?? 0,
        approvers: approverResult.error ? "—" : approverResult.count ?? 0,
      });
    } catch (error) {
      setMessage(error.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAdmin(null);
    setEmail("");
    setPassword("");
    setMessage("");
    if (goHome) goHome();
  };

  // ADMIN DASHBOARD
  if (admin) {
    return (
      <div style={styles.page}>
        <div style={styles.dashboard}>
          <div style={styles.topBar}>
            <div>
              <h1 style={styles.heading}>SmartGate Administrator</h1>
              <p style={styles.subheading}>
                GCOERC – Student Gate Pass Management System
              </p>
            </div>

            <button style={styles.logoutButton} onClick={handleLogout}>
              Logout
            </button>
          </div>

          <div style={styles.welcome}>
            <h2>Welcome, {admin.full_name}</h2>
            <p>{admin.email}</p>
            <strong>Administrator</strong>
          </div>

          <h2 style={styles.sectionHeading}>Administration Overview</h2>

          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <h3>Total Students</h3>
              <p>{stats.students}</p>
            </div>

            <div style={styles.statCard}>
              <h3>Gate Pass Requests</h3>
              <p>{stats.requests}</p>
            </div>

            <div style={styles.statCard}>
              <h3>Department Approvers</h3>
              <p>{stats.approvers}</p>
            </div>
          </div>

          <h2 style={styles.sectionHeading}>Management Modules</h2>

          <div style={styles.modulesGrid}>
            <div style={styles.moduleCard}>
              <h3>Student Management</h3>
              <p>Manage student master records and CSV uploads.</p>
              <span>Next implementation</span>
            </div>

            <div style={styles.moduleCard}>
              <h3>Approver Management</h3>
              <p>Assign multiple approvers to each department.</p>
              <span>Next implementation</span>
            </div>

            <div style={styles.moduleCard}>
              <h3>Faculty Management</h3>
              <p>Manage authorized faculty and staff accounts.</p>
              <span>Next implementation</span>
            </div>

            <div style={styles.moduleCard}>
              <h3>Gate Pass Monitoring</h3>
              <p>View and monitor all student gate pass requests.</p>
              <span>Next implementation</span>
            </div>
          </div>

          <button style={styles.homeButton} onClick={goHome}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ADMIN LOGIN
  return (
    <div style={styles.page}>
      <div style={styles.loginCard}>
        <button style={styles.backButton} onClick={goHome}>
          ← Back to Home
        </button>

        <div style={styles.lockIcon}>🔐</div>

        <h1 style={styles.heading}>Administrator Login</h1>

        <p style={styles.subheading}>
          SmartGate – GCOERC Administration Portal
        </p>

        <form onSubmit={handleLogin}>
          <label style={styles.label}>Official College Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="Enter administrator email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {message && <p style={styles.error}>{message}</p>}

          <button
            style={styles.loginButton}
            type="submit"
            disabled={loading}
          >
            {loading ? "Verifying..." : "Secure Administrator Login"}
          </button>
        </form>

        <p style={styles.note}>
          Authorized administrator accounts only.
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#eef3f9",
    padding: "35px 16px",
    boxSizing: "border-box",
    fontFamily: "Arial, sans-serif",
  },
  loginCard: {
    maxWidth: "430px",
    margin: "45px auto",
    background: "#ffffff",
    padding: "30px",
    borderRadius: "14px",
    boxShadow: "0 5px 25px rgba(0,0,0,0.10)",
  },
  dashboard: {
    maxWidth: "1100px",
    margin: "0 auto",
    background: "#ffffff",
    padding: "28px",
    borderRadius: "14px",
    boxShadow: "0 5px 25px rgba(0,0,0,0.08)",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
    borderBottom: "1px solid #ddd",
    paddingBottom: "18px",
  },
  heading: { color: "#12345a", marginBottom: "8px" },
  subheading: { color: "#64748b", marginTop: 0 },
  lockIcon: { fontSize: "48px", textAlign: "center", marginTop: "20px" },
  label: {
    display: "block",
    fontWeight: "bold",
    marginTop: "18px",
    marginBottom: "7px",
    color: "#24364b",
  },
  input: {
    width: "100%",
    padding: "12px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    boxSizing: "border-box",
    fontSize: "15px",
  },
  loginButton: {
    width: "100%",
    marginTop: "24px",
    padding: "13px",
    background: "#123e69",
    color: "white",
    border: "none",
    borderRadius: "7px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  backButton: {
    border: "none",
    background: "transparent",
    color: "#123e69",
    cursor: "pointer",
    fontWeight: "bold",
  },
  logoutButton: {
    background: "#b42318",
    color: "white",
    border: "none",
    borderRadius: "7px",
    padding: "11px 20px",
    cursor: "pointer",
  },
  homeButton: {
    marginTop: "25px",
    background: "#123e69",
    color: "white",
    border: "none",
    padding: "12px 20px",
    borderRadius: "7px",
    cursor: "pointer",
  },
  error: {
    color: "#b42318",
    background: "#fff0f0",
    padding: "10px",
    borderRadius: "6px",
  },
  note: {
    textAlign: "center",
    color: "#64748b",
    fontSize: "13px",
    marginTop: "20px",
  },
  welcome: {
    background: "#edf5ff",
    padding: "18px",
    borderRadius: "10px",
    marginTop: "22px",
  },
  sectionHeading: { color: "#12345a", marginTop: "28px" },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "15px",
  },
  statCard: {
    background: "#f1f5f9",
    padding: "18px",
    borderRadius: "10px",
    textAlign: "center",
  },
  modulesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "15px",
  },
  moduleCard: {
    border: "1px solid #dbe3ed",
    borderRadius: "10px",
    padding: "18px",
  },
};

export default AdminLogin;
