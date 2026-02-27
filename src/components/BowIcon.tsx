type Props = {
  size?: number;
  color?: string;
};

export default function BowIcon({ size = 26 }: Props) {
  return (
    <img
      src="/app-icons/icon-180.png"
      alt="Cream ribbon tied into a bow forming the letter K, with a small silver band in the center."
      width={size}
      height={size}
      style={{ display: "block", borderRadius: 8 }}
      draggable={false}
    />
  );
}
