function Dots() {
  return (
    <div
      className="absolute inset-0 opacity-[0.12]"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
      aria-hidden
    />
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-navy-gradient">
      <Dots />
      {children}
    </div>
  );
}

export function DomesticIllustration() {
  return (
    <Frame>
      <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="dom-truck" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f7941d" />
            <stop offset="100%" stopColor="#ed1c24" />
          </linearGradient>
        </defs>
        <path d="M0 230 H400" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="2" />
        <path
          d="M20 230 H150 M190 230 H320 M360 230 H400"
          stroke="#ffffff"
          strokeOpacity="0.35"
          strokeWidth="3"
          strokeDasharray="10 10"
        />
        <circle cx="60" cy="230" r="6" fill="#f7941d" />
        <circle cx="60" cy="230" r="11" fill="none" stroke="#f7941d" strokeOpacity="0.4" />
        <circle cx="340" cy="230" r="6" fill="#f7941d" />
        <circle cx="340" cy="230" r="11" fill="none" stroke="#f7941d" strokeOpacity="0.4" />

        <g transform="translate(150,150)">
          <path
            d="M0 60 V25 a4 4 0 0 1 4-4 H70 V60 Z"
            fill="url(#dom-truck)"
          />
          <path
            d="M70 30 H100 L118 50 V60 H70 Z"
            fill="#ffffff"
            fillOpacity="0.92"
          />
          <path d="M78 36 H100 L110 48 H78 Z" fill="#0c1c31" fillOpacity="0.75" />
          <circle cx="22" cy="64" r="10" fill="#0c1c31" />
          <circle cx="22" cy="64" r="4" fill="#ffffff" />
          <circle cx="98" cy="64" r="10" fill="#0c1c31" />
          <circle cx="98" cy="64" r="4" fill="#ffffff" />
          <path d="M-18 40 H-2 M-26 48 H-2" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />
        </g>
      </svg>
    </Frame>
  );
}

export function InternationalIllustration() {
  return (
    <Frame>
      <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="intl-plane" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f7941d" />
            <stop offset="100%" stopColor="#ed1c24" />
          </linearGradient>
        </defs>
        <circle cx="200" cy="165" r="85" fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1.5" />
        <ellipse cx="200" cy="165" rx="85" ry="32" fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.5" />
        <ellipse cx="200" cy="165" rx="40" ry="85" fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.5" />
        <path d="M115 165 H285 M200 80 V250" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="1.5" />

        <circle cx="150" cy="140" r="3" fill="#ffffff" fillOpacity="0.7" />
        <circle cx="250" cy="190" r="3" fill="#ffffff" fillOpacity="0.7" />

        <path
          d="M95 205 Q200 90 305 130"
          fill="none"
          stroke="#f7941d"
          strokeWidth="2.5"
          strokeDasharray="7 7"
          strokeOpacity="0.85"
        />
        <g transform="translate(295,120) rotate(25)">
          <path
            d="M0 0 L26 6 L14 10 L18 20 L11 18 L6 10 L-4 12 Z"
            fill="url(#intl-plane)"
          />
        </g>
        <circle cx="95" cy="205" r="5" fill="#ffffff" />
        <circle cx="95" cy="205" r="10" fill="none" stroke="#ffffff" strokeOpacity="0.35" />
      </svg>
    </Frame>
  );
}

export function CargoIllustration() {
  return (
    <Frame>
      <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="cargo-box" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f7941d" />
            <stop offset="100%" stopColor="#ed1c24" />
          </linearGradient>
        </defs>
        <path
          d="M40 220 Q90 205 140 220 T240 220 T340 220"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.2"
          strokeWidth="2"
        />
        <path
          d="M40 236 Q90 221 140 236 T240 236 T340 236"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.12"
          strokeWidth="2"
        />

        <g transform="translate(120,110)">
          <rect x="0" y="40" width="52" height="52" rx="3" fill="url(#cargo-box)" />
          <rect x="8" y="48" width="36" height="6" fill="#0c1c31" fillOpacity="0.25" />
          <rect x="8" y="60" width="36" height="6" fill="#0c1c31" fillOpacity="0.25" />
          <rect x="56" y="20" width="52" height="72" rx="3" fill="#ffffff" fillOpacity="0.92" />
          <rect x="64" y="30" width="36" height="6" fill="#0c1c31" fillOpacity="0.15" />
          <rect x="64" y="42" width="36" height="6" fill="#0c1c31" fillOpacity="0.15" />
          <rect x="64" y="54" width="36" height="6" fill="#0c1c31" fillOpacity="0.15" />
          <rect x="112" y="55" width="52" height="37" rx="3" fill="url(#cargo-box)" />
          <rect x="120" y="63" width="36" height="6" fill="#0c1c31" fillOpacity="0.25" />
        </g>

        <path d="M60 250 H340" stroke="#f7941d" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="3 8" />
      </svg>
    </Frame>
  );
}

export function WarehouseIllustration() {
  return (
    <Frame>
      <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="wh-accent" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f7941d" />
            <stop offset="100%" stopColor="#ed1c24" />
          </linearGradient>
        </defs>
        <path d="M50 230 H350" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="2" />

        <path d="M80 230 V150 L200 100 L320 150 V230 Z" fill="#ffffff" fillOpacity="0.08" />
        <path d="M80 150 L200 100 L320 150" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="3" />
        <rect x="95" y="160" width="210" height="70" rx="2" fill="#ffffff" fillOpacity="0.06" stroke="#ffffff" strokeOpacity="0.3" />

        <rect x="115" y="180" width="45" height="50" fill="url(#wh-accent)" rx="2" />
        <rect x="122" y="188" width="31" height="6" fill="#0c1c31" fillOpacity="0.25" />
        <rect x="122" y="200" width="31" height="6" fill="#0c1c31" fillOpacity="0.25" />

        <rect x="240" y="170" width="80" height="60" fill="#ffffff" fillOpacity="0.9" rx="2" />
        <rect x="250" y="180" width="26" height="18" fill="#0c1c31" fillOpacity="0.15" />
        <rect x="284" y="180" width="26" height="18" fill="#0c1c31" fillOpacity="0.15" />
        <rect x="250" y="204" width="26" height="18" fill="#0c1c31" fillOpacity="0.15" />
        <rect x="284" y="204" width="26" height="18" fill="#0c1c31" fillOpacity="0.15" />

        <circle cx="200" cy="122" r="4" fill="#f7941d" />
      </svg>
    </Frame>
  );
}
