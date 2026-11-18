import { useEffect, useState } from "react";
import { supabase, supabaseReady } from "./supabase";

export default function App() {
  const [page, setPage] = useState("home");
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [erp, setErp] = useState("");
  const [student, setStudent] = useState(null);
  const [reason, setReason] = useState("");
  const [destination, setDestination] = useState("");
  const [passes, setPasses] = useState([]);
  const [verified, setVerified] = useState([]);

  const clear = () => { setError(""); setMessage(""); };
  const goHome = () => { clear(); setPage("home"); };

  useEffect(() => {
    if (!supabaseReady) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadProfile();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadProfile();
      else { setProfile(null); if (["approver","security"].includes(page)) setPage("home"); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (profile?.role === "approver") loadPending();
  }, [profile]);

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id,uid,full_name,email,department,role")
        .eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!data || !["approver","security"].includes(data.role)) {
        await supabase.auth.signOut();
        throw new Error("This account is not authorized for SmartGate.");
      }
      setProfile(data);
      setPage(data.role);
    } catch (e) { setError(e.message); }
  }

  async function signIn(event, role) {
    event.preventDefault(); clear(); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: String(form.get("email")).trim().toLowerCase(),
        password: String(form.get("password"))
      });
      if (loginError) throw loginError;
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error: pError } = await supabase.from("profiles")
        .select("id,uid,full_name,email,department,role").eq("id", user.id).maybeSingle();
      if (pError) throw pError;
      if (!data || data.role !== role) {
        await supabase.auth.signOut();
        throw new Error(`This account is not authorized as ${role}. Please contact the college SmartGate coordinator.`);
      }
      setProfile(data); setPage(role);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function logout() {
    await supabase.auth.signOut();
    setProfile(null); setPage("home"); clear();
  }

  async function findStudent(event) {
    event.preventDefault(); clear(); setBusy(true); setStudent(null);
    const id = erp.trim();
    try {
      if (!/^\d{2,6}$/.test(id)) throw new Error("Enter your numeric ERP ID (2–6 digits).");
      const { data, error: rpcError } = await supabase.rpc("smartgate_student_lookup", { p_uid: id });
      if (rpcError) throw rpcError;
      const record = Array.isArray(data) ? data[0] : data;
      if (!record) throw new Error("ERP ID not found. Please contact the college office.");
      setStudent(record);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function submitPass(event) {
    event.preventDefault(); clear(); setBusy(true);
    try {
      if (reason.trim().length < 3) throw new Error("Please enter a valid reason.");
      const { error: rpcError } = await supabase.rpc("smartgate_submit_pass", {
        p_uid: student.uid, p_reason: reason.trim(), p_destination: destination.trim() || null
      });
      if (rpcError) throw rpcError;
      setMessage("Your gate-pass request has been submitted. Please wait for approval.");
      setStudent(null); setErp(""); setReason(""); setDestination("");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function loadPending() {
    if (!profile?.department || profile.role !== "approver") return;
    clear();
    setBusy(true);
    try {
      // Filter at the database query level so the approver only receives
      // pending requests belonging to their own department.
      const { data, error: qError } = await supabase
        .from("gate_passes")
        .select("id,student_uid,reason,destination,status,created_at,student_master!inner(name,department,year)")
        .eq("status", "pending")
        .eq("student_master.department", profile.department)
        .order("created_at", { ascending: true });

      if (qError) throw qError;
      setPasses(data || []);
    } catch (e) {
      setError(e.message || "Unable to load department gate-pass requests.");
      setPasses([]);
    } finally {
      setBusy(false);
    }
  }

  async function decide(id, decision) {
    clear(); setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("decide_gate_pass", {
        p_gate_pass_id: id, p_decision: decision
      });
      if (rpcError) throw rpcError;
      setMessage(`Gate-pass request ${decision}.`);
      await loadPending();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function verifyStudent(event) {
    event.preventDefault(); clear(); setBusy(true); setVerified([]);
    try {
      if (!/^\d{2,6}$/.test(erp.trim())) throw new Error("Enter a numeric ERP ID (2–6 digits).");
      const { data, error: rpcError } = await supabase.rpc("smartgate_security_lookup", { p_uid: erp.trim() });
      if (rpcError) throw rpcError;
      setVerified(data || []);
      if (!data?.length) setMessage("No gate-pass request found for this ERP ID.");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (!supabaseReady) return <main className="setup"><h1>SmartGate Setup</h1><p>Step 1: Create a .env file using .env.example and enter your Supabase Project URL and publishable/anon key.</p></main>;

  return <div className="app">
    <header className="top-header">
      <div className="college-info"><img src="/logo.png" alt="GCOERC Logo"/><div><h2>Guru Gobind Singh College of Engineering & Research Centre</h2><p>Nashik, Maharashtra</p></div></div>
      <div className="smartgate-title"><h1>Smart<span>Gate</span></h1><p>Student Gate Pass Management System</p></div>
    </header>
    <main className="main-content">
      {(error || message) && <div className={error ? "notice error" : "notice success"}>{error || message}<button onClick={clear}>×</button></div>}
      {page === "home" && <>
        <section className="welcome-box"><h2>Welcome to Smart<span>Gate</span></h2><p className="subtitle">Student Gate Pass Management System</p><hr/><p className="tagline">Secure • Simple • Efficient</p></section>
        <section className="cards">
          <RoleCard icon="🎓" title="Student" desc="Apply for a gate pass using your numeric ERP ID." onClick={()=>{clear();setPage("student");}}>Apply for Gate Pass</RoleCard>
          <RoleCard icon="✅" title="Gate Pass Approver" desc="Department-authorized staff can approve or reject requests." onClick={()=>{clear();setPage("approver-login");}}>Approver Login</RoleCard>
          <RoleCard icon="🛡️" title="Security" desc="Enter a student ERP ID to check the latest gate-pass status. No login required." onClick={()=>{clear();setErp("");setVerified([]);setPage("security");}}>Check Gate Pass Status</RoleCard>
        </section>
        <footer className="footer-project">
          <p>Project made by</p>
          <h3>
            <a
              className="creator-link"
              href="https://vishalbutkar.github.io/home/card"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Dr. Umakant Butkar's personal webpage"
            >
              Dr. Umakant Butkar
            </a>
          </h3>
          <p>Head - AI &amp; DS, GCOERC, Nashik</p>
        </footer>
      </>}
      {page === "student" && <section className="portal">
        <Back onClick={goHome}/><h2>Student Gate Pass Request</h2>
        {!student ? <form onSubmit={findStudent}><label>Numeric ERP ID</label><input value={erp} onChange={e=>setErp(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="Enter 2–6 digit ERP ID" required/><button disabled={busy}>{busy?"Checking...":"Find Student"}</button></form> :
          <><div className="student-detail"><b>{student.name}</b><span>ERP ID: {student.uid}</span><span>{student.department} · {student.year}</span><span>{student.email} · {student.mobile}</span></div>
          <form onSubmit={submitPass}><label>Reason for leaving campus</label><textarea value={reason} onChange={e=>setReason(e.target.value)} required/><label>Destination (optional)</label><input value={destination} onChange={e=>setDestination(e.target.value)}/><button disabled={busy}>{busy?"Submitting...":"Submit Gate Pass"}</button></form><button className="secondary-role-button" onClick={()=>setStudent(null)}>Change ERP ID</button></>}
        <p className="small-note">No student password or OTP is required. ERP ID alone does not prove identity; use an institutional identity check if stronger verification is required.</p>
      </section>}
      {page === "approver-login" && <section className="portal"><Back onClick={goHome}/><h2>Approver Login</h2><form onSubmit={e=>signIn(e,"approver")}><label>Official college email</label><input type="email" name="email" required/><label>Password</label><input type="password" name="password" required/><button disabled={busy}>{busy?"Signing in...":"Sign in"}</button></form></section>}
      {page === "approver" && profile?.role === "approver" && (
        <section className="portal">
          <div className="portal-head">
            <div>
              <h2>Approver Dashboard</h2>
              <p>{profile.full_name} · {profile.department}</p>
              <p className="small-note">Showing pending requests from your department only.</p>
            </div>
            <button className="secondary-role-button" onClick={logout}>Logout</button>
          </div>

          <button className="secondary-role-button" onClick={loadPending} disabled={busy}>
            {busy ? "Loading..." : "Refresh Requests"}
          </button>

          {!busy && passes.length === 0 ? (
            <p>No pending requests for your department.</p>
          ) : (
            passes.map((p) => (
              <article className="request-card" key={p.id}>
                <b>{p.student_master?.name || "Student"} · ERP {p.student_uid}</b>
                <p><strong>Reason:</strong> {p.reason}</p>
                <p><strong>Destination:</strong> {p.destination || "Not provided"}</p>
                <p><strong>Year:</strong> {p.student_master?.year || "Not available"}</p>
                <p><strong>Submitted:</strong> {p.created_at ? new Date(p.created_at).toLocaleString() : "Not available"}</p>
                <span className="status pending">PENDING</span>
                <div className="action-buttons">
                  <button disabled={busy} onClick={() => decide(p.id, "approved")}>Approve</button>
                  <button className="reject" disabled={busy} onClick={() => decide(p.id, "rejected")}>Reject</button>
                </div>
              </article>
            ))
          )}
        </section>
      )}
      {page === "security" && (
        <section className="portal">
          <div className="portal-head">
            <div>
              <h2>Security Gate Pass Status</h2>
              <p>Enter the student's ERP ID to check the latest gate-pass status.</p>
            </div>
          </div>

          <Back onClick={goHome}/>
          <form onSubmit={verifyStudent}>
            <label>Student ERP ID</label>
            <input
              inputMode="numeric"
              value={erp}
              onChange={(e) => {
                setErp(e.target.value.replace(/\D/g, "").slice(0, 6));
                setVerified([]);
                clear();
              }}
              placeholder="Enter 2–6 digit ERP ID"
              required
            />
            <button type="submit" disabled={busy}>
              {busy ? "Checking..." : "Check Gate Pass Status"}
            </button>
          </form>

          {verified.map((p) => {
            const status = String(p.status || "").toLowerCase();
            const statusColors = {
              approved: { background: "#dcfce7", color: "#166534", border: "#86efac" },
              pending: { background: "#fef3c7", color: "#92400e", border: "#fcd34d" },
              rejected: { background: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
            };
            const colors = statusColors[status] || {
              background: "#e2e8f0", color: "#334155", border: "#cbd5e1"
            };

            return (
              <article className="request-card" key={p.id}>
                <h3>{p.student_name}</h3>
                <p><strong>ERP ID:</strong> {p.student_uid}</p>
                <p><strong>Reason:</strong> {p.reason}</p>
                <p><strong>Destination:</strong> {p.destination || "Not specified"}</p>
                <div
                  role="status"
                  style={{
                    marginTop: "12px",
                    padding: "14px",
                    borderRadius: "8px",
                    border: `1px solid ${colors.border}`,
                    background: colors.background,
                    color: colors.color,
                    fontWeight: 800,
                    textAlign: "center",
                    fontSize: "18px",
                  }}
                >
                  GATE PASS: {status.toUpperCase() || "UNKNOWN"}
                </div>
                <p style={{ fontWeight: 600, marginBottom: 0 }}>
                  {status === "approved" && "Approved. Verify the student's details before allowing exit."}
                  {status === "pending" && "Approval is pending. Do not allow the student to exit."}
                  {status === "rejected" && "Request rejected. Do not allow the student to exit."}
                  {!["approved", "pending", "rejected"].includes(status) && "Status could not be recognized. Contact the college office."}
                </p>
                {p.created_at && (
                  <small>Request date: {new Date(p.created_at).toLocaleString()}</small>
                )}
              </article>
            );
          })}
        </section>
      )}
      {profile && <footer className="app-footer">SmartGate · GCOERC Nashik <button className="link-button" onClick={logout}>Logout</button></footer>}
    </main>
  </div>;
}
function Back({onClick}) { return <button type="button" className="back-button" onClick={onClick}>← Back to Home</button>; }
function RoleCard({icon,title,desc,onClick,children}) { return <article className="role-card"><div className="role-icon">{icon}</div><h2>{title}</h2><p>{desc}</p><button onClick={onClick}>{children}</button></article>; }
