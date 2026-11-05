import { useState } from "react";

function StudentRegistration({ goHome, goLogin }) {
  const [uidNumber, setUidNumber] = useState("");
  const [student, setStudent] = useState(null);
  const [message, setMessage] = useState("");

  // Safely get data from localStorage
  const getStoredData = (key) => {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Error reading ${key}:`, error);
      return [];
    }
  };

  // Verify Student UID from Admin uploaded Excel data
  const handleVerifyUID = (event) => {
    event.preventDefault();
    setMessage("");

    
    if (!/^\d{5,6}$/.test(uidNumber)) {
      setMessage(
        "Please enter a valid ERP ID Number."
      );
      return;
    }

    // Complete Student UID
    const completeUID = `STGGSF-Engin${uidNumber}`;

    // Get student data uploaded by Administrator
    const students = getStoredData("smartGateStudents");

    if (students.length === 0) {
      setMessage(
        "Student database is not available. Please contact the Administrator."
      );
      return;
    }

    // Find student using UID
    const foundStudent = students.find(
      (item) =>
        String(item.UID || "").trim().toLowerCase() ===
        completeUID.toLowerCase()
    );

    // UID not found
    if (!foundStudent) {
      setStudent(null);
      setMessage(
        "Student UID not found. Please check your UID or contact the Administrator."
      );
      return;
    }

    // Check whether student is already registered
    const registeredStudents = getStoredData(
      "smartGateRegisteredStudents"
    );

    const alreadyRegistered = registeredStudents.some(
      (item) =>
        String(item.UID || "").trim().toLowerCase() ===
        completeUID.toLowerCase()
    );

    if (alreadyRegistered) {
      setStudent(null);
      setMessage(
        "This Student UID is already registered. Please proceed to Student Login."
      );
      return;
    }

    // Display verified student details
    setStudent(foundStudent);
    setMessage("");
  };

  // Complete Student Registration
  const handleRegister = (event) => {
    event.preventDefault();

    if (!student) return;

    const registeredStudents = getStoredData(
      "smartGateRegisteredStudents"
    );

    // Final duplicate check
    const alreadyRegistered = registeredStudents.some(
      (item) =>
        String(item.UID || "").trim().toLowerCase() ===
        String(student.UID || "").trim().toLowerCase()
    );

    if (alreadyRegistered) {
      alert(
        "This Student UID is already registered. Please proceed to Student Login."
      );
      return;
    }

    // Save verified student details
    const updatedStudent = {
      ...student,
      registeredAt: new Date().toLocaleString(),
    };

    localStorage.setItem(
      "smartGateRegisteredStudents",
      JSON.stringify([
        ...registeredStudents,
        updatedStudent,
      ])
    );

    alert(
      "Student registration completed successfully! You can now login."
    );

    // Clear registration data
    setStudent(null);
    setUidNumber("");
    setMessage("");

    // Redirect to Student Login
    if (typeof goLogin === "function") {
      goLogin();
    }
  };

  // Cancel and return to UID verification
  const handleCancel = () => {
    setStudent(null);
    setUidNumber("");
    setMessage("");
  };

  return (
    <div className="student-registration-page">

      {/* HEADER */}
      <div className="student-registration-header">
        <button
          type="button"
          onClick={goHome}
          className="student-back-button"
        >
          ← Back to Home
        </button>

        <div className="student-registration-header-content">
          <h1>Student Registration</h1>
          <p>
            SmartGate - Student Gate Pass Management System
          </p>
        </div>
      </div>

      {/* REGISTRATION BOX */}
      <div className="student-registration-box">

        {!student ? (
          <>
            <h2>Verify Student Unique ID</h2>

            <p className="registration-info">
              Enter your Student Unique ID. Your details will be verified
              from the student database uploaded by the Administrator.
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

                    // Allow only numbers, maximum 6 digits
                    if (/^\d{0,6}$/.test(value)) {
                      setUidNumber(value);
                      setMessage("");
                    }
                  }}
                  placeholder="Enter ERP ID number"
                  pattern="[0-9]{5,6}"
                  title="Enter ERP number"
                  maxLength="6"
                  required
                />
              </div>

              <p className="uid-help">
                Enter only ERP Number
              </p>

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
              Your details have been successfully verified from the
              Administrator's student database. Please confirm the
              information below to complete your registration.
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
                onClick={handleCancel}
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
