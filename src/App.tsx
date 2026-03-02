import Home from "./screens/Home";
import AddPerson from "./screens/AddPerson";
import PersonDetail from "./screens/PersonDetail";
import { Route, Routes } from "./router";
import { AppStateProvider, useAppState } from "./appState";
import Welcome from "./screens/Welcome";

function AppRoutes() {
  const { hasHydrated } = useAppState();
  const hasWelcomed =
    typeof window !== "undefined" &&
    window.localStorage.getItem("doknotforget_hasWelcomed") === "true";

  if (!hasWelcomed) return <Welcome />;
  if (!hasHydrated) return null;

  return (
    <Routes>
      <Route path="/" element={<Home />} />
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
