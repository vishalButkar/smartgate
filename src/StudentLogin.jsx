import { useState } from "react";

function StudentRegistration({ goHome, goLogin }) {
  const [uidNumber, setUidNumber] = useState("");
  const [student, setStudent] = useState(null);
  const [message, setMessage] = useState("");

  const handleVerifyUID = (event) => {
    event.preventDefault();
    setMessage("");

    if (!/^\d{2,6}$/.test(uidNumber)) {
      setMessage("Please enter a valid 3 or 6 digit ERP ID number.");
      return;
    }

    const completeUID = `STGGSF-Engin${uidNumber}`;

    // Get student records uploaded by Administrator
    const students = JSON.parse(
      localStorage.getItem("smartGateStudents") || "[]"
    );

    // Match UID with Admin uploaded Excel data
    const foundStudent = students.find(
      (item) =>
        String(item.UID || "").trim().toLowerCase() ===
        completeUID.toLowerCase()
    );

    if (!foundStudent) {
      setStudent(null);
      setMessage(
        "Student ERP ID not found. Please contact the Administrator."
      );
      return;
    }

    setStudent(foundStudent);
    setMessage("");
  };

  const handleRegister = (event) => {
    event.preventDefault();

    if (!student) return;

    const registeredStudents = JSON.parse(
      localStorage.getItem("smartGateRegisteredStudents") || "[]"
    );

    const alreadyRegistered = registeredStudents.some(
      (item) => item.UID === student.UID
    );

    if (alreadyRegistered) {
      alert("This student is already registered. Please login.");
      return;
    }

    const updatedStudents = [
      ...registeredStudents,
      {
        ...student,
        registeredAt: new Date().toLocaleString(),
      },
    ];

    localStorage.setItem(
      "smartGateRegisteredStudents",
      JSON.stringify(updatedStudents)
    );

    alert("Student registration completed successfully!");

    setStudent(null);
    setUidNumber("");
    setMessage("");

    if (goLogin) {
      goLogin();
    }
  };

  return (
    <div className="student-registration-page">

      {/* HEADER */}
      <div className="student-registration-header">
        <button
          onClick={goHome}
          className="student-back-button"
        >
          ← Back to Home
        </button>

        <div>
          <h1>Student Registration</h1>
          <p>SmartGate - Student Gate Pass Management System</p>
        </div>
      </div>

      {/* REGISTRATION BOX */}
      <div className="student-registration-box">

        {!student ? (
          <>
            <h2>Verify Student Unique ID</h2>

            <p className="registration-info">
              Enter your Student UID. Your details will be verified
              from the data uploaded by the Administrator.
            </p>

            <form onSubmit={handleVerifyUID}>
              <label>Student Unique ID</label>

              <div className="uid-input-group">
                <span className="student-uid-prefix">
                  STGGSF-Engin
                </span>

                <input
                  type="text"
                  value={uidNumber}
                  onChange={(event) => {
                    const value = event.target.value;

                    if (/^\d{0,6}$/.test(value)) {
                      setUidNumber(value);
                    }
                  }}
                  placeholder="3 or 6 ERP ID number"
                  maxLength="6"
                  required
                />
              </div>

              {message && (
                <p className="registration-error">
                  {message}
                </p>
              )}

              <button
                type="submit"
                className="student-register-button"
              >
                Verify UID →
              </button>
            </form>
          </>
        ) : (
          <>
            <h2>Student Details Verified ✓</h2>

            <p className="registration-success">
              Your details have been found in the SmartGate database.
            </p>

            <form onSubmit={handleRegister}>
              <label>Student Unique ID</label>
              <input
                type="text"
                value={student.UID || ""}
                disabled
              />

              <label>Full Name</label>
              <input
                type="text"
                value={student.Name || ""}
                disabled
              />

              <label>Email Address</label>
              <input
                type="email"
                value={student.Email || ""}
                disabled
              />

              <label>Mobile Number</label>
              <input
                type="text"
                value={student.Mobile || ""}
                disabled
              />

              <label>Department</label>
              <input
                type="text"
                value={student.Department || ""}
                disabled
              />

              <label>Year</label>
              <input
                type="text"
                value={student.Year || ""}
                disabled
              />

              <button
                type="submit"
                className="student-register-button"
              >
                Complete Registration ✓
              </button>

              <button
                type="button"
                className="student-cancel-button"
                onClick={() => {
                  setStudent(null);
                  setUidNumber("");
                }}
              >
                Cancel
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default StudentRegistration;
