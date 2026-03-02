import ribbonSrc from "../assets/ribbon-k.svg";

type Props = {
  size?: number;
  color?: string;
};

export default function BowIcon({ size = 26 }: Props) {
  return (
    <img
      src={ribbonSrc}
      alt="Cream ribbon tied into a bow forming the letter K, with a small silver band in the center."
      width={size}
      height={size}
      style={{ display: "block", borderRadius: 8 }}
      draggable={false}
    />
  );
}
