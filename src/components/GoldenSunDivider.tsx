type GoldenSunDividerProps = {
  variant?: "default" | "horizon";
};

export default function GoldenSunDivider({ variant = "default" }: GoldenSunDividerProps) {
  const className =
    variant === "horizon" ? "dkf-golden-sun-divider dkf-golden-sun-divider--horizon" : "dkf-golden-sun-divider";

  return (
    <div className={className} aria-hidden="true">
      <div className="dkf-golden-sun-divider-line" />

      <div className="dkf-golden-sun-divider-rays">
        {[-24, -16, -8, 0, 8, 16, 24].map((deg) => (
          <span
            key={deg}
            className="dkf-golden-sun-divider-ray"
            style={{ transform: `translateX(-50%) rotate(${deg}deg)` }}
          />
        ))}
      </div>

      <div key="dkf-sun">
        <div className="golden-sun-anim">
          <div className="dkf-golden-sun-divider-sun">
            <div className="dkf-golden-sun-divider-sun-inner" />
          </div>
        </div>
      </div>
    </div>
  );
}
