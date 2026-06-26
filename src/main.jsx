import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import TestDashboard from './pages/TestDashboard.jsx'
import './index.css'

if (window.location.search.includes('test=1')) {
  ReactDOM.createRoot(document.getElementById('root')).render(<TestDashboard />);
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
