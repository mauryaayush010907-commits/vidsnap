interface DownloadButtonProps {
  href: string;
  label: string;
  filename: string;
  disabled?: boolean;
}

export default function DownloadButton({ href, label, filename, disabled }: DownloadButtonProps) {
  return (
    <a
      href={href}
      download={filename}
      aria-disabled={disabled}
      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition-all duration-300 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
    >
      {label}
    </a>
  );
}
