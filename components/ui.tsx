import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

export function Container({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`site-container mx-auto w-full px-5 sm:px-8 lg:px-10 ${className}`} {...props} />;
}

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "default" }) {
  const variantClass = variant === "secondary"
    ? "bg-[rgb(var(--site-button-secondary))]"
    : variant === "default"
      ? "border border-ink/20 bg-[rgb(var(--site-button-default))] text-ink"
      : "bg-[rgb(var(--site-button-primary))] text-white";
  return (
    <button
      className={`site-button focus-ring inline-flex items-center justify-center rounded-[var(--site-radius-control)] px-5 py-3 text-sm font-semibold shadow-[var(--site-shadow-card)] transition ${variantClass} ${className}`}
      {...props}
    />
  );
}

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`site-card rounded-[var(--site-radius-card)] border border-ink/10 bg-surface shadow-[var(--site-shadow-card)] ${className}`} {...props} />;
}

export function Notification({
  variant = "default",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: "primary" | "secondary" | "default" | "success" | "warning" | "danger" | "info";
}) {
  return <div className={`site-notification-${variant} rounded-lg border border-ink/10 px-4 py-3 text-sm ${className}`} {...props} />;
}
