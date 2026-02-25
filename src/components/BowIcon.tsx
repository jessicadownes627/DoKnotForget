type Props = {
  size?: number;
  color?: string;
  stripeColor?: string;
};

export default function BowIcon({ size = 26, color = "currentColor", stripeColor = "var(--ink)" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d="M32 32C26 22 12 22 12 32C12 42 26 42 32 32C38 22 52 22 52 32C52 42 38 42 32 32C35 40 42 46 50 52"
        stroke={color}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 26C17.5 26 16 29 16 32C16 35 17.5 38 22 38"
        stroke={stripeColor}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M42 26C46.5 26 48 29 48 32C48 35 46.5 38 42 38"
        stroke={stripeColor}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

