import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import Papa from "papaparse";

const ACADEMIC_YEARS = ["2023-24", "2024-25", "2025-26", "2026-27", "2027-28"];
const REQUIRED_COLUMNS = ["uid", "name", "email", "mobile", "department", "year"];

function AdminLogin({ goHome }) {
  const [admin, setAdmin] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState("students");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState({ students: 0, requests: 0, approvers: 0 });
  const [studentFile, setStudentFile] = useState(null);
  const [academicYear, setAcademicYear] = useState("2026-27");
  const [uploadReport, setUploadReport] = useState(null);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");

  const departments = useMemo(
    () => [...new Set(faculty.map((person) => person.department).filter(Boolean))].sort(),
    [faculty]
  );

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!data.user) return;
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (profile?.role === "admin" && active) {
          setAdmin(profile);
          await loadDashboard();
        } else if (profile && profile.role !== "admin") {
          await supabase.auth.signOut();
        }
      } catch (err) {
        if (active) setError(err.message || "Unable to verify administrator session.");
      } finally {
        if (active) setCheckingSession(false);
      }
    };
    restoreSession();
    return () => { active = false; };
    // Initial session restoration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboard = async () => {
    const [studentsResult, requestsResult, approversResult] = await Promise.all([
      supabase.from("student_master").select("uid", { count: "exact", head: true }),
      supabase.from("gate_passes").select("id", { count: "exact", head: true }),
      supabase.from("department_approvers").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);
    const firstError = studentsResult.error || requestsResult.error || approversResult.error;
    if (firstError) throw firstError;
    setStats({
      students: studentsResult.count ?? 0,
      requests: requestsResult.count ?? 0,
      approvers: approversResult.count ?? 0,
    });
    await Promise.all([loadFaculty(), loadUploadHistory()]);
  };

  const loadFaculty = async () => {
    const [facultyResult, assignmentResult] = await Promise.all([
      supabase.from("profiles")
        .select("id, uid, full_name, email, department, designation, role")
        .in("role", ["faculty", "approver"])
        .order("department")
        .order("full_name"),
      supabase.from("department_approvers")
        .select("id, user_id, department, is_active"),
    ]);
    if (facultyResult.error) throw facultyResult.error;
    if (assignmentResult.error) throw assignmentResult.error;
    setFaculty(facultyResult.data || []);
    setAssignments(assignmentResult.data || []);
    if (!selectedDepartment && facultyResult.data?.length) {
      setSelectedDepartment(facultyResult.data[0].department || "");
    }
  };
