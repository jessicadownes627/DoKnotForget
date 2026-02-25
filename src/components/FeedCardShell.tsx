import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function FeedCardShell({ children }: Props) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "16px",
      }}
    >
      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "24px 22px" }}>{children}</div>
    </div>
  );
}
