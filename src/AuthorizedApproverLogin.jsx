import { useState } from "react";

function AuthorizedApproverLogin({ goHome }) {
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState("");

  // Demo authorized approvers.
  // Replace these credentials with administrator-managed data later.
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
        "Invalid Staff ID or password. Only authorized staff can approve gate passes."
      );
      return;
    }

    localStorage.setItem(
      "smartGateCurrentApprover",
      JSON.stringify(approver)
    );

    setIsLoggedIn(true);
  };

  const getGatePassRequests = () => {
    try {
      return JSON.parse(
        localStorage.getItem("smartGateGatePassRequests") || "[]"
      );
    } catch {
      return [];
    }
  };

  const [requests, setRequests] = useState(getGatePassRequests);

  const updateRequestStatus = (requestId, newStatus) => {
    const updatedRequests = requests.map((request) => {
      if (request.id === requestId) {
        return {
          ...request,
          status: newStatus,
          approvedAt:
            newStatus === "Approved"
              ? new Date().toLocaleString()
              : request.approvedAt,
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

  if (!isLoggedIn) {
    return (
      <div className="approver-page">
        <div className="approver-header">
          <button
            type="button"
            onClick={goHome}
            className="back-button"
          >
            ← Back to Home
          </button>

          <h1>Authorized Gate Pass Approver</h1>
          <p>SmartGate - Student Gate Pass Management System</p>
        </div>

        <div className="approver-login-box">
          <h2>Approver Login</h2>

          <p>
            This portal is restricted to authorized staff members
            nominated by the Administrator.
          </p>

          <form onSubmit={handleLogin}>
            <label htmlFor="staffId">Staff ID</label>
            <input
              id="staffId"
              type="text"
              value={staffId}
              onChange={(event) => setStaffId(event.target.value)}
              placeholder="Enter Staff ID"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter Password"
              required
            />

            {message && (
              <p className="registration-error">{message}</p>
            )}

            <button
              type="submit"
              className="student-register-button"
            >
              Login to Approval Portal
            </button>
          </form>

          <p className="role-note">
            Only Administrator-authorized staff can approve or reject
            student gate pass requests.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="approver-page">
      <div className="approver-header">
        <button
          type="button"
          onClick={handleLogout}
          className="back-button"
        >
          ← Logout
        </button>

        <h1>Gate Pass Approval Dashboard</h1>
        <p>Review and approve student gate pass requests</p>
      </div>

      <div className="approver-dashboard">
        <h2>Student Gate Pass Requests</h2>

        {requests.length === 0 ? (
          <div className="no-records">
            <p>No gate pass requests are available at this time.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
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

                  return (
                    <tr key={request.id || index}>
                      <td>{request.studentName || "-"}</td>
                      <td>{request.studentUID || "-"}</td>
                      <td>{request.reason || "-"}</td>
                      <td>
                        {request.exitDate ||
                          request.date ||
                          "-"}
                      </td>

                      <td>
                        <span
                          className={`status ${status.toLowerCase()}`}
                        >
                          {status}
                        </span>
                      </td>

                      <td>
                        {status === "Pending" ? (
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="approve-button"
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
                              className="reject-button"
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
                          <span>No action required</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthorizedApproverLogin;