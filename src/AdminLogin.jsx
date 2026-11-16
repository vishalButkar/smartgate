
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Papa from "papaparse";

function AdminLogin({ goHome }) {
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState("students");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [stats, setStats] = useState({
    students: 0,
    requests: 0,
    approvers: 0,
  });

  const [studentFile, setStudentFile] = useState(null);
  const [uploadReport, setUploadReport] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [academicYear, setAcademicYear] = useState("2026-27");
    const [uploadHistory, setUploadHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

  const [faculty, setFaculty] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");


  const departments = [
    ...new Set(faculty.map((item) => item.department).filter(Boolean)),
  ].sort();

  useEffect(() => {
    checkAdminSession();
  }, []);

  const checkAdminSession = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!data.user) return;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.role === "admin") {
        setAdmin(profile);
        await loadDashboard();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = form.get("password");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile || profile.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("This account is not authorized as Administrator.");
      }

      setAdmin(profile);
      await loadDashboard();
    } catch (err) {
