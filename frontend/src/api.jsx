// src/api.jsx
import axios from "axios";

// Make sure this matches your deployed API
const API_URL = "https://6z6t4ghhn6.execute-api.ap-south-1.amazonaws.com/Prod/";

export const API_PATHS = {
  REGISTER: "/auth/register",
  LOGIN: "/auth/login",
  TICKETS: "/tickets",
  DASHBOARD: "/dashboard",
};

const api = axios.create({
  baseURL: API_URL,
});

// 🔥 Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;