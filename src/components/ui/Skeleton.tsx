interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const baseClasses =
    "animate-[shimmer-bg_2s_infinite_linear] bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%]";

  const variantClasses = {
    text: "rounded h-4",
    circular: "rounded-full",
    rectangular: "rounded-xl",
  };

  const style = {
    width: width
      ? typeof width === "number"
        ? `${width}px`
        : width
      : undefined,
    height: height
      ? typeof height === "number"
        ? `${height}px`
        : height
      : undefined,
  };

  if (lines > 1) {
    return (
      <div className={`space-y-3 ${className}`}>
        {[...Array(lines)].map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} ${variantClasses.text}`}
            style={{
              ...style,
              width: i === lines - 1 ? "60%" : "100%",
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

// Pre-built skeleton patterns for common use cases

export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-4 animate-in fade-in duration-500">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1 space-y-3">
        <Skeleton variant="text" width="30%" />
        <Skeleton lines={3} />
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
      <Skeleton variant="rectangular" height={120} />
      <Skeleton variant="text" width="60%" />
      <Skeleton lines={2} />
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton variant="circular" width={64} height={64} />
      <div className="space-y-2">
        <Skeleton variant="text" width={120} />
        <Skeleton variant="text" width={80} />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="relative aspect-square max-w-md mx-auto">
      <Skeleton variant="rectangular" className="w-full h-full" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-white/20 text-sm font-sans">Loading Chart...</div>
      </div>
    </div>
  );
}

export function FullPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#030308] p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Skeleton variant="text" width={150} height={32} />
          <Skeleton variant="circular" width={40} height={40} />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>

        {/* List */}
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <ChatMessageSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
