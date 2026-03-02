import Onboarding from "./screens/Onboarding";
import Home from "./screens/Home";
import AddPerson from "./screens/AddPerson";
import PersonDetail from "./screens/PersonDetail";
import { Route, Routes } from "./router";
import { AppStateProvider, useAppState } from "./appState";

function AppRoutes() {
  const { hasHydrated } = useAppState();
  if (!hasHydrated) return null;

  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/home" element={<Home />} />
      <Route path="/add" element={<AddPerson />} />
      <Route path="/person/:id" element={<PersonDetail />} />
    </Routes>
  );
}

function App() {
  return (
    <AppStateProvider>
      <AppRoutes />
    </AppStateProvider>
  );
}

export default App;
