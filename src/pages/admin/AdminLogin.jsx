
import { Link } from 'react-router-dom'

function AdminLogin() {
  return (
    <main style={{ padding: '60px 8%', minHeight: '100vh' }}>
      <h1>Admin Login</h1>

      <p>
        Access the GDG KAU Quiz administration dashboard.
      </p>

      <Link to="/">← Back to home</Link>
    </main>
  )
}

export default AdminLogin
