export default function GoldenStarDivider() {
  return (
    <div className="dkf-golden-sun-divider" aria-hidden="true">
      <div className="dkf-golden-sun-divider-line" />

      <div key="dkf-star">
        <div className="golden-sun-anim">
          <div className="dkf-golden-star-divider-star">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              style={{ display: "block" }}
            >
              <defs>
                <linearGradient id="dkfStarGold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F7D58A" />
                  <stop offset="48%" stopColor="#EAC06B" />
                  <stop offset="100%" stopColor="#B48A3C" />
                </linearGradient>
                <radialGradient id="dkfStarHighlight" cx="30%" cy="28%" r="65%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
                  <stop offset="58%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              </defs>
              <path
                d="M12 2.6l2.73 5.55 6.12.89-4.42 4.31 1.04 6.1L12 16.92 6.53 19.45l1.04-6.1L3.15 9.04l6.12-.89L12 2.6z"
                fill="url(#dkfStarGold)"
              />
              <path
                d="M12 2.6l2.73 5.55 6.12.89-4.42 4.31 1.04 6.1L12 16.92 6.53 19.45l1.04-6.1L3.15 9.04l6.12-.89L12 2.6z"
                fill="url(#dkfStarHighlight)"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

