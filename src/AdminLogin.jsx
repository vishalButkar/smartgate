
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Papa from "papaparse";

function AdminLogin({ goHome }) {
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState("students");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [stats, setStats] = useState({
    students: 0,
    requests: 0,
    approvers: 0,
  });

  const [studentFile, setStudentFile] = useState(null);
  const [uploadReport, setUploadReport] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [faculty, setFaculty] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");

  const departments = [
    ...new Set(faculty.map((item) => item.department).filter(Boolean)),
  ].sort();

  useEffect(() => {
    checkAdminSession();
  }, []);

  const checkAdminSession = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) throw error;

      if (!data.user) return;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.role === "admin") {
        setAdmin(profile);
        await loadDashboard();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const email = form.get("email").trim();
    const password = form.get("password");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile || profile.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("This account is not authorized as Administrator.");
      }

      setAdmin(profile);
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    const [students, requests, approvers] = await Promise.all([
      supabase.from("student_master").select("uid", {
        count: "exact",
        head: true,
      }),
      supabase.from("gate_passes").select("id", {
        count: "exact",
        head: true,
      }),
      supabase
        .from("department_approvers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    setStats({
      students: students.count ?? 0,
      requests: requests.count ?? 0,
      approvers: approvers.count ?? 0,
    });

    await loadFaculty();
  };

  const loadFaculty = async () => {
    const [facultyResult, assignmentResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, uid, full_name, email, department, designation, role")
        .in("role", ["faculty", "approver"])
        .order("department")
        .order("full_name"),

      supabase
        .from("department_approvers")
        .select("id, user_id, department, is_active"),
    ]);

    if (facultyResult.error) {
      setError(facultyResult.error.message);
      return;
    }

    if (assignmentResult.error) {
      setError(assignmentResult.error.message);
      return;
    }

    setFaculty(facultyResult.data || []);
    setAssignments(assignmentResult.data || []);

    if (!selectedDepartment && facultyResult.data?.length) {
      setSelectedDepartment(facultyResult.data[0].department);
    }
  };

  // STUDENT CSV UPLOAD

  const normalizeHeader = (value) =>
    String(value || "").trim().toLowerCase();

  const normalizeUID = (value) => {
    const raw = String(value ?? "").trim();

    if (/^STGGSF-Engin\d{2,6}$/i.test(raw)) {
      return "STGGSF-Engin" + raw.replace(/^STGGSF-Engin/i, "");
    }

    if (/^\d{2,6}$/.test(raw)) {
      return "STGGSF-Engin" + raw;
    }

    return null;
  };

  const handleCSVUpload = () => {
    if (!studentFile) {
      setError("Please select a CSV file first.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    setUploadReport(null);

    Papa.parse(studentFile, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,

      complete: async (results) => {
        try {
          const required = [
            "uid",
            "name",
            "email",
            "mobile",
            "department",
            "year",
          ];

          const headers = results.meta.fields || [];
          const missing = required.filter((h) => !headers.includes(h));

          if (missing.length) {
            throw new Error(
              "Missing CSV columns: " + missing.join(", ") +
              ". Please use the six required column headings."
            );
          }

          const validRows = [];
          const rejectedRows = [];
          const seenUIDs = new Set();

          results.data.forEach((row, index) => {
            const uid = normalizeUID(row.uid);
            const name = String(row.name || "").trim();
            const email = String(row.email || "").trim().toLowerCase();
            const mobile = String(row.mobile || "").trim();
            const department = String(row.department || "").trim();
            const year = String(row.year || "").trim();

            if (
              !uid ||
              !name ||
              !email ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
              !/^\d{10}$/.test(mobile) ||
              !department ||
              !year
            ) {
              rejectedRows.push({
                row: index + 2,
                reason: "Invalid or missing student details",
              });
              return;
            }

            if (seenUIDs.has(uid)) {
              rejectedRows.push({
                row: index + 2,
                reason: "Duplicate UID in CSV",
              });
              return;
            }

            seenUIDs.add(uid);

            validRows.push({
              uid,
              name,
              email,
              mobile,
              department,
              year,
            });
          });

          if (!validRows.length) {
            throw new Error("No valid student records found in this CSV.");
          }

          // Upload in batches of 100 records
          let uploaded = 0;

          for (let i = 0; i < validRows.length; i += 100) {
            const batch = validRows.slice(i, i + 100);

            const { error } = await supabase
              .from("student_master")
              .upsert(batch, { onConflict: "uid" });

            if (error) {
              throw new Error(
                `Upload stopped after ${uploaded} records: ${error.message}`
              );
            }

            uploaded += batch.length;
          }

          setUploadReport({
            total: results.data.length,
            uploaded,
            rejected: rejectedRows.length,
            rejectedRows,
          });

          setMessage(
            `${uploaded} student records uploaded or updated successfully.`
          );

          setStudentFile(null);
          await loadDashboard();
        } catch (err) {
          setError(err.message);
        } finally {
          setUploading(false);
        }
      },

      error: (err) => {
        setError(err.message);
        setUploading(false);
      },
    });
  };

  // APPROVER MANAGEMENT

  const isAssigned = (userId, department) =>
    assignments.some(
      (item) =>
        item.user_id === userId &&
        item.department === department &&
        item.is_active
    );

  const assignApprover = async () => {
    if (!selectedFaculty || !selectedDepartment) {
      setError("Select a department and faculty member.");
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.rpc(
        "admin_set_department_approver",
        {
          p_user_id: selectedFaculty,
          p_department: selectedDepartment,
          p_is_active: true,
        }
      );

      if (error) throw error;

      setMessage("Approver assigned successfully.");
      setSelectedFaculty("");
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deactivateApprover = async (userId, department) => {
    if (!window.confirm("Deactivate this department approver?")) return;

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.rpc(
        "admin_set_department_approver",
        {
          p_user_id: userId,
          p_department: department,
          p_is_active: false,
        }
      );

      if (error) throw error;

      setMessage("Approver deactivated successfully.");
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAdmin(null);
    if (goHome) goHome();
  };

  // LOGIN SCREEN

  if (!admin) {
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
              name="email"
              placeholder="Administrator email"
              required
            />

            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              name="password"
              placeholder="Password"
              required
            />

            {error && <p style={styles.error}>{error}</p>}

            <button style={styles.primaryButton} disabled={loading}>
              {loading ? "Verifying..." : "Secure Administrator Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ADMIN DASHBOARD

  return (
    <div style={styles.page}>
      <div style={styles.dashboard}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.heading}>SmartGate Administration</h1>
            <p style={styles.subheading}>
              GCOERC – Administrator Portal
            </p>
            <strong>Welcome, {admin.full_name}</strong>
          </div>

          <button style={styles.logoutButton} onClick={logout}>
            Logout
          </button>
        </header>

        {error && <p style={styles.error}>{error}</p>}
        {message && <p style={styles.success}>{message}</p>}

        <div style={styles.statsGrid}>
          <Stat title="Total Students" value={stats.students} />
          <Stat title="Gate Pass Requests" value={stats.requests} />
          <Stat title="Active Approvers" value={stats.approvers} />
        </div>

        <nav style={styles.tabs}>
          <button
            style={tab === "students" ? styles.activeTab : styles.tab}
            onClick={() => setTab("students")}
          >
            Student CSV Upload
          </button>

          <button
            style={tab === "approvers" ? styles.activeTab : styles.tab}
            onClick={() => setTab("approvers")}
          >
            Approver Management
          </button>
        </nav>

        {tab === "students" && (
          <section style={styles.section}>
            <h2>Student Master Data Upload</h2>

            <p>
              Upload a CSV containing UID, Name, Email, Mobile,
              Department and Year.
            </p>

            <p style={styles.hint}>
              UID can be numeric (2–6 digits) or already prefixed
              with STGGSF-Engin.
            </p>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setStudentFile(event.target.files?.[0] || null);
                setUploadReport(null);
                setError("");
                setMessage("");
              }}
            />

            {studentFile && (
              <p>Selected file: {studentFile.name}</p>
            )}

            <button
              style={styles.primaryButton}
              onClick={handleCSVUpload}
              disabled={uploading || !studentFile}
            >
              {uploading ? "Uploading..." : "Validate and Upload CSV"}
            </button>

            {uploadReport && (
              <div style={styles.report}>
                <h3>Upload Report</h3>
                <p>Total rows: {uploadReport.total}</p>
                <p>Uploaded or updated: {uploadReport.uploaded}</p>
                <p>Rejected: {uploadReport.rejected}</p>

                {uploadReport.rejectedRows.length > 0 && (
                  <details>
                    <summary>View rejected rows</summary>
                    {uploadReport.rejectedRows.map((item) => (
                      <p key={item.row}>
                        Row {item.row}: {item.reason}
                      </p>
                    ))}
                  </details>
                )}
              </div>
            )}
          </section>
        )}

        {tab === "approvers" && (
          <section style={styles.section}>
            <h2>Department-wise Approver Management</h2>

            {faculty.length === 0 ? (
              <p style={styles.hint}>
                No faculty profiles are available yet. Create and
                provision faculty accounts before assigning approvers.
              </p>
            ) : (
              <>
                <label style={styles.label}>Select Department</label>
                <select
                  style={styles.input}
                  value={selectedDepartment}
                  onChange={(event) => {
                    setSelectedDepartment(event.target.value);
                    setSelectedFaculty("");
                  }}
                >
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>

                <label style={styles.label}>Select Faculty Member</label>
                <select
                  style={styles.input}
                  value={selectedFaculty}
                  onChange={(event) => setSelectedFaculty(event.target.value)}
                >
                  <option value="">Choose faculty</option>
                  {faculty
                    .filter(
                      (person) =>
                        person.department === selectedDepartment &&
                        !isAssigned(person.id, selectedDepartment)
                    )
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.full_name} – {person.email}
                      </option>
                    ))}
                </select>

                <button
                  style={styles.primaryButton}
                  onClick={assignApprover}
                  disabled={loading || !selectedFaculty}
                >
                  {loading ? "Please wait..." : "Assign as Approver"}
                </button>

                <h3 style={{ marginTop: 30 }}>
                  Active Approvers – {selectedDepartment}
                </h3>

                <div style={{ overflowX: "auto" }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>UID</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {faculty
                        .filter(
                          (person) =>
                            person.department === selectedDepartment &&
                            isAssigned(person.id, selectedDepartment)
                        )
                        .map((person) => (
                          <tr key={person.id}>
                            <td>{person.full_name}</td>
                            <td>{person.email}</td>
                            <td>{person.uid}</td>
                            <td>
                              <button
                                style={styles.deactivateButton}
                                onClick={() =>
                                  deactivateApprover(
                                    person.id,
                                    selectedDepartment
                                  )
                                }
                              >
                                Deactivate
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        <button style={styles.homeButton} onClick={goHome}>
          Back to SmartGate Home
        </button>
      </div>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div style={styles.statCard}>
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#eef3f9",
    padding: "25px 14px",
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
  },
  dashboard: {
    maxWidth: "1150px",
    margin: "auto",
    background: "#fff",
    borderRadius: "14px",
    padding: "25px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  },
  loginCard: {
    maxWidth: "430px",
    margin: "50px auto",
    padding: "30px",
    background: "#fff",
    borderRadius: "14px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "15px",
    flexWrap: "wrap",
    borderBottom: "1px solid #ddd",
    paddingBottom: "18px",
  },
  heading: { color: "#12345a", marginBottom: "8px" },
  subheading: { color: "#64748b", marginTop: "4px" },
  lockIcon: { fontSize: "48px", textAlign: "center", margin: "20px" },
  label: {
    display: "block",
    fontWeight: "bold",
    margin: "17px 0 7px",
    color: "#24364b",
  },
  input: {
    width: "100%",
    padding: "12px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    boxSizing: "border-box",
    background: "#fff",
  },
  primaryButton: {
    display: "block",
    marginTop: "20px",
    padding: "12px 18px",
    background: "#123e69",
    color: "#fff",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  logoutButton: {
    background: "#b42318",
    color: "#fff",
    border: "none",
    padding: "11px 18px",
    borderRadius: "7px",
    cursor: "pointer",
  },
  backButton: {
    border: "none",
    background: "transparent",
    color: "#123e69",
    cursor: "pointer",
  },
  homeButton: {
    marginTop: "25px",
    padding: "12px 18px",
    background: "#334155",
    color: "#fff",
    border: "none",
    borderRadius: "7px",
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
    gap: "14px",
    margin: "25px 0",
  },
  statCard: {
    padding: "17px",
    textAlign: "center",
    background: "#edf5ff",
    borderRadius: "9px",
  },
  tabs: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    borderBottom: "1px solid #ddd",
    paddingBottom: "12px",
  },
  tab: {
    padding: "11px 17px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    borderRadius: "7px",
    cursor: "pointer",
  },
  activeTab: {
    padding: "11px 17px",
    border: "none",
    background: "#123e69",
    color: "#fff",
    borderRadius: "7px",
    cursor: "pointer",
  },
  section: {
    padding: "20px 0",
  },
  hint: {
    color: "#64748b",
    fontSize: "14px",
  },
  success: {
    background: "#e8f7ed",
    color: "#176b35",
    padding: "12px",
    borderRadius: "7px",
  },
  error: {
    background: "#fff0f0",
    color: "#b42318",
    padding: "12px",
    borderRadius: "7px",
  },
  report: {
    background: "#f1f5f9",
    padding: "15px",
    borderRadius: "8px",
    marginTop: "20px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },
  deactivateButton: {
    background: "#b42318",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    padding: "7px 10px",
    cursor: "pointer",
  },
};

export default AdminLogin;
