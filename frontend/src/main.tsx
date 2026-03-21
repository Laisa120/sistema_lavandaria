import React from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import { applyThemeMode, readThemeMode } from './lib/theme';
import App from './App';
import { AdminApp } from './admin/AdminApp';

applyThemeMode(readThemeMode());

const hostname = window.location.hostname;
const pathname = window.location.pathname;
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

const appHost = import.meta.env.VITE_APP_HOST || 'app.genomni.com';
const adminHost = import.meta.env.VITE_ADMIN_HOST || 'admin.genomni.com';
const forcedContext = import.meta.env.VITE_FORCE_CONTEXT as 'app' | 'admin' | undefined;

const isAdminHost = hostname === adminHost;
const isAppHost = hostname === appHost;
const isDevAdminRoute = isLocalhost && pathname.startsWith('/admin');

const isAdminContext = forcedContext === 'admin'
  ? true
  : forcedContext === 'app'
    ? false
    : isAdminHost || isDevAdminRoute;

if (!isLocalhost && isAppHost && pathname.startsWith('/admin')) {
  window.history.replaceState({}, '', '/');
}

createRoot(document.getElementById('root')!).render(
  <React.Fragment>
    {isAdminContext ? <AdminApp /> : <App />}
  </React.Fragment>,
);
