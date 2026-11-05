
import { useState } from "react";
import "./App.css";

import StudentRegistration from "./StudentRegistration";
import StudentLogin from "./StudentLogin";
import SecurityLogin from "./SecurityLogin";
import AuthorizedApproverLogin from "./AuthorizedApproverLogin";

function App() {
  const [page, setPage] = useState("home");

  const goHome = () => {
    setPage("home");
  };

  const handleAdminClick = () => {
    alert(
      "Administrator access is restricted.\n\n" +
      "Administrator login will be available through the " +
      "secure SmartGate administration portal.\n\n" +
      "Contact:\nDr. Umakant Butkar\nHead - AI & DS, GCOERC"
    );
  };

  // PAGE NAVIGATION

  if (page === "student-registration") {
    return (
      <StudentRegistration
        goHome={goHome}
        goLogin={() => setPage("student-login")}
      />
    );
  }

  if (page === "student-login") {
    return <StudentLogin goHome={goHome} />;
  }

  if (page === "approver-login") {
    return <AuthorizedApproverLogin goHome={goHome} />;
  }

  if (page === "security-login") {
    return <SecurityLogin goHome={goHome} />;
  }

  // HOME PAGE

  return (
    <div className="app">

      {/* HEADER */}

      <header className="top-header">

        <div className="college-info">

          <img
            src="/logo.png"
            alt="GCOERC Logo"
            className="logo"
          />

          <div>
            <h2>
              Guru Gobind Singh College of Engineering
              & Research Centre
            </h2>

            <p>Nashik, Maharashtra</p>
          </div>

        </div>

        <div className="smartgate-title">
          <h1>
            Smart<span>Gate</span>
          </h1>

          <p>Student Gate Pass Management System</p>
        </div>

      </header>

      {/* MAIN CONTENT */}

      <main className="main-content">

        <section className="welcome-box">

          <h2>
            Welcome to Smart<span>Gate</span>
          </h2>

          <p className="subtitle">
            Student Gate Pass Management System
          </p>

          <hr />

          <p className="tagline">
            Secure • Simple • Efficient
          </p>

        </section>

        {/* USER ACCESS CARDS */}

        <section className="cards">

          {/* STUDENT */}

          <div className="role-card student">

            <div className="icon">🎓</div>

            <h2>Student</h2>

            <p>
              Register, login and apply for a SmartGate pass.
            </p>

            <button
              type="button"
              onClick={() => setPage("student-registration")}
            >
              Student Registration
            </button>

            <button
              type="button"
              className="secondary-role-button"
              onClick={() => setPage("student-login")}
            >
              Student Login
            </button>

          </div>

          {/* APPROVER */}

          <div className="role-card approver">

            <div className="icon">✅</div>

            <h2>Gate Pass Approver</h2>

            <p>
              Pre-authorized staff can review and approve
              student gate pass requests.
            </p>

            <button
              type="button"
              onClick={() => setPage("approver-login")}
            >
              Approver Login
            </button>

            <p className="admin-contact">
              Login using official college email
              and password.
            </p>

          </div>

          {/* SECURITY */}

          <div className="role-card security">

            <div className="icon">🛡️</div>

            <h2>Security</h2>

            <p>
              Verify approved gate passes before
              allowing student exit.
            </p>

            <button
              type="button"
              onClick={() => setPage("security-login")}
            >
              Security Verification
            </button>

          </div>

          {/* ADMINISTRATOR */}

          <div className="role-card admin">

            <div className="icon">🔐</div>

            <h2>Administrator</h2>

            <p>
              Manage student records, staff authorization
              and SmartGate administration.
            </p>

            <button
              type="button"
              onClick={handleAdminClick}
            >
              Administrator Login
            </button>

            <p className="admin-contact">
              Administrator:
              <br />
              <strong>Dr. Umakant Butkar</strong>
              <br />
              Head - AI & DS, GCOERC
            </p>

          </div>

        </section>

      </main>

      {/* FOOTER */}

      <footer>

        <div className="footer-college">

          <img
            src="/logo.png"
            alt="GCOERC Logo"
          />

          <div>
            <h3>
              Guru Gobind Singh College of Engineering
              & Research Centre
            </h3>

            <p>Nashik, Maharashtra</p>
          </div>

        </div>

        <div className="footer-project">

          <p>Project Made by</p>

          <h3>Dr. Umakant Butkar</h3>

          <p>Head - AI & DS, GCOERC</p>

        </div>

      </footer>

    </div>
  );
}

export default App;
