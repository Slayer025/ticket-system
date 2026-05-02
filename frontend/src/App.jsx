import { useState, useEffect } from "react";
import api, { API_PATHS } from "./api.jsx";
import Login from "./Login.jsx";
import Register from "./Register.jsx";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [team, setTeam] = useState("IT");
  const [urgency, setUrgency] = useState("LOW");

  const [tickets, setTickets] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [editTicket, setEditTicket] = useState(null);
  const [searchId, setSearchId] = useState("");
  const [loading, setLoading] = useState(true);

  // =======================
  // SESSION LOAD
  // =======================
  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = JSON.parse(localStorage.getItem("user"));

    if (token && savedUser) {
      setUser(savedUser);
      refreshAll();
    } else {
      setLoading(false);
    }
  }, []);

  // =======================
  // LOGOUT
  // =======================
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  // =======================
  // API CALLS
  // =======================
  const fetchTickets = async () => {
    try {
      const res = await api.get(API_PATHS.TICKETS);
      setTickets(res.data || []);
    } catch (err) {
      console.error("Ticket fetch failed:", err);
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await api.get(API_PATHS.DASHBOARD);
      setDashboard(res.data || {});
    } catch (err) {
      console.error("Dashboard fetch failed:", err);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([fetchTickets(), fetchDashboard()]);
    setLoading(false);
  };

  // =======================
  // CREATE TICKET
  // =======================
  const createTicket = async () => {
    if (!title || !description) {
      alert("Fill all fields");
      return;
    }

    await api.post(API_PATHS.TICKETS, {
      title,
      description,
      team,
      urgency,
    });

    setTitle("");
    setDescription("");
    refreshAll();
  };

  // =======================
  // UPDATE TICKET
  // =======================
  const updateTicket = async () => {
    if (!editTicket) return;

    try {
      await api.put(`${API_PATHS.TICKETS}/${editTicket.ticket_id}`, {
        status: editTicket.status,
        priority: editTicket.priority,
        owner: editTicket.owner,
      });

      setEditTicket(null);
      refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || "Update failed");
    }
  };

  // =======================
  // DELETE TICKET
  // =======================
  const deleteTicket = async (id) => {
    if (!window.confirm("Delete ticket?")) return;
    await api.delete(`${API_PATHS.TICKETS}/${id}`);
    refreshAll();
  };

  const filteredTickets = tickets.filter((t) =>
    t.ticket_id?.toLowerCase().includes(searchId.toLowerCase())
  );

  // =======================
  // AUTH SCREEN
  // =======================
  if (!user) {
    return (
      <div className="container">
        <h1>🎫 Ticket System</h1>

        {showRegister ? (
          <>
            <Register
              setUser={(u) => {
                setUser(u);
                localStorage.setItem("user", JSON.stringify(u));
                refreshAll(); // immediately refresh after registration/login
              }}
            />
            <p onClick={() => setShowRegister(false)}>Go to Login</p>
          </>
        ) : (
          <>
            <Login
              setUser={(u) => {
                setUser(u);
                localStorage.setItem("user", JSON.stringify(u));
                refreshAll(); // immediately refresh after login
              }}
            />
            <p onClick={() => setShowRegister(true)}>Create account</p>
          </>
        )}
      </div>
    );
  }

  // =======================
  // MAIN UI
  // =======================
  return (
    <div className="container">
      <h1>🎫 Ticket System</h1>

      <button className="logout" onClick={logout}>
        Logout
      </button>

      {/* DASHBOARD */}
      <div className="dashboard">
        <div className="card">
          Open <h2>{dashboard.open || 0}</h2>
        </div>
        <div className="card warning">
          At Risk <h2>{dashboard.at_risk || 0}</h2>
        </div>
        <div className="card danger">
          Breached <h2>{dashboard.breached || 0}</h2>
        </div>
      </div>

      {/* SEARCH */}
      <input
        className="search"
        placeholder="Search Ticket ID..."
        value={searchId}
        onChange={(e) => setSearchId(e.target.value)}
      />

      {/* CREATE */}
      <div className="form">
        <h2>Create Ticket</h2>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
        />

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

      {/* TABLE */}
      {loading ? (
        <p>Loading tickets...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Description</th>
              <th>Team</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Owner</th>
              {user.role !== "USER" && <th>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={user.role !== "USER" ? 8 : 7}>No tickets found</td>
              </tr>
            ) : (
              filteredTickets.map((t) => (
                <tr key={t.ticket_id}>
                  <td>{t.ticket_id}</td>
                  <td>{t.title}</td>
                  <td>{t.description}</td>
                  <td>{t.team}</td>
                  <td>{t.priority}</td>
                  <td>{t.status}</td>
                  <td>{t.owner || "-"}</td>
                  {user.role !== "USER" && (
                    <td>
                      <button onClick={() => setEditTicket(t)}>Edit</button>
                      <button onClick={() => deleteTicket(t.ticket_id)}>
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* MODAL */}
      {editTicket && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Edit Ticket</h2>

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

            <label>Priority</label>
            <select
              value={editTicket.priority}
              onChange={(e) =>
                setEditTicket({ ...editTicket, priority: e.target.value })
              }
            >
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
            </select>

            <label>Owner</label>
            <input
              value={editTicket.owner || ""}
              onChange={(e) =>
                setEditTicket({ ...editTicket, owner: e.target.value })
              }
              placeholder="Assign owner"
            />

            <div className="modal-actions">
              <button onClick={updateTicket}>Save</button>
              <button onClick={() => setEditTicket(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;