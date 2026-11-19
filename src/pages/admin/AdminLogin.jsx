
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/client";

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("gdgAdminToken", result.token);
      navigate("/admin");
    } catch (requestError) {
      setError(requestError.status === 401 ? "Invalid email or password." : "Backend is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "60px 8%", minHeight: "100vh" }}>
      <h1>Admin Login</h1>
      <p>Access the GDG KAU Quiz administration dashboard.</p>
      <form onSubmit={handleSubmit} style={{ maxWidth: 420, display: "grid", gap: 12 }}>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      </form>
      <Link to="/">← Back to home</Link>
    </main>
  )
}

export default AdminLogin
