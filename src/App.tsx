import Home from "./screens/Home";
import AddPerson from "./screens/AddPerson";
import PersonDetail from "./screens/PersonDetail";
import ImportContacts from "./screens/ImportContacts";
import { Route, Routes } from "./router";
import { AppStateProvider, useAppState } from "./appState";

function AppRoutes() {
  const { hasHydrated } = useAppState();

  if (!hasHydrated) return null;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/home" element={<Home />} />
      <Route path="/add" element={<AddPerson />} />
      <Route path="/import" element={<ImportContacts />} />
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
