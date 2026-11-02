import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

function AdminUpload({ goHome }) {
  const [students, setStudents] = useState([]);
  const [fileName, setFileName] = useState("");

  const requiredColumns = [
    "UID",
    "Name",
    "Email",
    "Mobile",
    "Department",
    "Year",
  ];

  // Load previously uploaded student data
  useEffect(() => {
    const savedStudents = JSON.parse(
      localStorage.getItem("smartGateStudents") || "[]"
    );

    if (Array.isArray(savedStudents) && savedStudents.length > 0) {
      setStudents(savedStudents);
    }
  }, []);

  // Download required Excel template
  const downloadExcelTemplate = () => {
    const templateData = [
      {
        UID: "STGGSF-Engin12345",
        Name: "Rahul Patil",
        Email: "rahul.patil@ggsf.edu.in",
        Mobile: "9876543210",
        Department: "AI & DS",
        Year: "TE",
      },
      {
        UID: "STGGSF-Engin12346",
        Name: "Priya Sharma",
        Email: "priya.sharma@ggsf.edu.in",
        Mobile: "9876543211",
        Department: "Computer Engineering",
        Year: "TE",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 25 },
      { wch: 25 },
      { wch: 35 },
      { wch: 18 },
      { wch: 30 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Students"
    );

    XLSX.writeFile(
      workbook,
      "SmartGate_Student_Data_Template.xlsx"
    );
  };

  // Validate and upload Excel file
  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);

        const workbook = XLSX.read(data, {
          type: "array",
        });

        if (!workbook.SheetNames.length) {
          alert("No worksheet was found in the Excel file.");
          return;
        }

        // Read first worksheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Read Excel data
        const rawStudentData = XLSX.utils.sheet_to_json(
          worksheet,
          {
            defval: "",
            raw: false,
          }
        );

        // Check empty file
        if (rawStudentData.length === 0) {
          alert(
            "The Excel file is empty. Please use the SmartGate Excel template."
          );
          return;
        }

        // Get uploaded column names
        const uploadedColumns = Object.keys(
          rawStudentData[0]
        ).map((column) => String(column).trim());

        // Check required columns
        const missingColumns = requiredColumns.filter(
          (column) => !uploadedColumns.includes(column)
        );

        if (missingColumns.length > 0) {
          alert(
            "Invalid Excel format.\n\nMissing columns: " +
              missingColumns.join(", ") +
              "\n\nPlease download and use the SmartGate Excel template."
          );
          return;
        }

        // Clean all student records
        const studentData = rawStudentData.map((student) => ({
          UID: String(student.UID || "").trim(),
          Name: String(student.Name || "").trim(),
          Email: String(student.Email || "").trim(),
          Mobile: String(student.Mobile || "")
            .replace(/\D/g, "")
            .trim(),
          Department: String(student.Department || "").trim(),
          Year: String(student.Year || "").trim(),
        }));

        // Check for missing values
        const incompleteRecords = studentData.filter(
          (student) =>
            !student.UID ||
            !student.Name ||
            !student.Email ||
            !student.Mobile ||
            !student.Department ||
            !student.Year
        );

        if (incompleteRecords.length > 0) {
          alert(
            `${incompleteRecords.length} record(s) have missing information.\n\n` +
              "Please complete all required columns in the Excel file."
          );
          return;
        }

        // Validate Student UID format
        const invalidUIDs = studentData.filter(
          (student) =>
            !/^STGGSF-Engin\d{5,6}$/.test(
              student.UID
            )
        );

        if (invalidUIDs.length > 0) {
          alert(
            `${invalidUIDs.length} student record(s) have an invalid UID format.\n\n` +
              "Correct format:\n" +
              "STGGSF-Engin followed by 5 or 6 digits.\n\n" +
              "Example: STGGSF-Engin12345"
          );
          return;
        }

        // Validate email addresses
        const invalidEmails = studentData.filter(
          (student) =>
            !/^\S+@\S+\.\S+$/.test(student.Email)
        );

        if (invalidEmails.length > 0) {
          alert(
            `${invalidEmails.length} student record(s) have an invalid email address.`
          );
          return;
        }

        // Validate mobile numbers
        const invalidMobiles = studentData.filter(
          (student) =>
            !/^\d{10}$/.test(student.Mobile)
        );

        if (invalidMobiles.length > 0) {
          alert(
            `${invalidMobiles.length} student record(s) have an invalid mobile number.\n\n` +
              "Mobile number must contain exactly 10 digits."
          );
          return;
        }

        // Check duplicate UIDs
        const uidList = studentData.map((student) =>
          student.UID.toLowerCase()
        );

        const duplicateUIDs = uidList.filter(
          (uid, index) =>
            uidList.indexOf(uid) !== index
        );

        if (duplicateUIDs.length > 0) {
          alert(
            "Duplicate Student UID found in the Excel file.\n\n" +
              "Please ensure that every student has a unique UID."
          );
          return;
        }

        // Save validated data
        setStudents(studentData);

        localStorage.setItem(
          "smartGateStudents",
          JSON.stringify(studentData)
        );

        alert(
          `${studentData.length} student records uploaded successfully!`
        );

        // Reset file input so the same file can be selected again if needed
        event.target.value = "";
      } catch (error) {
        console.error("Excel upload error:", error);

        alert(
          "Unable to read the Excel file.\n\n" +
            "Please download and use the required SmartGate Excel template."
        );
      }
    };

    reader.onerror = () => {
      alert("Unable to read the selected file.");
    };

    reader.readAsArrayBuffer(file);
  };

  // Clear uploaded student database
  const handleClearDatabase = () => {
    const confirmClear = window.confirm(
      "Are you sure you want to remove all uploaded student records?\n\nThis action cannot be undone."
    );

    if (!confirmClear) {
      return;
    }

    localStorage.removeItem("smartGateStudents");

    // Optional: also clear registered students
    localStorage.removeItem(
      "smartGateRegisteredStudents"
    );

    setStudents([]);
    setFileName("");

    alert("Student database cleared successfully.");
  };

  return (
    <div className="admin-page">

      {/* HEADER */}
      <div className="admin-header">
        <button
          type="button"
          onClick={goHome}
          className="back-button"
        >
          ← Back to Home
        </button>

        <div className="admin-header-content">
          <h1>Administrator Dashboard</h1>

          <p>
            SmartGate - Student Gate Pass Management System
          </p>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="upload-box">

        <h2>Upload Student Admission List</h2>

        <p>
          Download the required Excel template, enter student details,
          and upload the completed file.
        </p>

        {/* DOWNLOAD TEMPLATE */}
        <button
          type="button"
          className="sample-button"
          onClick={downloadExcelTemplate}
        >
          ⬇ Download Required Excel Template
        </button>

        {/* REQUIRED FORMAT */}
        <div className="format-box">
          <strong>Required Excel Columns</strong>

          <p>
            UID | Name | Email | Mobile | Department | Year
          </p>

          <small>
            <strong>Student UID format:</strong>
            <br />
            STGGSF-Engin followed by a 5 or 6 digit numerical number.
            <br />
            Example: STGGSF-Engin12345
          </small>
        </div>

        {/* FILE UPLOAD */}
        <div className="file-upload-section">

          <label
            htmlFor="student-excel"
            className="upload-label"
          >
            📁 Select Completed Excel File
          </label>

          <input
            id="student-excel"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
          />

          {fileName && (
            <p className="selected-file">
              Selected file: <strong>{fileName}</strong>
            </p>
          )}
        </div>

        {/* UPLOAD RESULT */}
        {students.length > 0 && (
          <div className="upload-result">

            <h3>
              ✓ {students.length} Students Available in Database
            </h3>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>UID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Mobile</th>
                    <th>Department</th>
                    <th>Year</th>
                  </tr>
                </thead>

                <tbody>
                  {students
                    .slice(0, 10)
                    .map((student, index) => (
                      <tr key={student.UID || index}>
                        <td>{student.UID}</td>
                        <td>{student.Name}</td>
                        <td>{student.Email}</td>
                        <td>{student.Mobile}</td>
                        <td>{student.Department}</td>
                        <td>{student.Year}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <p className="note">
              Showing the first 10 records. All student records have
              been saved for Student Registration and Student Login.
            </p>

            <button
              type="button"
              className="clear-database-button"
              onClick={handleClearDatabase}
            >
              Clear Student Database
            </button>

          </div>
        )}
      </div>
    </div>
  );
}

export default AdminUpload;