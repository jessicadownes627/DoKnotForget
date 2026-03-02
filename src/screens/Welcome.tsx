import welcomeBg from "../assets/welcome.png";
import { useNavigate } from "../router";

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="dkf-welcome-screen" style={{ background: "#0A1A3A", color: "#F8F7F2" }}>
      <img className="dkf-welcome-bg" src={welcomeBg} alt="" aria-hidden="true" />

      <div className="dkf-welcome-overlay">
        <button
          type="button"
          className="dkf-welcome-button"
          onClick={() => {
            try {
              window.localStorage.setItem("doknotforget_hasWelcomed", "true");
            } catch {
              // ignore
            }
            navigate("/home");
          }}
        >
          Welcome
        </button>
      </div>
    </div>
  );
}
