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
  const [facultyPasses, setFacultyPasses] = useState([]);
  const [verified, setVerified] = useState([]);
  const [facultyType, setFacultyType] = useState("Personal");
  const [facultyReason, setFacultyReason] = useState("");
  const [leavingTime, setLeavingTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const facultyAuthEmail = (value) => `erp${String(value).trim()}@smartgate.invalid`;
  const clear = () => { setError(""); setMessage(""); };
  const goHome = () => { clear(); setPage("home"); };

  useEffect(() => {
    if (!supabaseReady) return;
    supabase.auth.getSession().then(({ data }) => { if (data.session) loadProfile(); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadProfile();
      else { setProfile(null); setPage("home"); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (profile?.role === "approver" || profile?.role === "principal_ca") loadPending();
  }, [profile]);

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error: profileError } = await supabase.from("profiles")
        .select("id,uid,full_name,email,department,designation,role")
        .eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      const allowed = ["approver", "principal_ca", "faculty", "security"];
      if (!data || !allowed.includes(data.role)) {
        await supabase.auth.signOut();
        throw new Error("This account is not authorized for SmartGate.");
      }
      setProfile(data);
      setPage(data.role === "faculty" ? "faculty" : data.role === "security" ? "security" : "approver");
    } catch (e) { setError(e.message); }
  }

  async function signIn(event, role) {
    event.preventDefault(); clear(); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const loginIdentity = role === "faculty"
        ? facultyAuthEmail(form.get("erp"))
        : String(form.get("email")).trim().toLowerCase();
      if (role === "faculty" && !/^\d{1,10}$/.test(String(form.get("erp") || "").trim()))
        throw new Error("Enter a valid numeric ERP Number.");
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: loginIdentity, password: String(form.get("password"))
      });
      if (loginError) throw loginError;
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error: pError } = await supabase.from("profiles")
        .select("id,uid,full_name,email,department,designation,role").eq("id", user.id).maybeSingle();
      if (pError) throw pError;
      if (!data || data.role !== role) {
        await supabase.auth.signOut();
        throw new Error(`This account is not authorized as ${role}. Please contact the SmartGate coordinator.`);
      }
      setProfile(data); setPage(role === "faculty" ? "faculty" : role === "security" ? "security" : "approver");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function activateFaculty(event) {
    event.preventDefault(); clear(); setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const facultyErp = String(form.get("erp") || "").trim();
      const code = String(form.get("activationCode") || "").trim().toUpperCase();
      const password = String(form.get("password") || "");
      const confirm = String(form.get("confirmPassword") || "");
      if (!/^\d{1,10}$/.test(facultyErp)) throw new Error("Enter a valid numeric ERP Number.");
      if (!/^[A-Z0-9]{8,20}$/.test(code)) throw new Error("Enter the activation code issued by the college office.");
      if (password.length < 8) throw new Error("Password must contain at least 8 characters.");
      if (password !== confirm) throw new Error("Password and confirmation do not match.");
      const { data, error: activationError } = await supabase.functions.invoke("faculty-activate", {
        body: { erpNumber: facultyErp, activationCode: code, password }
      });
      if (activationError) throw activationError;
      if (!data?.success) throw new Error(data?.error || "Faculty account activation failed.");
      setMessage("Account activated successfully. You can now log in using ERP Number and password.");
      setErp(facultyErp); setActivationCode(""); setNewPassword(""); setConfirmPassword(""); setPage("faculty-login");
    } catch (e) { setError(e.message || "Unable to activate account."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await supabase.auth.signOut(); setProfile(null); setPage("home"); clear();
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
      setMessage("Your student gate-pass request has been submitted.");
      setStudent(null); setErp(""); setReason(""); setDestination("");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function submitFacultyPass(event) {
    event.preventDefault(); clear(); setBusy(true);
    try {
      if (!facultyReason.trim()) throw new Error("Enter the reason for leaving campus.");
      if (!leavingTime || !returnTime) throw new Error("Select leaving and expected return time.");
      if (new Date(returnTime) <= new Date(leavingTime)) throw new Error("Expected return time must be after leaving time.");
      if (facultyType === "Personal" && (new Date(returnTime) - new Date(leavingTime)) > 2 * 60 * 60 * 1000)
        throw new Error("Personal gate pass duration cannot exceed 2 hours.");
      const { data, error: rpcError } = await supabase.rpc("smartgate_submit_faculty_pass", {
        p_pass_type: facultyType, p_reason: facultyReason.trim(),
        p_leaving_time: new Date(leavingTime).toISOString(),
        p_expected_return_time: new Date(returnTime).toISOString(),
        p_vehicle_no: vehicleNo.trim() || null
      });
      if (rpcError) throw rpcError;
      const result = Array.isArray(data) ? data[0] : data;
      setMessage(`Faculty gate-pass request submitted. Pass No.: ${result?.gate_pass_no || "Generated"}`);
      setFacultyReason(""); setLeavingTime(""); setReturnTime(""); setVehicleNo("");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function loadPending() {
    if (!profile || !["approver", "principal_ca"].includes(profile.role)) return;
    clear(); setBusy(true);
    try {
      if (profile.role === "approver") {
        const { data, error: qError } = await supabase.from("gate_passes")
          .select("id,student_uid,reason,destination,status,created_at,student_master!inner(name,department,year)")
          .eq("status", "pending").eq("student_master.department", profile.department)
          .order("created_at", { ascending: true });
        if (qError) throw qError;
        setPasses(data || []);
        const { data: fp, error: fe } = await supabase.from("faculty_gate_passes")
          .select("id,gate_pass_no,faculty_name,faculty_uid,department,designation,pass_type,reason,leaving_time,expected_return_time,vehicle_no,status,created_at")
          .eq("status", "pending_hod").eq("department", profile.department).order("created_at", { ascending: true });
        if (fe) throw fe;
        setFacultyPasses(fp || []);
      } else {
        setPasses([]);
        const { data: fp, error: fe } = await supabase.from("faculty_gate_passes")
          .select("id,gate_pass_no,faculty_name,faculty_uid,department,designation,pass_type,reason,leaving_time,expected_return_time,vehicle_no,status,created_at")
          .eq("status", "pending_principal_ca").order("created_at", { ascending: true });
        if (fe) throw fe;
        setFacultyPasses(fp || []);
      }
    } catch (e) { setError(e.message || "Unable to load requests."); setPasses([]); setFacultyPasses([]); }
    finally { setBusy(false); }
  }

  async function decideStudent(id, decision) {
    clear(); setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("decide_gate_pass", { p_gate_pass_id: id, p_decision: decision });
      if (rpcError) throw rpcError;
      setMessage(`Student gate-pass request ${decision}.`); await loadPending();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function decideFaculty(id, decision) {
    clear(); setBusy(true);
    try {
      const { error: rpcError } = await supabase.rpc("smartgate_decide_faculty_pass", {
        p_pass_id: id, p_decision: decision
      });
      if (rpcError) throw rpcError;
      setMessage(`Faculty gate-pass request ${decision}.`); await loadPending();
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

  if (!supabaseReady) return <main className="setup"><h1>SmartGate Setup</h1><p>Create .env with your Supabase URL and anon key.</p></main>;

  return <div className="app">
    <header className="top-header">
      <div className="college-info"><img className="logo" src="/logo.png" alt="GCOERC Logo"/><div><h2>Guru Gobind Singh College of Engineering & Research Centre</h2><p>Nashik, Maharashtra</p></div></div>
      <div className="smartgate-title"><h1>Smart<span>Gate</span></h1><p>Gate Pass Management System</p></div>
    </header>
    <main className="main-content">
      {(error || message) && <div className={error ? "notice error" : "notice success"}>{error || message}<button onClick={clear}>×</button></div>}
      {page === "home" && <>
        <section className="welcome-box"><h2>Welcome to Smart<span>Gate</span></h2><p className="subtitle">Student & Faculty Gate Pass Management System</p><hr/><p className="tagline">Secure • Simple • Efficient</p></section>
        <section className="cards">
          <RoleCard icon="🎓" title="Student Gate Pass" desc="Apply using your numeric ERP ID." onClick={()=>{clear();setPage("student");}}>Student Request</RoleCard>
          <RoleCard icon="🧑‍🏫" title="Faculty Gate Pass" desc="Faculty can apply for official or personal campus exit." onClick={()=>{clear();setPage("faculty-login");}}>Faculty Login</RoleCard>
          <RoleCard icon="✅" title="Approval" desc="HOD and Principal/CA approve faculty requests; HOD handles student requests." onClick={()=>{clear();setPage("approver-login");}}>Approver Login</RoleCard>
          <RoleCard icon="🛡️" title="Security" desc="Check student gate-pass status." onClick={()=>{clear();setErp("");setVerified([]);setPage("security");}}>Check Status</RoleCard>
        </section>
        <footer className="footer-project"><div><p>Project made by</p><h3><a className="creator-link" href="https://vishalbutkar.github.io/home/card" target="_blank" rel="noopener noreferrer">Dr. Umakant Butkar</a></h3><p>Head - AI &amp; DS, GCOERC, Nashik</p></div></footer>
      </>}
      {page === "student" && <section className="portal"><Back onClick={goHome}/><h2>Student Gate Pass Request</h2>
        {!student ? <form onSubmit={findStudent}><label>Numeric ERP ID</label><input value={erp} onChange={e=>setErp(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="Enter 2–6 digit ERP ID" required/><button disabled={busy}>{busy?"Checking...":"Find Student"}</button></form> : <><div className="student-detail"><b>{student.name}</b><span>ERP ID: {student.uid}</span><span>{student.department} · {student.year}</span><span>{student.email} · {student.mobile}</span></div><form onSubmit={submitPass}><label>Reason for leaving campus</label><textarea value={reason} onChange={e=>setReason(e.target.value)} required/><label>Destination (optional)</label><input value={destination} onChange={e=>setDestination(e.target.value)}/><button disabled={busy}>{busy?"Submitting...":"Submit Gate Pass"}</button></form><button className="secondary-role-button" onClick={()=>setStudent(null)}>Change ERP ID</button></>}
        <p className="small-note">No student password or OTP is required.</p></section>}
      {page === "faculty-login" && <section className="portal"><Back onClick={goHome}/><h2>Faculty / Staff Login</h2><form onSubmit={e=>signIn(e,"faculty")}><label>ERP Number</label><input name="erp" inputMode="numeric" pattern="[0-9]{1,10}" maxLength="10" value={erp} onChange={e=>setErp(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="Enter ERP Number" required/><label>Password</label><input type="password" name="password" autoComplete="current-password" required/><button disabled={busy}>{busy?"Signing in...":"Sign in"}</button></form><p className="small-note">First time using SmartGate? <button type="button" className="inline-link-button" onClick={()=>{clear();setPage("faculty-setup");}}>Activate your account / Set password</button></p></section>}
      {page === "faculty-setup" && <section className="portal"><Back onClick={()=>{clear();setPage("faculty-login");}}/><h2>First-time Faculty Account Setup</h2><p className="small-note">Use the unique one-time activation code issued privately by the college administrator.</p><form onSubmit={activateFaculty}><label>ERP Number</label><input name="erp" inputMode="numeric" pattern="[0-9]{1,10}" maxLength="10" value={erp} onChange={e=>setErp(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="Enter ERP Number" required/><label>One-time Activation Code</label><input name="activationCode" autoComplete="off" value={activationCode} onChange={e=>setActivationCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,20))} placeholder="Enter code from college office" required/><label>Create Password</label><input name="password" type="password" autoComplete="new-password" minLength="8" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/><label>Confirm Password</label><input name="confirmPassword" type="password" autoComplete="new-password" minLength="8" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required/><button disabled={busy}>{busy?"Activating...":"Activate Account"}</button></form></section>}
      {page === "faculty" && profile?.role === "faculty" && <section className="portal faculty-pass-portal">
        <div className="portal-head"><div><h2>Faculty Gate Pass</h2><p>{profile.full_name} · {profile.department} · {profile.designation || "Faculty"}</p></div><button className="secondary-role-button" onClick={logout}>Logout</button></div>
        <form onSubmit={submitFacultyPass}>
          <label>Faculty Name</label><input value={profile.full_name} disabled />
          <label>Department &amp; Designation</label><input value={`${profile.department || ""} · ${profile.designation || "Faculty"}`} disabled />
          <label>Gate Pass Type</label><select value={facultyType} onChange={e=>setFacultyType(e.target.value)}><option>Official</option><option>Personal</option></select>
          <label>Reason for Leaving Campus</label><textarea value={facultyReason} onChange={e=>setFacultyReason(e.target.value)} required placeholder="Enter reason" />
          <label>Time of Leaving</label><input type="datetime-local" value={leavingTime} onChange={e=>setLeavingTime(e.target.value)} required />
          <label>Expected Time of Return</label><input type="datetime-local" value={returnTime} onChange={e=>setReturnTime(e.target.value)} required />
          <label>Vehicle Number</label><input value={vehicleNo} onChange={e=>setVehicleNo(e.target.value.toUpperCase())} placeholder="e.g. MH 15 AB 1234" />
          <button disabled={busy}>{busy?"Submitting...":"Submit Faculty Gate Pass"}</button>
        </form>
        <p className="small-note">Personal gate pass: maximum 2 hours. Approval is required from HOD and then Principal/CA.</p>
      </section>}
      {page === "approver-login" && <section className="portal"><Back onClick={goHome}/><h2>Approval Login</h2><form onSubmit={e=>{const role=e.currentTarget.elements.role.value;signIn(e,role);}}><label>Login as</label><select name="role"><option value="approver">HOD / Department Approver</option><option value="principal_ca">Principal / CA</option></select><label>Official college email</label><input type="email" name="email" required/><label>Password</label><input type="password" name="password" required/><button disabled={busy}>{busy?"Signing in...":"Sign in"}</button></form></section>}
      {page === "approver" && profile && ["approver","principal_ca"].includes(profile.role) && <section className="portal">
        <div className="portal-head"><div><h2>{profile.role === "principal_ca" ? "Principal / CA Approval" : "HOD Approval"}</h2><p>{profile.full_name} · {profile.department || "College level"}</p><p className="small-note">{profile.role === "principal_ca" ? "Faculty requests approved by HOD are shown here for final approval." : "Student and faculty requests from your department are shown here."}</p></div><button className="secondary-role-button" onClick={logout}>Logout</button></div>
        <button className="secondary-role-button" onClick={loadPending} disabled={busy}>{busy?"Loading...":"Refresh Requests"}</button>
        {profile.role === "approver" && <><h3>Student Requests</h3>{passes.length===0?<p>No pending student requests.</p>:passes.map(p=><article className="request-card" key={p.id}><b>{p.student_master?.name || "Student"} · ERP {p.student_uid}</b><p><strong>Reason:</strong> {p.reason}</p><p><strong>Destination:</strong> {p.destination || "Not provided"}</p><p><strong>Year:</strong> {p.student_master?.year || "Not available"}</p><span className="status pending">PENDING</span><div className="action-buttons"><button disabled={busy} onClick={()=>decideStudent(p.id,"approved")}>Approve</button><button className="reject" disabled={busy} onClick={()=>decideStudent(p.id,"rejected")}>Reject</button></div></article>)}</>}
        <h3>Faculty Requests {profile.role === "principal_ca" ? "(Final Approval)" : "(HOD Approval)"}</h3>
        {facultyPasses.length===0?<p>No pending faculty requests.</p>:facultyPasses.map(p=><article className="request-card" key={p.id}><b>{p.faculty_name} · Pass No. {p.gate_pass_no}</b><p><strong>Department &amp; Post:</strong> {p.department} · {p.designation || "Faculty"}</p><p><strong>Type:</strong> {p.pass_type}</p><p><strong>Reason:</strong> {p.reason}</p><p><strong>Leaving:</strong> {new Date(p.leaving_time).toLocaleString()}</p><p><strong>Expected Return:</strong> {new Date(p.expected_return_time).toLocaleString()}</p><p><strong>Vehicle:</strong> {p.vehicle_no || "Not provided"}</p><span className="status pending">{p.status === "pending_hod" ? "PENDING HOD" : "PENDING PRINCIPAL / CA"}</span><div className="action-buttons"><button disabled={busy} onClick={()=>decideFaculty(p.id,"approved")}>Approve</button><button className="reject" disabled={busy} onClick={()=>decideFaculty(p.id,"rejected")}>Reject</button></div></article>)}
      </section>}
      {page === "security" && <section className="portal"><div className="portal-head"><div><h2>Security Gate Pass Status</h2><p>Enter the student's ERP ID to check the latest gate-pass status.</p></div></div><Back onClick={goHome}/><form onSubmit={verifyStudent}><label>Student ERP ID</label><input inputMode="numeric" value={erp} onChange={e=>{setErp(e.target.value.replace(/\D/g,"").slice(0,6));setVerified([]);clear();}} placeholder="Enter 2–6 digit ERP ID" required/><button type="submit" disabled={busy}>{busy?"Checking...":"Check Gate Pass Status"}</button></form>
        {verified.map(p=><article className="request-card" key={p.id}><h3>{p.student_name}</h3><p><strong>ERP ID:</strong> {p.student_uid}</p><p><strong>Reason:</strong> {p.reason}</p><p><strong>Destination:</strong> {p.destination || "Not specified"}</p><div className={`status ${p.status}`}>GATE PASS: {String(p.status).toUpperCase()}</div><p>{p.status === "approved" ? "Approved. Verify student details before allowing exit." : p.status === "pending" ? "Approval pending. Do not allow exit." : "Request rejected. Do not allow exit."}</p></article>)}
      </section>}
      {profile && <footer className="app-footer">SmartGate · GCOERC Nashik <button className="link-button" onClick={logout}>Logout</button></footer>}
    </main>
  </div>;
}
function Back({onClick}) { return <button type="button" className="back-button" onClick={onClick}>← Back to Home</button>; }
function RoleCard({icon,title,desc,onClick,children}) { return <article className="role-card"><div className="role-icon">{icon}</div><h2>{title}</h2><p>{desc}</p><button onClick={onClick}>{children}</button></article>; }
