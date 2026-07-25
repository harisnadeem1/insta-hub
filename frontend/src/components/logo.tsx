export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary/90 to-primary/50 shadow-sm">
        <div className="h-3 w-3 rounded-sm bg-background/90" />
        <div className="absolute inset-0 rounded-lg ring-1 ring-inset ring-white/10" />
      </div>
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        Insta<span className="text-primary">Nest</span>
      </span>
    </div>
  );
}