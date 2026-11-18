# SmartGate – GCOERC (clean replacement)

This package keeps the existing working AdminLogin dashboard and replaces the broken/demo localStorage navigation with a single Supabase-backed flow.

## STEP 1 – Supabase setup

1. Open your existing Supabase project and take a backup.
2. Confirm the existing tables/columns:
   - `student_master(uid, name, email, mobile, department, year)`
   - `profiles(id, uid, full_name, email, department, role)`
   - `gate_passes(id, student_uid, reason, destination, status, approved_by, approved_at, created_at)`
   - `department_approvers(id, user_id, department, is_active)`
   - `student_upload_history(id, file_name, academic_year, total_rows, inserted_rows, updated_rows, rejected_rows, uploaded_by, uploaded_at)`
3. In Supabase SQL Editor, review then run `supabase/01_smartgate_rpc.sql`.
4. The existing functions `decide_gate_pass(p_gate_pass_id uuid, p_decision text)` and `admin_set_department_approver(p_user_id uuid, p_department text, p_is_active boolean)` must already exist (as in the earlier setup).
5. Create Auth users for Administrator, Approver and Security. Each must have a matching `profiles` row with role exactly `admin`, `approver`, or `security`. Approver profiles need a department.
6. Ensure existing RLS policies allow:
   - admin role to read/write `student_master`, `student_upload_history`, `profiles`, `department_approvers`, and read `gate_passes`;
   - approver role to read only its department's pending requests (and execute the validated decision RPC);
   - security role to use the security lookup RPC.
   The decision RPC must validate the caller's role and department on the server.

## STEP 2 – Run the project

1. Extract this ZIP into a NEW folder, e.g. `C:\Projects\SmartGate_Final`.
2. Copy `.env.example` to a file named `.env`.
3. In `.env`, enter your actual values:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   ```
   Supabase URL must be the project URL, not a `/rest/v1` URL. Use the publishable/anon key, never a service-role/secret key.
4. Open this new folder in VS Code. In Terminal run:
   ```
   npm install
   npm run dev
   ```
5. Open the exact Local URL printed by Vite.

## CSV format

Required header row: `UID,Name,Email,Mobile,Department,Year`
- UID is numeric only, 2–6 digits.
- Existing UID updates the same record; new UID inserts.
- Duplicate UID within one file is rejected.
- Upload history is saved in `student_upload_history`.

## Important safety / test notes

- Student workflow intentionally has no password/OTP, as requested. ERP ID alone does not prove identity. Anyone who knows another student's ERP ID may submit a request; use this only with a supervised college process or add a stronger identity check before public production use.
- The student lookup RPC returns student contact fields. Consider limiting returned fields to the minimum needed and add rate limiting/abuse monitoring.
- This package preserves your existing `AdminLogin.jsx`; it has not been connected to your live Supabase instance from this environment.
- Your previous ZIP included `.env`. This final package deliberately excludes it. If that file contained a Supabase secret/service-role key, rotate it immediately. A publishable/anon key is intended for browser use but should still not be pasted into chats.
- Test using dummy student records and test accounts first. Confirm RLS, role restrictions, approver decisions and security verification before public deployment.
