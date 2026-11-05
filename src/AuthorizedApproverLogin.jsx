
import { useState } from "react";
import "./AuthorizedApproverLogin.css";

function AuthorizedApproverLogin({ goHome }) {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState("");

  const authorizedApprovers = [
    {
      staffId: "AIDS001",
      password: "123456",
      name: "Authorized Approver",
      department: "AI & DS",
    },
    {
      staffId: "COMP001",
      password: "123456",
      name: "Authorized Approver",
      department: "Computer Engineering",
    },
  ];

  const [requests, setRequests] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("smartGateGatePassRequests") || "[]"
      );
    } catch {
      return [];
    }
  });

  const handleLogin = (event) => {
    event.preventDefault();
    setMessage("");

    const approver = authorizedApprovers.find(
      (item) =>
        item.staffId.toLowerCase() === staffId.trim().toLowerCase() &&
        item.password === password
    );

    if (!approver) {
      setMessage(
        "Invalid Staff ID or password. Please check your login details."
      );
      return;
    }

    localStorage.setItem(
      "smartGateCurrentApprover",
      JSON.stringify(approver)
    );

    setRequests(
      JSON.parse(
        localStorage.getItem("smartGateGatePassRequests") || "[]"
      )
    );

    setIsLoggedIn(true);
  };

  const updateRequestStatus = (requestId, newStatus) => {
    if (!requestId) {
      alert("This request does not have a valid ID.");
      return;
    }

    const updatedRequests = requests.map((request) => {
      if (request.id === requestId) {
        return {
          ...request,
          status: newStatus,
          approvedAt: new Date().toLocaleString(),
        };
      }
      return request;
    });

    setRequests(updatedRequests);

    localStorage.setItem(
      "smartGateGatePassRequests",
      JSON.stringify(updatedRequests)
    );

    alert(`Gate pass request ${newStatus.toLowerCase()} successfully.`);
  };

  const handleLogout = () => {
    localStorage.removeItem("smartGateCurrentApprover");
    setIsLoggedIn(false);
    setStaffId("");
    setPassword("");
    setMessage("");
  };

  const handleBack = () => {
    if (goHome) goHome();
  };

  const pendingCount = requests.filter(
    (request) => (request.status || "Pending").toLowerCase() === "pending"
  ).length;

  const approvedCount = requests.filter(
    (request) => (request.status || "").toLowerCase() === "approved"
  ).length;

  const rejectedCount = requests.filter(
    (request) => (request.status || "").toLowerCase() === "rejected"
  ).length;

  const currentApprover = JSON.parse(
    localStorage.getItem("smartGateCurrentApprover") || "null"
  );

  if (!isLoggedIn) {
    return (
      <div className="sg-approver-page">
        <header className="sg-approver-header">
          <div className="sg-header-inner">
            <button
              type="button"
              className="sg-back-button"
              onClick={handleBack}
            >
              <span>←</span> Back to Home
            </button>

            <div className="sg-header-title">
              <div className="sg-header-icon">✓</div>
              <h1>Authorized Gate Pass Approver</h1>
              <p>SmartGate – Student Gate Pass Management System</p>
            </div>
          </div>
        </header>

        <main className="sg-approver-main">
          <div className="sg-login-card">
            <div className="sg-card-icon">🔐</div>

            <span className="sg-card-label">AUTHORIZED STAFF ONLY</span>

            <h2>Approver Login</h2>

            <p className="sg-login-description">
              Sign in to review, approve or reject student gate pass
              applications.
            </p>

            <form onSubmit={handleLogin}>
              <div className="sg-form-group">
                <label htmlFor="approverStaffId">
                  Staff / Faculty ID
                </label>

                <div className="sg-input-wrapper">
                  <span className="sg-input-icon">👤</span>
                  <input
                    id="approverStaffId"
                    type="text"
                    value={staffId}
                    onChange={(event) => setStaffId(event.target.value)}
                    placeholder="Enter your Staff ID"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="sg-form-group">
                <label htmlFor="approverPassword">Password</label>

                <div className="sg-input-wrapper">
                  <span className="sg-input-icon">🔑</span>
                  <input
                    id="approverPassword"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              {message && (
                <div className="sg-error-message">
                  <span>⚠</span> {message}
                </div>
              )}

              <button type="submit" className="sg-login-button">
                Login to Approval Portal <span>→</span>
              </button>
            </form>

            <div className="sg-security-note">
              <span>🛡️</span>
              <p>
                Access is restricted to staff members authorized by the
                SmartGate Administrator.
              </p>
            </div>
          </div>
        </main>

        <footer className="sg-approver-footer">
          <p>
            SmartGate – Student Gate Pass Management System
          </p>
          <p>Guru Gobind Singh Foundation, Nashik</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="sg-approver-page">
      <header className="sg-approver-header">
        <div className="sg-header-inner">
          <button
            type="button"
            className="sg-back-button"
            onClick={handleLogout}
          >
            ← Logout
          </button>

          <div className="sg-header-title">
            <div className="sg-header-icon">✓</div>
            <h1>Gate Pass Approval Dashboard</h1>
            <p>SmartGate – Student Gate Pass Management System</p>
          </div>
        </div>
      </header>

      <main className="sg-dashboard-main">
        <div className="sg-dashboard-welcome">
          <div>
            <span className="sg-card-label">APPROVER DASHBOARD</span>
            <h2>Welcome, {currentApprover?.name || "Approver"}</h2>
            <p>
              Department: {currentApprover?.department || "-"}
            </p>
          </div>

          <div className="sg-dashboard-user">👤</div>
        </div>

        <div className="sg-stats-grid">
          <div className="sg-stat-card pending-stat">
            <span>Pending Requests</span>
            <strong>{pendingCount}</strong>
            <small>Awaiting your action</small>
          </div>

          <div className="sg-stat-card approved-stat">
            <span>Approved Requests</span>
            <strong>{approvedCount}</strong>
            <small>Successfully approved</small>
          </div>

          <div className="sg-stat-card rejected-stat">
            <span>Rejected Requests</span>
            <strong>{rejectedCount}</strong>
            <small>Not approved</small>
          </div>
        </div>

        <section className="sg-requests-card">
          <div className="sg-section-heading">
            <div>
              <h2>Student Gate Pass Requests</h2>
              <p>Review and process student applications</p>
            </div>

            <span className="sg-request-count">
              {requests.length} Total
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="sg-empty-state">
              <div>📋</div>
              <h3>No Gate Pass Requests</h3>
              <p>
                Student applications will appear here when submitted.
              </p>
            </div>
          ) : (
            <div className="sg-table-wrapper">
              <table className="sg-requests-table">
                <thead>
                  <tr>
                    <th>Sr. No.</th>
                    <th>Student Name</th>
                    <th>Student UID</th>
                    <th>Reason</th>
                    <th>Exit Date</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {requests.map((request, index) => {
                    const status = request.status || "Pending";
                    const statusClass = status.toLowerCase();

                    return (
                      <tr key={request.id || index}>
                        <td>{index + 1}</td>
                        <td>{request.studentName || "-"}</td>
                        <td>{request.studentUID || "-"}</td>
                        <td>{request.reason || "-"}</td>
                        <td>
                          {request.exitDate || request.date || "-"}
                        </td>
                        <td>
                          <span
                            className={`sg-status-badge ${statusClass}`}
                          >
                            {status}
                          </span>
                        </td>
                        <td>
                          {status.toLowerCase() === "pending" ? (
                            <div className="sg-action-buttons">
                              <button
                                type="button"
                                className="sg-approve-button"
                                onClick={() =>
                                  updateRequestStatus(
                                    request.id,
                                    "Approved"
                                  )
                                }
                              >
                                ✓ Approve
                              </button>

                              <button
                                type="button"
                                className="sg-reject-button"
                                onClick={() =>
                                  updateRequestStatus(
                                    request.id,
                                    "Rejected"
                                  )
                                }
                              >
                                ✕ Reject
                              </button>
                            </div>
                          ) : (
                            <span className="sg-completed-text">
                              Processed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <footer className="sg-approver-footer">
        <p>SmartGate – Student Gate Pass Management System</p>
        <p>Guru Gobind Singh Foundation, Nashik</p>
      </footer>
    </div>
  );
}

export default AuthorizedApproverLogin;
