
import { useState } from "react";
import { supabase } from "./supabase";

function StudentLogin({ goHome }) {
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [student, setStudent] = useState(null);
  const [mode, setMode] = useState("verify");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const verifyStudent = async (event) => {
    event.preventDefault();
    setMessage("");
    setStudent(null);

    if (!/^[0-9]{2,6}$/.test(uid)) {
      setMessage("Enter a valid 2–6 digit ERP ID.");
      return;
    }

    if (!email.trim()) {
      setMessage("Please enter your registered email address.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc(
        "verify_student_erp",
        {
          p_uid: uid.trim(),
          p_email: email.trim().toLowerCase(),
        }
      );

      if (error) throw error;

      if (!data || data.length === 0) {
        setMessage(
          "ERP ID or email does not match the uploaded student records. Please contact the Administrator."
        );
        return;
      }

      const record = data[0];
      setStudent(record);

      if (record.already_activated) {
        setMode("login");
        setMessage("Your student account is already activated. Please log in.");
      } else {
        setMode("activate");
        setMessage("Student details verified. You can now create your password.");
      }
    } catch (error) {
      console.error("Student verification error:", error);
      setMessage(error.message || "Unable to verify student details.");
    } finally {
      setLoading(false);
    }
  };

  const activateAccount = async (event) => {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: student.email.trim().toLowerCase(),
        password,
        options: {
          data: {
            uid: student.uid,
            account_type: "student",
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        setMode("login");
        setPassword("");
        setMessage("Account activated successfully. You can now log in.");
      } else {
        setMode("login");
        setPassword("");
        setMessage(
          "Account created. Please check your registered email for the confirmation link before logging in."
        );
      }
    } catch (error) {
      console.error("Student activation error:", error);
      setMessage(error.message || "Account activation failed.");
    } finally {
      setLoading(false);
    }
  };

  const loginStudent = async (event) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("uid, full_name, role")
        .eq("id", data.user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.role !== "student" || profile.uid !== uid) {
        await supabase.auth.signOut();
        throw new Error("This account is not authorized for this student ERP ID.");
      }

      setMessage(
        `Welcome, ${profile.full_name}. Student login successful.`
      );
      setPassword("");
    } catch (error) {
      console.error("Student login error:", error);
      setMessage(error.message || "Login failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStudent(null);
    setUid("");
    setEmail("");
    setPassword("");
    setMessage("");
    setMode("verify");
  };

  return (
    <div className="student-registration-page">
      <div className="student-registration-header">
        <button
          type="button"
          onClick={goHome}
          className="student-back-button"
        >
          ← Back to Home
        </button>

        <div>
          <h1>Student Login / First-Time Activation</h1>
          <p>SmartGate - Student Gate Pass Management System</p>
        </div>
      </div>

      <div className="student-registration-box">
        {mode === "verify" && (
          <>
            <h2>Verify Student Details</h2>

            <p className="registration-info">
              Enter your numeric ERP ID and the email address registered
              with your college.
            </p>

            <form onSubmit={verifyStudent}>
              <label>Student ERP ID</label>
              <input
                type="text"
                value={uid}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^[0-9]{0,6}$/.test(value)) setUid(value);
                }}
                placeholder="Enter 2–6 digit ERP ID"
                maxLength={6}
                required
              />

              <label>Registered Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email from college records"
                required
              />

              {message && <p className="registration-error">{message}</p>}

              <button
                type="submit"
                className="student-register-button"
                disabled={loading}
              >
                {loading ? "Verifying..." : "Verify Student Details →"}
              </button>
            </form>
          </>
        )}

        {student && (
          <>
            <h2>Student Details Verified ✓</h2>

            <div className="registration-success">
              Your details match the uploaded student database.
            </div>

            <label>ERP ID</label>
            <input value={student.uid || ""} disabled />

            <label>Full Name</label>
            <input value={student.name || ""} disabled />

            <label>Email</label>
            <input value={student.email || ""} disabled />

            <label>Mobile</label>
            <input value={student.mobile || ""} disabled />

            <label>Department</label>
            <input value={student.department || ""} disabled />

            <label>Year</label>
            <input value={student.year || ""} disabled />

            {mode === "activate" && (
              <form onSubmit={activateAccount}>
                <h3>Create Your Password</h3>

                <label>Password (minimum 8 characters)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                />

                <button
                  type="submit"
                  className="student-register-button"
                  disabled={loading}
                >
                  {loading ? "Activating..." : "Activate Student Account"}
                </button>
              </form>
            )}

            {mode === "login" && (
              <form onSubmit={loginStudent}>
                <h3>Student Login</h3>

                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="submit"
                  className="student-register-button"
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>
            )}

            {message && <p className="registration-success">{message}</p>}

            <button
              type="button"
              className="student-cancel-button"
              onClick={resetForm}
            >
              Start Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default StudentLogin;
