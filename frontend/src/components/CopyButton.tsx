import { Copy, Check } from "lucide-react";
import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(text);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1500);
  };

  return (
    <button
      onClick={copyToClipboard}
      aria-label="Copy to clipboard"
      title="Copy to clipboard"
      style={{
        marginLeft: "8px",
        verticalAlign: "middle",
        cursor: "pointer",
        color: "#4b554b93",
        background: "transparent",
        border: "none",
        padding: 0,
      }}
    >
      {copied ? <Check size={24} /> : <Copy size={24} />}
    </button>
  );
}
