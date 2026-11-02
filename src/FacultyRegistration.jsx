import { useState } from "react";

function FacultyRegistration({ goHome }) {
  const [faculty, setFaculty] = useState({
    facultyId: "",
    name: "",
    email: "",
    mobile: "",
    department: "",
    designation: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFaculty((previousFaculty) => ({
      ...previousFaculty,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
  event.preventDefault();

  // Allow only official GGSF email addresses
  if (!faculty.email.toLowerCase().endsWith("@ggsf.edu.in")) {
    alert(
      "Registration is allowed only with an official @ggsf.edu.in email address."
    );
    return;
  }

  // Complete Faculty Unique ID

    // Complete Faculty / Staff Unique ID
    const completeFacultyId = `FCGGSF-Engin${faculty.facultyId}`;

    // Get existing faculty records
    const existingFaculty = JSON.parse(
      localStorage.getItem("smartGateFaculty") || "[]"
    );

    // Check whether the Unique ID already exists
    const alreadyExists = existingFaculty.some(
      (item) => item.facultyId === completeFacultyId
    );

    if (alreadyExists) {
      alert("This Faculty / Staff Unique ID is already registered.");
      return;
    }

    // Create new faculty record
    const newFaculty = {
      ...faculty,
      facultyId: completeFacultyId,
    };

    // Save the record
    const updatedFaculty = [...existingFaculty, newFaculty];

    localStorage.setItem(
      "smartGateFaculty",
      JSON.stringify(updatedFaculty)
    );

    alert(
      `Faculty / Staff registered successfully!\nUnique ID: ${completeFacultyId}`
    );

    // Clear the form
    setFaculty({
      facultyId: "",
      name: "",
      email: "",
      mobile: "",
      department: "",
      designation: "",
    });
  };

  return (
    <div className="faculty-page">
      {/* HEADER */}
      <div className="faculty-header">
        <button onClick={goHome} className="back-button">
          <span>←</span> Back to Home
        </button>

        <div className="faculty-header-content">
          <h1>Faculty Registration</h1>
          <p>SmartGate - Student Gate Pass Management System</p>
        </div>
      </div>

      {/* REGISTRATION FORM */}
      <div className="faculty-form-box">
        <h2>Register Faculty / Staff</h2>

        <form onSubmit={handleSubmit}>
          <label>Faculty / Staff Unique ID</label>

          <div className="uid-input-group">
            <span className="uid-prefix">FCGGSF-Engin</span>

            <input
              type="text"
              name="facultyId"
              value={faculty.facultyId}
              onChange={(event) => {
                const value = event.target.value;

                // Allow only numbers, maximum 6 digits
                if (/^\d{0,6}$/.test(value)) {
                  handleChange(event);
                }
              }}
              placeholder="5 or 6 digit number"
              pattern="[0-9]{5,6}"
              title="Please enter a 5 or 6 digit numerical number"
              maxLength="6"
              required
            />
          </div>

          <label>Full Name</label>
          <input
            type="text"
            name="name"
            value={faculty.name}
            onChange={handleChange}
            placeholder="Enter Full Name"
            required
          />

          <label>Official Email Address</label>
<input
  type="email"
  name="email"
  value={faculty.email}
  onChange={handleChange}
  placeholder="example@ggsf.edu.in"
  pattern="^[A-Za-z0-9._%+-]+@ggsf\.edu\.in$"
  title="Please enter your official @ggsf.edu.in email address"
  required
/>

<p className="email-help">
  Only official @ggsf.edu.in email addresses are allowed.
</p>

          <label>Mobile Number</label>
          <input
            type="tel"
            name="mobile"
            value={faculty.mobile}
            onChange={handleChange}
            placeholder="Enter Mobile Number"
            pattern="[0-9]{10}"
            maxLength="10"
            required
          />

          <label>Department</label>
          <select
            name="department"
            value={faculty.department}
            onChange={handleChange}
            required
          >
            <option value="">Select Department</option>
            <option value="Computer Engineering">
              Computer Engineering
            </option>
            <option value="AI & DS">
              Artificial Intelligence & Data Science
            </option>
            <option value="Mechanical Engineering">
              Mechanical Engineering
            </option>
            <option value="Civil Engineering">
              Civil Engineering
            </option>
            <option value="Electrical Engineering">
              Electrical Engineering
            </option>
            <option value="MBA/BBA">
              Management Studies
            </option>
            <option value="First Year Engineering">
              First Year Engineering
            </option>
          </select>

                     
          
   

          <button type="submit" className="faculty-submit-button">
            Register Faculty / Staff
          </button>
        </form>
      </div>
    </div>
  );
}

export default FacultyRegistration;