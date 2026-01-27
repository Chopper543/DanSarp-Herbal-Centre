## Staff roles: split migration guide (appointment_manager → doctor/nurse)

You now have 3 relevant staff roles for operations + clinical work:

- **appointment_manager**: scheduling/ops staff (appointments workflow, admin panel access)
- **doctor**: clinical provider (prescriptions, clinical notes, treatment plans, lab results)
- **nurse**: clinical assistant (lab results create/update + intake response review; no prescriptions/clinical notes/treatment plans)

### Quick checklist (who should be what?)

Set a user to **doctor** if they:
- Author prescriptions
- Author SOAP/clinical notes
- Create or manage treatment plans
- Manage their own availability

Set a user to **nurse** if they:
- Upload/enter lab results
- Review intake form submissions
- Assist clinical workflows but do not sign off prescriptions/clinical notes/treatment plans

Keep a user as **appointment_manager** if they:
- Manage scheduling, appointment confirmations, patient communications
- Should not be writing clinical notes or prescribing

### How to migrate users (SQL snippets)

Run in Supabase SQL editor (replace the UUIDs):

**Promote to doctor**

```sql
UPDATE public.users
SET role = 'doctor', updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000000';
```

**Promote to nurse**

```sql
UPDATE public.users
SET role = 'nurse', updated_at = NOW()
WHERE id = '00000000-0000-0000-0000-000000000000';
```

**Bulk migrate a list**

```sql
UPDATE public.users
SET role = 'doctor', updated_at = NOW()
WHERE id IN (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000'
);
```

### Safety notes

- You can migrate gradually (role changes are immediate, no data migration needed).
- If a staff user gets unexpected “Forbidden”, it’s usually because:
  - Their `users.role` wasn’t updated, or
  - You haven’t applied the latest migrations (`031_add_doctor_nurse_roles.sql` + `032_update_rls_for_doctor_nurse.sql`).

