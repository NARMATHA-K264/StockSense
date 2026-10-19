import { useEffect, useState } from "react";
import Loading from "../components/Loading";
import FormModal from "../components/FormModal";
import { ErrorMessage, SuccessMessage } from "../components/Feedback";
import { api } from "../services/api";

const initialForm = { name: "", email: "", role: "manager" };

export default function UserManagement() {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [success, setSuccess] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [copiedInvitation, setCopiedInvitation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState("");
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const loadUsers = () => {
    setLoading(true);
    setListError("");
    api.users.list()
      .then((result) => setUsers(result.users || []))
      .catch((requestError) => setListError(requestError.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const roleCounts = {
    manager: users.filter((user) => user.role === "manager").length,
    cashier: users.filter((user) => user.role === "cashier").length,
    inventory_staff: users.filter((user) => user.role === "inventory_staff").length,
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setInvitationUrl("");
    setCopiedInvitation(false);
    setBusy(true);

    try {
      const result = await api.users.create(form);
      setSuccess(result.message || "Invitation sent successfully.");
      setInvitationUrl(result.invitationUrl || "");
      setForm(initialForm);
      setShowForm(false);
      loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const resendInvitation = async (email) => {
    setError("");
    setSuccess("");
    setInvitationUrl("");
    setCopiedInvitation(false);
    setResending(email);
    try {
      const result = await api.users.resendInvitation({ email });
      setSuccess(result.message || "Invitation sent successfully.");
      setInvitationUrl(result.invitationUrl || "");
      loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setResending("");
    }
  };

  const getInvitationLink = async (email) => {
    setError("");
    setSuccess("");
    setInvitationUrl("");
    setCopiedInvitation(false);
    try {
      const result = await api.users.getInvitationLink({ email });
      setSuccess(result.message || "A new invitation link is ready to share.");
      setInvitationUrl(result.invitationUrl || "");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const copyInvitationLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopiedInvitation(true);
      setError("");
    } catch {
      setError("Could not access the clipboard. Select and copy the invitation link shown below.");
    }
  };

  const removeUser = async () => {
    if (!removeTarget) return;
    setError("");
    setSuccess("");
    setRemoving(removeTarget.email);
    try {
      const result = await api.users.remove({ email: removeTarget.email });
      setSuccess(result.message || "User access was removed successfully.");
      setRemoveTarget(null);
      loadUsers();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRemoving("");
    }
  };

  return <>
    <section className="page-intro user-management-intro">
      <div><span className="kicker">ACCESS / TEAM</span><h2>User Management</h2></div>
      <button className="primary" type="button" onClick={() => { setShowForm((visible) => !visible); setError(""); }}>
        {showForm ? "Cancel" : "+ Create User"}
      </button>
    </section>
    <ErrorMessage message={listError} />
    <ErrorMessage message={error} />
    <SuccessMessage message={success} />
    {invitationUrl && <section className="panel" aria-live="polite">
      <div className="panel-heading"><div><span className="kicker">MANUAL INVITATION</span><h3>Share this one-time link</h3></div></div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <input aria-label="Invitation link" readOnly value={invitationUrl} onFocus={(event) => event.target.select()} style={{ flex: "1 1 320px" }} />
        <button className="secondary small" type="button" onClick={copyInvitationLink}>{copiedInvitation ? "Copied" : "Copy invitation link"}</button>
      </div>
    </section>}
    <section className="user-count-panel">
      <div className="panel-heading"><div><span className="kicker">TEAM SUMMARY</span><h3>Staff by role</h3></div></div>
      <div className="table-panel"><table className="user-count-table"><thead><tr><th>Role</th><th>Count</th></tr></thead><tbody>
        <tr><td>Managers</td><td>{roleCounts.manager}</td></tr>
        <tr><td>Cashiers</td><td>{roleCounts.cashier}</td></tr>
        <tr><td>Inventory</td><td>{roleCounts.inventory_staff}</td></tr>
      </tbody></table></div>
    </section>
    {showForm && <section className="panel user-create-panel">
      <div className="panel-heading"><div><span className="kicker">NEW ACCOUNT</span><h3>Team member details</h3></div></div>
      <form className="modal-form" onSubmit={submit}>
        <label>Name<input value={form.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" required /></label>
        <label>Email<input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" required /></label>
        <label>Role<select value={form.role} onChange={(event) => update("role", event.target.value)}>
          <option value="manager">MANAGER</option>
          <option value="cashier">CASHIER</option>
          <option value="inventory_staff">INVENTORY_STAFF</option>
        </select></label>
        <button className="primary" type="submit" disabled={busy}>{busy ? "Sending invite..." : "Send invitation"}<span>→</span></button>
      </form>
    </section>}
    <section className="user-staff-section">
      <div className="section-heading"><span className="kicker">DIRECTORY</span><h3>All Staff</h3></div>
      {loading ? <Loading label="Loading staff" /> : users.length ? <div className="table-panel"><table className="staff-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {users.map((user) => <tr key={user._id}><td>{user.name}</td><td>{user.email}</td><td>{user.role === "inventory_staff" ? "Inventory Staff" : user.role[0].toUpperCase() + user.role.slice(1)}</td><td>{user.status === "pending" ? "Pending" : "Active"}</td><td><div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>{user.status === "pending" ? <><button type="button" className="secondary small" onClick={() => resendInvitation(user.email)} disabled={resending === user.email}>{resending === user.email ? "Resending..." : "Resend invite"}</button><button type="button" className="secondary small" onClick={() => getInvitationLink(user.email)}>Get invitation link</button></> : null}<button type="button" className="secondary small danger-text" onClick={() => setRemoveTarget(user)} disabled={removing === user.email}>{removing === user.email ? "Removing..." : "Remove"}</button></div></td></tr>)}
      </tbody></table></div> : <div className="empty"><strong>No staff accounts yet.</strong></div>}
    </section>

    {removeTarget && <FormModal title="Remove User" onClose={() => setRemoveTarget(null)}>
      <div style={{ display: "grid", gap: "16px" }}>
        <p>Are you sure you want to remove {removeTarget.name}?</p>
        <div className="field-group" style={{ display: "grid", gap: "6px" }}>
          <div><strong>Email:</strong> {removeTarget.email}</div>
          <div><strong>Role:</strong> {removeTarget.role === "inventory_staff" ? "Inventory Staff" : removeTarget.role[0].toUpperCase() + removeTarget.role.slice(1)}</div>
        </div>
        <p>This will remove their StockSense access. A notification email will be sent to them.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button type="button" className="secondary-button" onClick={() => setRemoveTarget(null)}>Cancel</button>
          <button type="button" className="primary" onClick={removeUser} disabled={removing === removeTarget.email}>{removing === removeTarget.email ? "Removing..." : "Remove User"}<span>→</span></button>
        </div>
      </div>
    </FormModal>}
  </>;
}