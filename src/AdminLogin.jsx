        .select("id, user_id, department, is_active"),
    ]);

    if (facultyResult.error) throw facultyResult.error;
    if (assignmentResult.error) throw assignmentResult.error;

    const people = facultyResult.data || [];
    setFaculty(people);
    setAssignments(assignmentResult.data || []);

    if (people.length) {
      setSelectedDepartment((current) =>
        current && people.some((person) => person.department === current)
          ? current
          : people[0].department || ""
      );
    } else {
      setSelectedDepartment("");
    }
  };

  const loadUploadHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error: historyError } = await supabase
        .from("student_upload_history")
        .select(
          "id, file_name, academic_year, total_rows, inserted_rows, updated_rows, rejected_rows, uploaded_at"
        )
        .order("uploaded_at", { ascending: false })
        .limit(20);

      if (historyError) throw historyError;
      setUploadHistory(data || []);
    } catch (err) {
      setError((current) =>
        current ? `${current} | Upload history: ${err.message}` : err.message
      );
    } finally {
      setLoadingHistory(false);
    }
  };

  const normalizeHeader = (value) =>
    String(value || "").trim().toLowerCase();

  const normalizeUID = (value) => {
    const uid = String(value ?? "").trim();
    return /^\d{2,6}$/.test(uid) ? uid : null;
  };

  const saveUploadHistory = async (record) => {
    const { error: historyError } = await supabase
      .from("student_upload_history")
      .insert({
        file_name: record.fileName,
        academic_year: academicYear,
        total_rows: record.total,
        inserted_rows: record.inserted,
        updated_rows: record.updated,
        rejected_rows: record.rejected,
        uploaded_by: admin.id,
      });

    if (historyError) {
      throw new Error(
        `Student data was uploaded, but upload history could not be saved: ${historyError.message}`
      );
    }
  };

  const handleCSVUpload = () => {
    if (!studentFile) {
      setError("Please select a CSV file first.");
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    setUploadReport(null);

    Papa.parse(studentFile, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: normalizeHeader,
      complete: async (results) => {
        let inserted = 0;
        let updated = 0;
        let validRows = [];
        const rejectedRows = [];
        const seenUIDs = new Set();

        try {
          const headers = results.meta.fields || [];
          const missing = REQUIRED_COLUMNS.filter(
            (column) => !headers.includes(column)
          );

          if (missing.length) {
            throw new Error(
              `Missing CSV columns: ${missing.join(", ")}. Required columns are UID, Name, Email, Mobile, Department and Year.`
            );
          }

          if (results.errors?.length) {
            throw new Error(
              `CSV parsing error: ${results.errors[0].message || "Please check the CSV file."}`
            );
          }

          (results.data || []).forEach((row, index) => {
            const uid = normalizeUID(row.uid);
            const name = String(row.name || "").trim();
            const email = String(row.email || "").trim().toLowerCase();
            const mobile = String(row.mobile || "").replace(/\s+/g, "");
            const department = String(row.department || "").trim();
            const year = String(row.year || "").trim();

            let reason = "";
            if (!uid) reason = "ERP ID must contain only 2–6 digits";
            else if (!name) reason = "Student name is missing";
            else if (
              !email ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ) reason = "Invalid or missing email";
            else if (!/^\d{10}$/.test(mobile))
              reason = "Mobile number must contain 10 digits";
            else if (!department) reason = "Department is missing";
            else if (!year) reason = "Year is missing";
            else if (seenUIDs.has(uid)) reason = "Duplicate ERP ID in this CSV";

            if (reason) {
              rejectedRows.push({ row: index + 2, reason });
              return;
            }

            seenUIDs.add(uid);
            validRows.push({ uid, name, email, mobile, department, year });
          });

          if (!validRows.length) {
            setUploadReport({
              total: results.data?.length || 0,
              inserted: 0,
              updated: 0,
              rejected: rejectedRows.length,
              rejectedRows,
            });
            throw new Error("No valid student records found in this CSV.");
          }

          // Read existing ERP IDs first so the report can distinguish inserts and updates.
          const allUIDs = validRows.map((row) => row.uid);
          const existingUIDs = new Set();

          for (let i = 0; i < allUIDs.length; i += 500) {
            const batchUIDs = allUIDs.slice(i, i + 500);
            const { data: existing, error: existingError } = await supabase
              .from("student_master")
