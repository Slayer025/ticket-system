import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

const API_URL = "https://oned7urh22.execute-api.ap-south-1.amazonaws.com/Prod/";

function App() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requester, setRequester] = useState("");
  const [team, setTeam] = useState("IT");
  const [urgency, setUrgency] = useState("LOW");

  const [tickets, setTickets] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [editTicket, setEditTicket] = useState(null);
  const [searchId, setSearchId] = useState("");

  const api = axios.create({ baseURL: API_URL });

  const fetchTickets = async () => {
    const res = await api.get("/tickets");
    setTickets(res.data || []);
  };

  const fetchDashboard = async () => {
    const res = await api.get("/dashboard");
    setDashboard(res.data || {});
  };

  const refreshAll = async () => {
    await Promise.all([fetchTickets(), fetchDashboard()]);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const createTicket = async () => {
    if (!title || !description || !requester) {
      alert("Fill all fields");
      return;
    }

    await api.post("/tickets", {
      title,
      description,
      requester,
      team,
      urgency,
    });

    setTitle("");
    setDescription("");
    setRequester("");
    refreshAll();
  };

  // =========================
  // UPDATE (NOW INCLUDES PRIORITY)
  // =========================
  const updateTicket = async () => {
    await api.put(`/tickets/${editTicket.ticket_id}`, {
      status: editTicket.status,
      owner: editTicket.owner,
      priority: editTicket.priority,   // ✅ ADDED
    });

    setEditTicket(null);
    refreshAll();
  };

  const deleteTicket = async (id) => {
    if (!window.confirm("Delete ticket?")) return;
    await api.delete(`/tickets/${id}`);
    refreshAll();
  };

  const filteredTickets = tickets.filter((t) =>
    t.ticket_id.toLowerCase().includes(searchId.toLowerCase())
  );

  const badge = (v) => `badge ${v?.toLowerCase()}`;

  return (
    <div className="container">
      <h1>🎫 Ticket System</h1>

      <div className="dashboard">
        <div className="card">Open <h2>{dashboard.open || 0}</h2></div>
        <div className="card warning">At Risk <h2>{dashboard.at_risk || 0}</h2></div>
        <div className="card danger">Breached <h2>{dashboard.breached || 0}</h2></div>
      </div>

      <input
        className="search"
        placeholder="Search by Ticket ID..."
        value={searchId}
        onChange={(e) => setSearchId(e.target.value)}
      />

      {/* CREATE */}
      <div className="form">
        <h2>Create Ticket</h2>

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
        <input value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="Requester" />

        <select value={team} onChange={(e) => setTeam(e.target.value)}>
          <option>IT</option>
          <option>HR</option>
          <option>FINANCE</option>
        </select>

        <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
          <option>LOW</option>
          <option>MEDIUM</option>
          <option>HIGH</option>
        </select>

        <button onClick={createTicket}>Create Ticket</button>
      </div>

      {/* EDIT MODAL */}
      {editTicket && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit Ticket</h3>

            <p><strong>ID:</strong> {editTicket.ticket_id}</p>

            {/* STATUS */}
            <label>Status</label>
            <select
              value={editTicket.status}
              onChange={(e) =>
                setEditTicket({ ...editTicket, status: e.target.value })
              }
            >
              <option>NEW</option>
              <option>TRIAGED</option>
              <option>IN_PROGRESS</option>
              <option>RESOLVED</option>
            </select>

            {/* OWNER */}
            <label>Owner</label>
            <input
              value={editTicket.owner}
              onChange={(e) =>
                setEditTicket({ ...editTicket, owner: e.target.value })
              }
            />

            {/* PRIORITY ✅ NEW */}
            <label>Priority</label>
            <select
              value={editTicket.priority}
              onChange={(e) =>
                setEditTicket({ ...editTicket, priority: e.target.value })
              }
            >
              <option>P1</option>
              <option>P2</option>
              <option>P3</option>
            </select>

            <div className="modal-actions">
              <button onClick={updateTicket}>Save Changes</button>
              <button className="btn-delete" onClick={() => setEditTicket(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>SLA</th>
              <th>Owner</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredTickets.map((t) => (
              <tr key={t.ticket_id}>
                <td><code>{t.ticket_id.slice(0, 6)}</code></td>
                <td>{t.title}</td>
                <td><span className={badge(t.status)}>{t.status}</span></td>
                <td>{t.priority}</td>
                <td>{t.sla_state}</td>
                <td>{t.owner}</td>
                <td>{new Date(t.created_at).toLocaleDateString()}</td>

                <td>
                  <button onClick={() => setEditTicket(t)}>Edit</button>
                  <button className="btn-delete" onClick={() => deleteTicket(t.ticket_id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>
    </div>
  );
}

export default App;