import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type HeroTitleProps = {
  children: ReactNode;
};

export function OnboardingEyebrow({ children }: { children: ReactNode }) {
  return <div className="dkf-onboard-eyebrow">{children}</div>;
}

export function OnboardingHeroTitle({ children }: HeroTitleProps) {
  return <h1 className="dkf-onboard-hero-title">{children}</h1>;
}

export function OnboardingHeroInvite({ children }: { children: ReactNode }) {
  return <div className="dkf-onboard-hero-invite">{children}</div>;
}

export function OnboardingBody({ children }: { children: ReactNode }) {
  return <div className="dkf-onboard-body">{children}</div>;
}

type PremiumInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  icon?: ReactNode;
  shellClassName?: string;
};

export function PremiumInput({ icon, shellClassName, className, ...props }: PremiumInputProps) {
  const shell = shellClassName ? `dkf-premium-input ${shellClassName}` : "dkf-premium-input";
  const inputClass = className ? `dkf-premium-input-field ${className}` : "dkf-premium-input-field";

  return (
    <label className={shell}>
      {icon ? <span className="dkf-premium-input-icon">{icon}</span> : null}
      <input {...props} className={inputClass} />
    </label>
  );
}

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  quietDisabled?: boolean;
};

export function PrimaryButton({
  children,
  className,
  quietDisabled = false,
  disabled,
  ...props
}: PrimaryButtonProps) {
  const classes = [
    "dkf-primary-button",
    disabled ? "is-disabled" : "is-active",
    quietDisabled ? "is-quiet-disabled" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...props} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
