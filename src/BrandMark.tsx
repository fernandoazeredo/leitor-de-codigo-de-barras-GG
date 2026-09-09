export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark${compact ? ' compact' : ''}`} aria-label="Código de barras GG">
      <svg className="brand-barcode" viewBox="0 0 64 44" role="img" aria-hidden="true">
        <rect x="4" y="6" width="3" height="32" rx="1" />
        <rect x="10" y="6" width="2" height="32" rx="1" />
        <rect x="15" y="6" width="5" height="32" rx="1" />
        <rect x="23" y="6" width="2" height="32" rx="1" />
        <rect x="29" y="6" width="4" height="32" rx="1" />
        <rect x="36" y="6" width="2" height="32" rx="1" />
        <rect x="41" y="6" width="6" height="32" rx="1" />
        <rect x="50" y="6" width="2" height="32" rx="1" />
        <rect x="56" y="6" width="4" height="32" rx="1" />
      </svg>
      <span className="brand-gg">GG</span>
    </div>
  );
}

export function GoogleGIcon() {
  return (
    <svg className="google-g" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 11.1h-9.18v3.71h5.29c-.24 1.19-.92 2.2-1.94 2.88v2.39h3.14c1.83-1.68 2.89-4.16 2.89-7.08 0-.66-.06-1.29-.2-1.9Z" />
      <path fill="#34A853" d="M12.17 21.5c2.61 0 4.8-.86 6.49-2.42l-3.14-2.39c-.87.59-1.98.94-3.35.94-2.52 0-4.66-1.7-5.42-3.99H3.51v2.47a9.8 9.8 0 0 0 8.66 5.39Z" />
      <path fill="#FBBC05" d="M6.75 13.64A5.9 5.9 0 0 1 6.44 12c0-.57.11-1.12.31-1.64V7.89H3.51A9.83 9.83 0 0 0 2.5 12c0 1.58.38 3.08 1.01 4.11l3.24-2.47Z" />
      <path fill="#EA4335" d="M12.17 6.37c1.42 0 2.69.49 3.69 1.45l2.77-2.77C16.95 3.49 14.78 2.5 12.17 2.5a9.8 9.8 0 0 0-8.66 5.39l3.24 2.47c.76-2.29 2.9-3.99 5.42-3.99Z" />
    </svg>
  );
}
