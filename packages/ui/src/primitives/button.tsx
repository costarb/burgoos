import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={[
        "inline-flex items-center justify-center rounded-md bg-tomato px-4 py-2 text-sm font-semibold text-white",
        "transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60",
        className
      ].join(" ")}
      type={type}
      {...props}
    />
  );
}
