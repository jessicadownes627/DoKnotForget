type BaseProps = {
  className?: string;
};

export function RaisedGoldBullet({ className }: BaseProps) {
  return <span className={`dkf-raised-gold-bullet${className ? ` ${className}` : ""}`} aria-hidden="true" />;
}

export function SoftGoldDot({ className }: BaseProps) {
  return <span className={`dkf-soft-gold-dot${className ? ` ${className}` : ""}`} aria-hidden="true" />;
}

