
import { useState } from "react";
import { supabase } from "./supabase";

function StudentLogin({ goHome }) {
  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState("activate");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const activateAccount = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const cleanUID = uid.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[0-9]{2,6}$/.test(cleanUID)) {
      setError("Enter your 2–6 digit student ERP ID.");
      return;
    }

    if (!cleanEmail) {
      setError("Enter the email address registered with your college.");
      return;
    }

    if (!temporaryPassword) {
      setError("Enter the temporary password issued by your department.");
      return;
    }

    if (password.length < 10) {
      setError("Your new password must contain at least 10 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke("student-activate-account", {
          body: {
            uid: cleanUID,
            email: cleanEmail,
            temporary_password: temporaryPassword,
            new_password: password,
          },
        });

      if (functionError) {
        let serverMessage = functionError.message;

        try {
          const payload = await functionError.context?.json();
          if (payload?.error) serverMessage = payload.error;
        } catch (_) {
          // Retain the original function error.
        }

        throw new Error(serverMessage || "Student activation failed.");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Student activation failed.");
      }

      setMode("login");
      setTemporaryPassword("");
      setPassword("");
      setConfirmPassword("");

      setMessage(
        data.message ||
          "Account activated. Please log in with your new password."
      );
    } catch (err) {
      console.error("Student activation error:", err);
      setError(
        err.message ||
          "Unable to activate account. Please check your details or contact your department."
      );
    } finally {
      setLoading(false);
    }
  };

  const loginStudent = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const cleanUID = uid.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!/^[0-9]{2,6}$/.test(cleanUID)) {
      setError("Enter your 2–6 digit student ERP ID.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError) throw loginError;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("uid, full_name, role")
        .eq("id", data.user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.role !== "student" || profile.uid !== cleanUID) {
        await supabase.auth.signOut();
        throw new Error(
          "This account is not authorized for the entered ERP ID."
        );
      }

      setMessage(
        `Welcome, ${profile.full_name}. Student login successful.`
      );

      setPassword("");
    } catch (err) {
      console.error("Student login error:", err);
      setError(
        err.message ||
          "Login failed. Check your ERP ID, email and password."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUid("");
    setEmail("");
    setTemporaryPassword("");
    setPassword("");
    setConfirmPassword("");
    setMessage("");
    setError("");
    setMode("activate");
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
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            className="student-register-button"
            onClick={() => {
              setMode("activate");
              setMessage("");
              setError("");
            }}
            disabled={loading}
          >
            First-Time Activation
          </button>

          <button
            type="button"
            className="student-cancel-button"
            onClick={() => {
              setMode("login");
              setMessage("");
              setError("");
            }}
            disabled={loading}
          >
            Student Login
          </button>
        </div>

        {mode === "activate" ? (
          <>
            <h2>Activate Student Account</h2>

            <p className="registration-info">
              Enter your ERP ID, college-registered email and the temporary
              password provided by your department. You will create your own
              permanent password here.
            </p>

            <form onSubmit={activateAccount}>
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

              <label>Registered College Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email from college records"
                autoComplete="email"
                required
              />

              <label>Temporary Password (issued by department)</label>
              <input
                type="password"
                value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)}
                autoComplete="one-time-code"
                required
              />

              <label>Create New Password (minimum 10 characters)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={10}
                autoComplete="new-password"
                required
              />

              <label>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={10}
                autoComplete="new-password"
                required
              />

              {error && (
                <p className="registration-error">{error}</p>
              )}

              {message && (
                <p className="registration-success">{message}</p>
              )}

              <button
                type="submit"
                className="student-register-button"
                disabled={loading}
              >
                {loading ? "Activating..." : "Activate My Account"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2>Student Login</h2>

            <p className="registration-info">
              Enter your ERP ID, registered college email and permanent
              password.
            </p>

            <form onSubmit={loginStudent}>
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

              <label>Registered College Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter registered email"
                autoComplete="email"
                required
              />

              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              {error && (
                <p className="registration-error">{error}</p>
              )}

              {message && (
                <p className="registration-success">{message}</p>
              )}

              <button
                type="submit"
                className="student-register-button"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>
          </>
        )}

        <button
          type="button"
          className="student-cancel-button"
          onClick={resetForm}
          disabled={loading}
          style={{ marginTop: 14 }}
        >
          Clear / Start Again
        </button>
      </div>
    </div>
  );
}

export default StudentLogin;
