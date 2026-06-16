import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.js';
import { SignIn } from './screens/SignIn.js';
import { Home } from './screens/Home.js';
import { RouteBuilder } from './screens/RouteBuilder.js';
import { HuntPlayer } from './screens/HuntPlayer.js';
import { Results } from './screens/Results.js';
import { AppBar } from './ui/index.js';

/** Routes are gated by sign-in. The URL is preserved, so shared /play links
 *  resolve right after the visitor signs in. */
function AppRoutes() {
  const { user } = useAuth();
  if (!user) return <SignIn />;

  return (
    <>
      <AppBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/build/:routeId" element={<RouteBuilder />} />
        <Route path="/play/:routeId" element={<HuntPlayer />} />
        <Route path="/results/:routeId" element={<Results />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
