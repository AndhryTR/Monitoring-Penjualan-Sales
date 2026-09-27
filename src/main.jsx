import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Menghilangkan splash screen instan setelah aplikasi siap
requestAnimationFrame(() => {
  setTimeout(() => {
    const splash = document.getElementById('app-splash');
    if (splash) {
      splash.classList.add('splash-hide');
      setTimeout(() => splash.remove(), 450);
    }
  }, 600);
});
