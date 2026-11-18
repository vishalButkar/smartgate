import { useEffect, useState } from "react";
import { supabase, supabaseReady } from "./supabase";
import AdminLogin from "./AdminLogin";

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
      else { setProfile(null); if (["admin","approver","security"].includes(page)) setPage("home"); }
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
      if (!data || !["admin","approver","security"].includes(data.role)) {
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
        throw new Error(`This account is not authorized as ${role}.`);
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
      if (!record) throw new Error("ERP ID not found. Please contact the Administrator.");
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
    if (!profile?.department) return;
    try {
      const { data, error: qError } = await supabase.from("gate_passes")
        .select("id,student_uid,reason,destination,status,created_at,student_master(name,department,year)")
        .eq("status","pending").order("created_at",{ascending:true});
      if (qError) throw qError;
      setPasses((data || []).filter(p => p.student_master?.department === profile.department));
    } catch (e) { setError(e.message); }
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
      if (!data?.length) setMessage("No approved gate pass found. Do not allow exit.");
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
          <RoleCard icon="🛡️" title="Security" desc="Verify approved gate passes at the campus gate." onClick={()=>{clear();setPage("security-login");}}>Security Login</RoleCard>
          <RoleCard icon="🔐" title="Administrator" desc="Manage student records and department approvers." onClick={()=>{clear();setPage("admin-login");}}>Administrator Login</RoleCard>
        </section>
      </>}
      {page === "student" && <section className="portal">
        <Back onClick={goHome}/><h2>Student Gate Pass Request</h2>
        {!student ? <form onSubmit={findStudent}><label>Numeric ERP ID</label><input value={erp} onChange={e=>setErp(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="Enter 2–6 digit ERP ID" required/><button disabled={busy}>{busy?"Checking...":"Find Student"}</button></form> :
          <><div className="student-detail"><b>{student.name}</b><span>ERP ID: {student.uid}</span><span>{student.department} · {student.year}</span><span>{student.email} · {student.mobile}</span></div>
          <form onSubmit={submitPass}><label>Reason for leaving campus</label><textarea value={reason} onChange={e=>setReason(e.target.value)} required/><label>Destination (optional)</label><input value={destination} onChange={e=>setDestination(e.target.value)}/><button disabled={busy}>{busy?"Submitting...":"Submit Gate Pass"}</button></form><button className="secondary-role-button" onClick={()=>setStudent(null)}>Change ERP ID</button></>}
        <p className="small-note">No student password or OTP is required. ERP ID alone does not prove identity; use an institutional identity check if stronger verification is required.</p>
      </section>}
      {["admin-login","approver-login","security-login"].includes(page) && <section className="portal"><Back onClick={goHome}/><h2>{page==="admin-login"?"Administrator Login":page==="approver-login"?"Approver Login":"Security Login"}</h2><form onSubmit={e=>signIn(e,page==="admin-login"?"admin":page==="approver-login"?"approver":"security")}><label>Official college email</label><input type="email" name="email" required/><label>Password</label><input type="password" name="password" required/><button disabled={busy}>{busy?"Signing in...":"Sign in"}</button></form></section>}
      {page === "admin" && profile?.role === "admin" && <AdminLogin goHome={goHome}/>}
      {page === "approver" && profile?.role === "approver" && <section className="portal"><div className="portal-head"><div><h2>Approver Dashboard</h2><p>{profile.full_name} · {profile.department}</p></div><button className="secondary-role-button" onClick={logout}>Logout</button></div><button className="secondary-role-button" onClick={loadPending}>Refresh Requests</button>{passes.length===0?<p>No pending requests for your department.</p>:passes.map(p=><article className="request-card" key={p.id}><b>{p.student_master?.name} · ERP {p.student_uid}</b><p>{p.reason}</p><p>{p.destination || "Destination not provided"} · {new Date(p.created_at).toLocaleString()}</p><button disabled={busy} onClick={()=>decide(p.id,"approved")}>Approve</button><button className="reject" disabled={busy} onClick={()=>decide(p.id,"rejected")}>Reject</button></article>)}</section>}
      {page === "security" && profile?.role === "security" && <section className="portal"><div className="portal-head"><h2>Security Verification</h2><button className="secondary-role-button" onClick={logout}>Logout</button></div><form onSubmit={verifyStudent}><label>Student ERP ID</label><input value={erp} onChange={e=>setErp(e.target.value.replace(/\D/g,"").slice(0,6))} required/><button disabled={busy}>Verify Approved Pass</button></form>{verified.map(p=><article className="request-card approved" key={p.id}><b>{p.student_name} · ERP {p.student_uid}</b><p>{p.reason}</p><p>{p.destination || "—"}</p><strong>APPROVED</strong></article>)}</section>}
      {profile && <footer className="app-footer">SmartGate · GCOERC Nashik <button className="link-button" onClick={logout}>Logout</button></footer>}
    </main>
  </div>;
}
function Back({onClick}) { return <button type="button" className="back-button" onClick={onClick}>← Back to Home</button>; }
function RoleCard({icon,title,desc,onClick,children}) { return <article className="role-card"><div className="role-icon">{icon}</div><h2>{title}</h2><p>{desc}</p><button onClick={onClick}>{children}</button></article>; }
