import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.js';
import { SignIn } from './screens/SignIn.js';
import { Home } from './screens/Home.js';
import { RouteBuilder } from './screens/RouteBuilder.js';
import { HuntPlayer } from './screens/HuntPlayer.js';
import { Results } from './screens/Results.js';
import { JoinTeam } from './screens/JoinTeam.js';
import { TeamLobby } from './screens/TeamLobby.js';
import { TeamHuntPlayer } from './screens/TeamHuntPlayer.js';
import { TeamResults } from './screens/TeamResults.js';
import { Admin } from './screens/Admin.js';
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
        <Route path="/play/:routeId/resume/:sessionId" element={<HuntPlayer />} />
        <Route path="/results/:routeId" element={<Results />} />
        <Route path="/results/:routeId/:sessionId" element={<Results />} />
        <Route path="/join/:code" element={<JoinTeam />} />
        <Route path="/team/:teamId" element={<TeamLobby />} />
        <Route path="/team/:teamId/play" element={<TeamHuntPlayer />} />
        <Route path="/team/:teamId/results" element={<TeamResults />} />
        <Route path="/admin" element={<Admin />} />
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
