import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './lib/theme';
import App from './App.jsx';
import ErrorBoundary from './components/common/ErrorBoundary';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary resetKey={window.location.pathname}>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
