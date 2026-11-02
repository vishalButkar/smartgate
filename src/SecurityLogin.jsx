import { useState } from "react";

function SecurityLogin({ goHome }) {
  const [uidNumber, setUidNumber] = useState("");
  const [result, setResult] = useState(null);

  const verifyGatePass = (event) => {
    event.preventDefault();

    setResult(null);

    // Validate UID number
    if (!/^\d{5,6}$/.test(uidNumber)) {
      setResult({
        status: "error",
        title: "INVALID STUDENT UID",
        message: "Please enter a valid 5 or 6 digit Student UID number.",
      });
      return;
    }

    const completeUID = `STGGSF-Engin${uidNumber}`;

    // Get approved gate passes
    const gatePasses = JSON.parse(
      localStorage.getItem("smartGatePasses") || "[]"
    );

    // Find the student's latest gate pass
    const studentPasses = gatePasses.filter(
      (pass) =>
        String(pass.UID || "").trim().toLowerCase() ===
        completeUID.toLowerCase()
    );

    if (studentPasses.length === 0) {
      setResult({
        status: "not-approved",
        title: "NO APPROVED GATE PASS",
        message:
          "Student does not have an approved gate pass. Do not allow exit.",
      });
      return;
    }

    // Get the latest gate pass
    const latestPass = studentPasses[studentPasses.length - 1];

    // Check approval status
    if (
      String(latestPass.status || "").toLowerCase() ===
      "approved"
    ) {
      setResult({
        status: "approved",
        title: "APPROVED – ALLOW STUDENT",
        message: "Gate pass is approved. Student may leave the campus.",
        student: latestPass,
      });
    } else {
      setResult({
        status: "not-approved",
        title: "NOT APPROVED – DO NOT ALLOW",
        message:
          "The student's gate pass has not been approved by the authorized faculty.",
        student: latestPass,
      });
    }
  };

  const clearVerification = () => {
    setUidNumber("");
    setResult(null);
  };

  return (
    <div className="security-page">
      {/* HEADER */}
      <div className="security-header">
        <button
          type="button"
          onClick={goHome}
          className="security-back-button"
        >
          ← Back to Home
        </button>

        <div>
          <h1>Security Gate Verification</h1>
          <p>SmartGate - Student Gate Pass Management System</p>
        </div>
      </div>

      {/* VERIFICATION CARD */}
      <div className="security-verification-box">
        <h2>Verify Student Gate Pass</h2>

        <p className="security-info">
          Enter the Student UID to verify whether the student is permitted
          to leave the campus.
        </p>

        <form onSubmit={verifyGatePass}>
          <label>Student Unique ID</label>

          <div className="security-uid-group">
            <span>STGGSF-Engin</span>

            <input
              type="text"
              value={uidNumber}
              onChange={(event) => {
                const value = event.target.value;

                if (/^\d{0,6}$/.test(value)) {
                  setUidNumber(value);
                }
              }}
              placeholder="5 or 6 digit number"
              maxLength="6"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            className="verify-pass-button"
          >
            Verify Gate Pass
          </button>
        </form>

        {/* VERIFICATION RESULT */}
        {result && (
          <div className={`security-result ${result.status}`}>
            <h2>{result.title}</h2>

            <p>{result.message}</p>

            {result.student && (
              <div className="security-student-details">
                <p>
                  <strong>Student:</strong>{" "}
                  {result.student.Name || "Not Available"}
                </p>

                <p>
                  <strong>UID:</strong>{" "}
                  {result.student.UID}
                </p>

                <p>
                  <strong>Department:</strong>{" "}
                  {result.student.Department || "Not Available"}
                </p>
              </div>
            )}

            <button
              type="button"
              className="new-verification-button"
              onClick={clearVerification}
            >
              Verify Another Student
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SecurityLogin;