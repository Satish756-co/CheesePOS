/**
 * BrandLogo — icon + "CheesePOS" text, matches the brand style.
 * theme="dark"  → white/slate text (for dark sidebars, auth bg)
 * theme="light" → navy/slate text  (for white/light backgrounds)
 * size="sm" | "md" | "lg" | "xl"
 * showSubtitle → show "ONLINE POS APP" line
 */
const sizes = {
  sm: { icon: 28, name: 'text-xl',  sub: 'text-[9px]'  },
  md: { icon: 38, name: 'text-2xl', sub: 'text-[10px]' },
  lg: { icon: 52, name: 'text-3xl', sub: 'text-xs'     },
  xl: { icon: 72, name: 'text-4xl', sub: 'text-sm'     },
}

export default function BrandLogo({ theme = 'dark', size = 'md', showSubtitle = true, businessName }) {
  const s = sizes[size] || sizes.md
  const nameColor = theme === 'dark' ? 'text-white'     : 'text-[#1a2e4a]'
  const subColor  = theme === 'dark' ? 'text-slate-400' : 'text-slate-500'

  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/logo-icon.png"
        alt="CheesePOS"
        style={{ height: s.icon, width: 'auto' }}
        className="flex-shrink-0"
      />
      <div className="flex flex-col leading-none">
        <span className={`font-black tracking-tight ${s.name}`}>
          <span className={nameColor}>Cheese</span>
          <span className="text-orange-500">POS</span>
        </span>
        {showSubtitle && (
          <span className={`font-medium tracking-widest uppercase mt-0.5 ${s.sub} ${subColor}`}>
            — Online POS App —
          </span>
        )}
        {businessName && (
          <span className={`text-[10px] mt-0.5 truncate max-w-[140px] ${subColor}`}>
            {businessName}
          </span>
        )}
      </div>
    </div>
  )
}
