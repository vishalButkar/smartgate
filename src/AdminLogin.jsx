
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

  // Student activation states
  const [studentDepartments, setStudentDepartments] = useState([]);
  const [activationDepartment, setActivationDepartment] = useState("");
  const [credentials, setCredentials] = useState([]);
  const [skippedStudents, setSkippedStudents] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [credentialsVisible, setCredentialsVisible] = useState(false);

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
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
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

    await Promise.all([loadFaculty(), loadStudentDepartments()]);
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
      setSelectedDepartment(facultyResult.data[0].department || "");
    }
  };

  const loadStudentDepartments = async () => {
    const { data, error } = await supabase
      .from("student_master")
      .select("department")
      .order("department");

    if (error) {
      setError(error.message);
      return;
    }

    const uniqueDepartments = [
      ...new Set((data || []).map((x) => x.department).filter(Boolean)),
    ].sort();

    setStudentDepartments(uniqueDepartments);

    if (!activationDepartment && uniqueDepartments.length) {
      setActivationDepartment(uniqueDepartments[0]);
    }
  };

  // STUDENT CSV UPLOAD

  const normalizeHeader = (value) =>
    String(value || "").trim().toLowerCase();

  // Keep numeric ERP IDs as numeric strings in student_master.
  // Older prefixed IDs are converted to their numeric suffix.
  const normalizeUID = (value) => {
    const raw = String(value ?? "").trim();

    if (/^STGGSF-Engin[0-9]{2,6}$/i.test(raw)) {
      return raw.replace(/^STGGSF-Engin/i, "");
    }

    if (/^[0-9]{2,6}$/.test(raw)) {
      return raw;
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
              "Missing CSV columns: " +
                missing.join(", ") +
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
              !/^[0-9]{10}$/.test(mobile) ||
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
                reason: "Duplicate ERP ID in CSV",
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

  // DEPARTMENT-WISE TEMPORARY PASSWORD GENERATION

  const generateTemporaryPasswords = async () => {
    if (!activationDepartment) {
      setError("Please select a student department.");
      return;
    }

    const confirmed = window.confirm(
      `Generate temporary passwords for students in ${activationDepartment}?\n\nAlready activated students will be skipped. Existing unused passwords for eligible students will be replaced.`
    );

    if (!confirmed) return;

    setGenerating(true);
    setError("");
    setMessage("");
    setCredentials([]);
    setSkippedStudents([]);
    setCredentialsVisible(false);

    try {
      const { data, error } = await supabase.functions.invoke(
        "admin-generate-temp-passwords",
        {
          body: {
            department: activationDepartment,
          },
        }
      );

      if (error) {
        let messageText = error.message;

        try {
          const details = await error.context?.json();
          if (details?.error) messageText = details.error;
        } catch (_) {
          // Keep original error message.
        }

        throw new Error(messageText || "Password generation failed.");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Password generation failed.");
      }

      setCredentials(data.credentials || []);
      setSkippedStudents(data.skipped || []);
      setCredentialsVisible(true);

      setMessage(
        `${data.generated_count || 0} temporary passwords generated for ${activationDepartment}.`
      );
    } catch (err) {
      console.error("Temporary password generation:", err);
      setError(err.message || "Unable to generate temporary passwords.");
    } finally {
      setGenerating(false);
    }
  };

  const printCredentials = () => {
    if (!credentials.length) {
      setError("There are no credentials available to print.");
      return;
    }

    window.print();
  };

  const clearCredentials = () => {
    const confirmed = window.confirm(
      "Clear the displayed temporary passwords? Make sure you have printed or securely saved the slips first."
    );

    if (!confirmed) return;

    setCredentials([]);
    setCredentialsVisible(false);
    setSkippedStudents([]);
    setMessage("Displayed temporary passwords cleared.");
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
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #smartgate-print-area,
          #smartgate-print-area * {
            visibility: visible !important;
          }
          #smartgate-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 10mm !important;
            background: white !important;
          }
          .credential-slip {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px dashed #333 !important;
            margin: 8px !important;
            padding: 16px !important;
            width: 44% !important;
            display: inline-block !important;
            vertical-align: top !important;
            color: #000 !important;
            background: #fff !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div style={styles.dashboard}>
        <header style={styles.header} className="no-print">
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

        <div className="no-print">
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
              onClick={() => {
                setTab("students");
                setError("");
                setMessage("");
              }}
            >
              Student CSV Upload
            </button>

            <button
              style={tab === "activation" ? styles.activeTab : styles.tab}
              onClick={() => {
                setTab("activation");
                setError("");
                setMessage("");
              }}
            >
              Student Activation Passwords
            </button>

            <button
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
        </div>

        {tab === "students" && (
          <section style={styles.section} className="no-print">
            <h2>Student Master Data Upload</h2>

            <p>
              Upload a CSV containing UID, Name, Email, Mobile,
              Department and Year.
            </p>

            <p style={styles.hint}>
              Numeric ERP IDs containing 2–6 digits are stored without
              prefixes. Older STGGSF-Engin-prefixed IDs are also converted
              to their numeric suffix.
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

        {tab === "activation" && (
          <section style={styles.section} className="no-print">
            <h2>Department-wise Student Activation</h2>

            <p>
              Generate individual temporary passwords for students who
              have not activated their SmartGate accounts.
            </p>

            <div style={styles.warning}>
              <strong>Confidential credentials</strong>
              <p>
                Temporary passwords are displayed only once after
                generation. Print the individual slips and distribute
                them privately through the respective department.
              </p>
              <p>
                Each temporary password expires after seven days and
                can be used only once.
              </p>
            </div>

            <label style={styles.label}>Select Student Department</label>

            <select
              style={styles.input}
              value={activationDepartment}
              onChange={(event) => {
                setActivationDepartment(event.target.value);
                setCredentials([]);
                setSkippedStudents([]);
                setCredentialsVisible(false);
                setError("");
                setMessage("");
              }}
            >
              <option value="">Choose department</option>
              {studentDepartments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>

            <button
              style={styles.primaryButton}
              onClick={generateTemporaryPasswords}
              disabled={generating || !activationDepartment}
            >
              {generating
                ? "Generating Passwords..."
                : "Generate Department-wise Temporary Passwords"}
            </button>

            {credentialsVisible && (
              <div style={styles.report}>
                <h3>Generation Report</h3>
                <p>
                  Department: <strong>{activationDepartment}</strong>
                </p>
                <p>
                  New temporary passwords:{" "}
                  <strong>{credentials.length}</strong>
                </p>
                <p>
                  Students skipped:{" "}
                  <strong>{skippedStudents.length}</strong>
                </p>

                {credentials.length > 0 && (
                  <>
                    <div style={styles.buttonRow}>
                      <button
                        style={styles.primaryButton}
                        onClick={printCredentials}
                      >
                        🖨 Print Individual Student Slips
                      </button>

                      <button
                        style={styles.secondaryButton}
                        onClick={clearCredentials}
                      >
                        Clear Displayed Passwords
                      </button>
                    </div>

                    <p style={styles.hint}>
                      Print these slips before clearing this page.
                      Passwords cannot be retrieved from the database
                      after they disappear from this screen.
                    </p>
                  </>
                )}

                {credentials.length === 0 && (
                  <p>
                    No new passwords were generated. Check the skipped
                    student list below.
                  </p>
                )}

                {skippedStudents.length > 0 && (
                  <details style={{ marginTop: 18 }}>
                    <summary>
                      View skipped students ({skippedStudents.length})
                    </summary>

                    {skippedStudents.map((student) => (
                      <p key={student.uid}>
                        {student.uid} – {student.name}: {student.reason}
                      </p>
                    ))}
                  </details>
                )}
              </div>
            )}
          </section>
        )}

        {tab === "approvers" && (
          <section style={styles.section} className="no-print">
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
                  onChange={(event) =>
                    setSelectedFaculty(event.target.value)
                  }
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

        <div id="smartgate-print-area">
          {credentialsVisible && credentials.length > 0 && (
            <>
              <div style={styles.printHeading}>
                <h2>GURU GOBIND SINGH FOUNDATION</h2>
                <h3>SmartGate – Student Account Activation</h3>
                <p>Department: {activationDepartment}</p>
                <p>
                  Confidential individual student login credentials
                </p>
              </div>

              <div style={styles.slipGrid}>
                {credentials.map((student) => (
                  <div className="credential-slip" key={student.uid}>
                    <h3>SMARTGATE – GCOERC</h3>
                    <p>
                      <strong>Student Name:</strong> {student.name}
                    </p>
                    <p>
                      <strong>ERP ID:</strong> {student.uid}
                    </p>
                    <p>
                      <strong>Department:</strong> {student.department}
                    </p>
                    <p>
                      <strong>Year:</strong> {student.year}
                    </p>
                    <p>
                      <strong>Registered Email:</strong> {student.email}
                    </p>

                    <div style={styles.passwordBox}>
                      <strong>Temporary Password</strong>
                      <div style={styles.passwordText}>
                        {student.temporary_password}
                      </div>
                    </div>

                    <p style={styles.slipInstruction}>
                      Visit the SmartGate portal. Select First-Time
                      Activation, enter your ERP ID, registered email
                      and temporary password, then create your own
                      permanent password.
                    </p>

                    <p style={styles.slipExpiry}>
                      Temporary password expires:{" "}
                      {new Date(student.expires_at).toLocaleString("en-IN")}
                    </p>

                    <p style={styles.slipFooter}>
                      Keep this slip confidential. Do not share your
                      password with anyone.
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          className="no-print"
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
  secondaryButton: {
    display: "inline-block",
    marginTop: "20px",
    padding: "12px 18px",
    background: "#64748b",
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
  section: { padding: "20px 0" },
  hint: { color: "#64748b", fontSize: "14px" },
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
  warning: {
    background: "#fff7e6",
    color: "#805500",
    padding: "15px",
    borderRadius: "8px",
    marginTop: "15px",
  },
  report: {
    background: "#f1f5f9",
    padding: "15px",
    borderRadius: "8px",
    marginTop: "20px",
  },
  buttonRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
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
  printHeading: {
    textAlign: "center",
    marginBottom: "20px",
    color: "#000",
  },
  slipGrid: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: "10px",
  },
  passwordBox: {
    border: "1px solid #222",
    padding: "10px",
    margin: "12px 0",
    textAlign: "center",
  },
  passwordText: {
    fontSize: "19px",
    fontWeight: "bold",
    letterSpacing: "1px",
    marginTop: "8px",
    overflowWrap: "anywhere",
  },
  slipInstruction: {
    fontSize: "12px",
    lineHeight: 1.5,
  },
  slipExpiry: {
    fontSize: "11px",
  },
  slipFooter: {
    fontSize: "11px",
    fontWeight: "bold",
    borderTop: "1px dashed #777",
    paddingTop: "8px",
  },
};

export default AdminLogin;
