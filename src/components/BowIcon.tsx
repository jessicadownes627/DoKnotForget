import blueMarkSrc from "../assets/finaliconblue.png";

type Props = {
  size?: number;
};

export default function BowIcon({ size = 32 }: Props) {
  return (
    <img
      src={blueMarkSrc}
      alt="DoKnotForget mark."
      width={size}
      height={size}
      style={{
        display: "block",
        borderRadius: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
        border: "1px solid rgba(10, 27, 42, 0.08)",
      }}
      draggable={false}
    />
  );
}
