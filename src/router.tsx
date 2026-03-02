import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Params = Record<string, string>;

type RouterContextValue = {
  pathname: string;
  navigate: (to: string, opts?: { state?: any; replace?: boolean }) => void;
};

const RouterContext = createContext<RouterContextValue | null>(null);
const ParamsContext = createContext<Params>({});

export function RouterProvider({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState(() => window.location.pathname || "/");
  const [navTick, setNavTick] = useState(0);

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname || "/");
      setNavTick((t) => t + 1);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (to: string, opts?: { state?: any; replace?: boolean }) => {
    const next = to.startsWith("/") ? to : `/${to}`;
    const state = { state: opts?.state ?? null };
    if (opts?.replace) window.history.replaceState(state, "", next);
    else window.history.pushState(state, "", next);
    setPathname(next);
    setNavTick((t) => t + 1);
  };

  const value = useMemo(() => ({ pathname, navigate }), [pathname, navTick]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useNavigate() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useNavigate must be used within RouterProvider");
  return ctx.navigate;
}

export function useLocation() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useLocation must be used within RouterProvider");
  return { pathname: ctx.pathname, state: (window.history.state as any)?.state ?? null };
}

export function useParams<T extends Params = Params>() {
  return useContext(ParamsContext) as T;
}

function stripSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function matchPath(pattern: string, pathname: string): { params: Params } | null {
  const pat = stripSlashes(pattern);
  const path = stripSlashes(pathname);

  if (!pat && !path) return { params: {} };

  const patParts = pat ? pat.split("/") : [];
  const pathParts = path ? path.split("/") : [];

  if (patParts.length !== pathParts.length) return null;

  const params: Params = {};
  for (let i = 0; i < patParts.length; i++) {
    const pp = patParts[i] ?? "";
    const pv = pathParts[i] ?? "";
    if (pp.startsWith(":")) {
      const key = pp.slice(1);
      params[key] = decodeURIComponent(pv);
      continue;
    }
    if (pp !== pv) return null;
  }

  return { params };
}

export function Routes({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  const routes = useMemo(() => {
    const elems = (Array.isArray(children) ? children : [children]).filter(Boolean) as ReactNode[];
    const flattened: ReactElement<RouteProps>[] = [];
    for (const node of elems) {
      if (!node) continue;
      if (Array.isArray(node)) continue;
      if (typeof node === "object" && "type" in (node as any)) {
        flattened.push(node as ReactElement<RouteProps>);
      }
    }
    return flattened;
  }, [children]);

  for (const routeEl of routes) {
    const props = routeEl.props as RouteProps;
    const match = matchPath(props.path, pathname);
    if (!match) continue;
    return (
      <ParamsContext.Provider value={match.params}>
        {props.element}
      </ParamsContext.Provider>
    );
  }

  return null;
}

type RouteProps = {
  path: string;
  element: ReactElement;
};

export function Route(_props: RouteProps) {
  return null;
}
