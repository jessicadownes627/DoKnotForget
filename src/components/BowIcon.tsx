import ivoryMarkSrc from "../assets/ivory.png";

type Props = {
  size?: number;
  color?: string;
};

export default function BowIcon({ size = 26 }: Props) {
  return (
    <img
      src={ivoryMarkSrc}
      alt="DoKnotForget mark."
      width={size}
      height={size}
      style={{ display: "block", borderRadius: 10 }}
      draggable={false}
    />
  );
}
