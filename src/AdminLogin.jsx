import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import Papa from "papaparse";

const REQUIRED_COLUMNS = [
  "uid",
  "name",
  "email",
  "mobile",
  "department",
  "year",
];

function AdminLogin({ goHome }) {
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState("students");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [stats, setStats] = useState({
    students: 0,
    requests: 0,
    approvers: 0,
  });

  const [studentFile, setStudentFile] = useState(null);
  const [academicYear, setAcademicYear] = useState("2026-27");
  const [uploadReport, setUploadReport] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([]);

  const [faculty, setFaculty] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");

  const departments = useMemo(
    () =>
      [...new Set(faculty.map((person) => person.department).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b)),
    [faculty]
  );

  useEffect(() => {
    checkAdminSession();
    // Session is checked once when this page is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAdminSession = async () => {
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

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
      } else {
        await supabase.auth.signOut();
      }
    } catch (err) {
      setError(err.message || "Unable to verify administrator session.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) throw loginError;

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
      setError(err.message || "Administrator login failed.");
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    setError("");

    const [studentsResult, requestsResult, approversResult] = await Promise.all([
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

    const firstError =
      studentsResult.error || requestsResult.error || approversResult.error;
    if (firstError) throw firstError;

    setStats({
      students: studentsResult.count ?? 0,
      requests: requestsResult.count ?? 0,
      approvers: approversResult.count ?? 0,
    });

    await Promise.all([loadFaculty(), loadUploadHistory()]);
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

    if (facultyResult.error) throw facultyResult.error;
    if (assignmentResult.error) throw assignmentResult.error;

    const people = facultyResult.data || [];
    setFaculty(people);
    setAssignments(assignmentResult.data || []);

    if (people.length) {
      setSelectedDepartment((current) =>
        current && people.some((person) => person.department === current)
          ? current
          : people[0].department || ""
      );
    } else {
      setSelectedDepartment("");
    }
  };

  const loadUploadHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error: historyError } = await supabase
        .from("student_upload_history")
        .select(
          "id, file_name, academic_year, total_rows, inserted_rows, updated_rows, rejected_rows, uploaded_at"
        )
        .order("uploaded_at", { ascending: false })
        .limit(20);

      if (historyError) throw historyError;
      setUploadHistory(data || []);
    } catch (err) {
      setError((current) =>
        current ? `${current} | Upload history: ${err.message}` : err.message
      );
    } finally {
      setLoadingHistory(false);
    }
  };

  const normalizeHeader = (value) =>
    String(value || "").trim().toLowerCase();

  const normalizeUID = (value) => {
    const uid = String(value ?? "").trim();
    return /^\d{2,6}$/.test(uid) ? uid : null;
  };

  const saveUploadHistory = async (record) => {
    const { error: historyError } = await supabase
      .from("student_upload_history")
      .insert({
        file_name: record.fileName,
        academic_year: academicYear,
        total_rows: record.total,
        inserted_rows: record.inserted,
        updated_rows: record.updated,
        rejected_rows: record.rejected,
        uploaded_by: admin.id,
      });

    if (historyError) {
      throw new Error(
        `Student data was uploaded, but upload history could not be saved: ${historyError.message}`
      );
    }
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
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
      complete: async (results) => {
        let inserted = 0;
        let updated = 0;
        let validRows = [];
        const rejectedRows = [];
        const seenUIDs = new Set();

        try {
          const headers = results.meta.fields || [];
          const missing = REQUIRED_COLUMNS.filter(
            (column) => !headers.includes(column)
          );

          if (missing.length) {
            throw new Error(
              `Missing CSV columns: ${missing.join(", ")}. Required columns are UID, Name, Email, Mobile, Department and Year.`
            );
          }

          if (results.errors?.length) {
            throw new Error(
              `CSV parsing error: ${results.errors[0].message || "Please check the CSV file."}`
            );
          }

          (results.data || []).forEach((row, index) => {
            const uid = normalizeUID(row.uid);
            const name = String(row.name || "").trim();
            const email = String(row.email || "").trim().toLowerCase();
            const mobile = String(row.mobile || "").replace(/\s+/g, "");
            const department = String(row.department || "").trim();
            const year = String(row.year || "").trim();

            let reason = "";
            if (!uid) reason = "ERP ID must contain only 2–6 digits";
            else if (!name) reason = "Student name is missing";
            else if (
              !email ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ) reason = "Invalid or missing email";
            else if (!/^\d{10}$/.test(mobile))
              reason = "Mobile number must contain 10 digits";
            else if (!department) reason = "Department is missing";
            else if (!year) reason = "Year is missing";
            else if (seenUIDs.has(uid)) reason = "Duplicate ERP ID in this CSV";

            if (reason) {
              rejectedRows.push({ row: index + 2, reason });
              return;
            }

            seenUIDs.add(uid);
            validRows.push({ uid, name, email, mobile, department, year });
          });

          if (!validRows.length) {
            setUploadReport({
              total: results.data?.length || 0,
              inserted: 0,
              updated: 0,
              rejected: rejectedRows.length,
              rejectedRows,
            });
            throw new Error("No valid student records found in this CSV.");
          }

          // Read existing ERP IDs first so the report can distinguish inserts and updates.
          const allUIDs = validRows.map((row) => row.uid);
          const existingUIDs = new Set();

          for (let i = 0; i < allUIDs.length; i += 500) {
            const batchUIDs = allUIDs.slice(i, i + 500);
            const { data: existing, error: existingError } = await supabase
              .from("student_master")
              .select("uid")
              .in("uid", batchUIDs);

            if (existingError) throw existingError;
            (existing || []).forEach((item) => existingUIDs.add(item.uid));
          }

          inserted = validRows.filter((row) => !existingUIDs.has(row.uid)).length;
          updated = validRows.length - inserted;

          // Upsert in batches. UID is the primary key.
          for (let i = 0; i < validRows.length; i += 100) {
            const batch = validRows.slice(i, i + 100);
            const { error: upsertError } = await supabase
              .from("student_master")
              .upsert(batch, { onConflict: "uid" });

            if (upsertError) {
              throw new Error(`Student upload failed: ${upsertError.message}`);
            }
          }

          const report = {
            total: results.data?.length || 0,
            inserted,
            updated,
            rejected: rejectedRows.length,
            rejectedRows,
          };
          setUploadReport(report);

          await saveUploadHistory({
            fileName: studentFile.name,
            total: report.total,
            inserted,
            updated,
            rejected: rejectedRows.length,
          });

          setMessage(
            `Upload successful: ${inserted} new students inserted, ${updated} existing records updated, ${rejectedRows.length} rows rejected.`
          );
          setStudentFile(null);
          await loadDashboard();
        } catch (err) {
          setError(err.message || "CSV upload failed.");
          // Keep a report visible when validation has already identified rejected rows.
          if (rejectedRows.length && !uploadReport) {
            setUploadReport({
              total: results.data?.length || 0,
              inserted,
              updated,
              rejected: rejectedRows.length,
              rejectedRows,
            });
          }
        } finally {
          setUploading(false);
        }
      },
      error: (parseError) => {
        setError(parseError.message || "Unable to read CSV file.");
        setUploading(false);
      },
    });
  };

  const isAssigned = (userId, department) =>
    assignments.some(
      (item) =>
        item.user_id === userId &&
        item.department === department &&
        item.is_active
    );

  const activeApproverCount = (department) =>
    assignments.filter(
      (item) => item.department === department && item.is_active
    ).length;

  const assignApprover = async () => {
    if (!selectedFaculty || !selectedDepartment) {
      setError("Select a department and faculty member.");
      return;
    }

    if (isAssigned(selectedFaculty, selectedDepartment)) {
      setError("This faculty member is already an active approver.");
      return;
    }

    if (activeApproverCount(selectedDepartment) >= 3) {
      setError(
        `A maximum of three active approvers is allowed for ${selectedDepartment}.`
      );
      return;
    }

    setError("");
    setMessage("");
    setLoading(true);

    try {
      const { error: rpcError } = await supabase.rpc(
        "admin_set_department_approver",
        {
          p_user_id: selectedFaculty,
          p_department: selectedDepartment,
          p_is_active: true,
        }
      );

      if (rpcError) throw rpcError;

      setMessage("Approver assigned successfully.");
      setSelectedFaculty("");
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Unable to assign approver.");
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
      const { error: rpcError } = await supabase.rpc(
        "admin_set_department_approver",
        {
          p_user_id: userId,
          p_department: department,
          p_is_active: false,
        }
      );

      if (rpcError) throw rpcError;

      setMessage("Approver deactivated successfully.");
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Unable to deactivate approver.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setAdmin(null);
      if (goHome) goHome();
    } finally {
      setLoading(false);
    }
  };

  if (!admin) {
    return (
      <div style={styles.page}>
        <div style={styles.loginCard}>
          <button
            type="button"
            style={styles.backButton}
            onClick={goHome}
          >
            ← Back to Home
          </button>

          <div style={styles.lockIcon}>🔐</div>
          <h1 style={styles.heading}>Administrator Login</h1>
          <p style={styles.subheading}>
            SmartGate – GCOERC Administration Portal
          </p>

          {error && <p style={styles.error}>{error}</p>}

          <form onSubmit={handleLogin}>
            <label style={styles.label}>Official College Email</label>
            <input
              style={styles.input}
              type="email"
              name="email"
              placeholder="Administrator email"
              autoComplete="username"
              required
            />

            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              name="password"
              placeholder="Password"
              autoComplete="current-password"
              required
            />

            <button
              type="submit"
              style={styles.primaryButton}
              disabled={loading}
            >
              {loading ? "Verifying..." : "Secure Administrator Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.dashboard}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.heading}>SmartGate Administration</h1>
            <p style={styles.subheading}>GCOERC – Administrator Portal</p>
            <strong>Welcome, {admin.full_name}</strong>
          </div>

          <button
            type="button"
            style={styles.logoutButton}
            onClick={logout}
            disabled={loading}
          >
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
            type="button"
            style={tab === "students" ? styles.activeTab : styles.tab}
            onClick={() => {
              setTab("students");
              setError("");
              setMessage("");
            }}
          >
            Student CSV Upload
          </button>

          <button
            type="button"
            style={tab === "approvers" ? styles.activeTab : styles.tab}
            onClick={() => {
              setTab("approvers");
              setError("");
              setMessage("");
            }}
          >
            Approver Management
          </button>
        </nav>

        {tab === "students" && (
          <section style={styles.section}>
            <h2>Student Master Data Upload</h2>
            <p>
              Upload a CSV containing UID, Name, Email, Mobile, Department
              and Year.
            </p>
            <p style={styles.hint}>
              Use numeric ERP IDs only (2–6 digits). Existing ERP IDs will be
              updated; new ERP IDs will be inserted. No student passwords or
              activation process is used.
            </p>

            <label style={styles.label}>Academic Year</label>
            <select
              style={styles.input}
              value={academicYear}
              onChange={(event) => setAcademicYear(event.target.value)}
            >
              {[
                "2023-24",
                "2024-25",
                "2025-26",
                "2026-27",
                "2027-28",
              ].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>

            <label style={styles.label}>Select Student CSV File</label>
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
              <p style={styles.hint}>Selected file: {studentFile.name}</p>
            )}

            <button
              type="button"
              style={styles.primaryButton}
              onClick={handleCSVUpload}
              disabled={uploading || !studentFile || !academicYear}
            >
              {uploading ? "Validating and Uploading..." : "Validate and Upload CSV"}
            </button>

            <div style={styles.templateBox}>
              <strong>Required CSV headings</strong>
              <p>UID, Name, Email, Mobile, Department, Year</p>
              <p style={styles.hint}>
                Example UID: 12345. Do not include STGGSF-Engin before the ERP ID.
              </p>
            </div>

            {uploadReport && (
              <div style={styles.report}>
                <h3>Upload Report</h3>
                <p>Total rows: {uploadReport.total}</p>
                <p>New records inserted: {uploadReport.inserted}</p>
                <p>Existing records updated: {uploadReport.updated}</p>
                <p>Rejected rows: {uploadReport.rejected}</p>

                {uploadReport.rejectedRows.length > 0 && (
                  <details>
                    <summary>View rejected rows</summary>
                    {uploadReport.rejectedRows.map((item) => (
                      <p key={`${item.row}-${item.reason}`}>
                        Row {item.row}: {item.reason}
                      </p>
                    ))}
                  </details>
                )}
              </div>
            )}

            <div style={styles.historySection}>
              <div style={styles.historyHeader}>
                <h3>Recent Upload History</h3>
                <button
                  type="button"
                  style={styles.smallButton}
                  onClick={loadUploadHistory}
                  disabled={loadingHistory}
                >
                  {loadingHistory ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {loadingHistory ? (
                <p style={styles.hint}>Loading upload history...</p>
              ) : uploadHistory.length === 0 ? (
                <p style={styles.hint}>No upload history available yet.</p>
              ) : (
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Academic Year</th>
                        <th>Uploaded At</th>
                        <th>Total</th>
                        <th>Inserted</th>
                        <th>Updated</th>
                        <th>Rejected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadHistory.map((item) => (
                        <tr key={item.id}>
                          <td>{item.file_name}</td>
                          <td>{item.academic_year}</td>
                          <td>
                            {item.uploaded_at
                              ? new Date(item.uploaded_at).toLocaleString()
                              : "-"}
                          </td>
                          <td>{item.total_rows}</td>
                          <td>{item.inserted_rows}</td>
                          <td>{item.updated_rows}</td>
                          <td>{item.rejected_rows}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {tab === "approvers" && (
          <section style={styles.section}>
            <h2>Department-wise Approver Management</h2>
            <p style={styles.hint}>
              Assign up to three active approvers per department. Only
              administrator-authorized staff can approve requests.
            </p>

            {faculty.length === 0 ? (
              <p style={styles.hint}>
                No faculty profiles are available. Faculty accounts must be
                registered and provisioned before they can be assigned.
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

                <p style={styles.hint}>
                  Active approvers in {selectedDepartment || "this department"}:{" "}
                  {activeApproverCount(selectedDepartment)} / 3
                </p>

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
                  type="button"
                  style={styles.primaryButton}
                  onClick={assignApprover}
                  disabled={
                    loading ||
                    !selectedFaculty ||
                    activeApproverCount(selectedDepartment) >= 3
                  }
                >
                  {loading ? "Please wait..." : "Assign as Approver"}
                </button>

                <h3 style={{ marginTop: 28 }}>
                  Approvers – {selectedDepartment}
                </h3>

                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Staff ID</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {faculty
                        .filter(
                          (person) => person.department === selectedDepartment
                        )
                        .filter((person) =>
                          assignments.some(
                            (item) =>
                              item.user_id === person.id &&
                              item.department === selectedDepartment
                          )
                        )
                        .map((person) => {
                          const active = isAssigned(
                            person.id,
                            selectedDepartment
                          );
                          return (
                            <tr key={person.id}>
                              <td>{person.full_name}</td>
                              <td>{person.email}</td>
                              <td>{person.uid || "-"}</td>
                              <td>{active ? "Active" : "Inactive"}</td>
                              <td>
                                {active && (
                                  <button
                                    type="button"
                                    style={styles.deactivateButton}
                                    onClick={() =>
                                      deactivateApprover(
                                        person.id,
                                        selectedDepartment
                                      )
                                    }
                                    disabled={loading}
                                  >
                                    Deactivate
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        <button
          type="button"
          style={styles.homeButton}
          onClick={goHome}
        >
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
    display: "inline-block",
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
    lineHeight: 1.5,
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
    overflowWrap: "anywhere",
  },
  report: {
    background: "#f1f5f9",
    padding: "15px",
    borderRadius: "8px",
    marginTop: "20px",
  },
  templateBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: "14px",
    borderRadius: "8px",
    marginTop: "20px",
  },
  historySection: {
    marginTop: "30px",
  },
  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  smallButton: {
    padding: "8px 12px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    borderRadius: "6px",
    cursor: "pointer",
  },
  tableWrap: {
    width: "100%",
    overflowX: "auto",
    marginTop: "12px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: "14px",
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
