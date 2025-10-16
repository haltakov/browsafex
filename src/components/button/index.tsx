import clsx from "clsx";

export interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
  style?: "normal" | "outline";
  color?: "primary" | "neutral";
  className?: string;
}

export default function Button({
  children,
  onClick,
  disabled,
  size = "medium",
  style = "normal",
  color = "primary",
  className,
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "rounded-3xl cursor-pointer font-bold",
        size === "small" && "px-4 py-2 text-sm",
        size === "medium" && "px-8 py-2 text-base",
        size === "large" && "px-16 py-2 text-lg",
        style === "normal" && color === "primary" && "bg-linear-to-br from-cyan-300 to-sky-400 text-white",
        style === "normal" && color === "neutral" && "bg-gray-500 text-white",
        style === "outline" && color === "primary" && "bg-transparent text-cyan-300 border border-cyan-300",
        style === "outline" && color === "neutral" && "bg-transparent text-gray-300 border border-gray-400",
        style === "normal" && color === "primary" && "hover:from-cyan-400 hover:to-sky-500",
        style === "normal" && color === "neutral" && "hover:bg-gray-600 hover:text-white",
        style === "outline" && "hover:bg-cyan-400 hover:text-white",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  );
}
