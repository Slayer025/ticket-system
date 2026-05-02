// src/Register.jsx
import { useState } from "react";
import api, { API_PATHS } from "./api.jsx";

function Register({ setUser }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("USER");
  const [adminSecret, setAdminSecret] = useState("");

  const register = async () => {
    try {
      const res = await api.post(API_PATHS.REGISTER, {
        email,
        password,
        name,
        role,
        admin_secret: adminSecret,
      });
      localStorage.setItem("token", res.data.token);
      setUser(res.data.user);
    } catch (err) {
      alert(err.response?.data?.error || "Registration failed");
    }
  };

  return (
    <div className="auth-box">
      <h2>Register</h2>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="USER">USER</option>
        <option value="AGENT">AGENT</option>
        <option value="ADMIN">ADMIN</option>
      </select>
      {role === "ADMIN" && (
        <input placeholder="Admin Secret" value={adminSecret} onChange={(e) => setAdminSecret(e.target.value)} />
      )}
      <button onClick={register}>Register</button>
    </div>
  );
}

export default Register;