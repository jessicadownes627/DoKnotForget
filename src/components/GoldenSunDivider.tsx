export default function GoldenSunDivider() {
  return (
    <div className="dkf-golden-sun-divider" aria-hidden="true">
      <div className="dkf-golden-sun-divider-line" />

      <div className="dkf-golden-sun-divider-rays">
        {[-18, -9, 0, 9, 18].map((deg) => (
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
