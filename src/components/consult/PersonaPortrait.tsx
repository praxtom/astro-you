import { useState } from "react";
import type { AstrologerPersona } from "../../lib/personas";

const sizeClass = {
  sm: "w-10 h-10 text-xl rounded-xl",
  md: "w-14 h-14 text-2xl rounded-2xl",
  lg: "w-24 h-24 text-5xl rounded-[2rem]",
};

export function PersonaPortrait({
  persona,
  size = "md",
}: {
  persona: AstrologerPersona;
  size?: keyof typeof sizeClass;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`${sizeClass[size]} shrink-0 overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center`}
    >
      {!failed ? (
        <img
          src={persona.avatarUrl}
          alt={persona.name}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{persona.avatar}</span>
      )}
    </div>
  );
}
