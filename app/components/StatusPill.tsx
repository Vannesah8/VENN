import type { EscrowStatus } from "@/lib/escrow";
import { getEscrowStatusLabel, getEscrowStatusTone } from "@/lib/escrow";
import type { Lang } from "@/lib/i18n";

const TONE_CLASSES: Record<string, string> = {
  neutral: "border-[#dfece5] bg-[#f1f3f1] text-[#5d736a]",
  progress: "border-[#bfd4c8] bg-[#edf3ee] text-[#1e4d3d]",
  positive: "border-[#1e4d3d] bg-[#1e4d3d] text-white",
  warning: "border-[#e3c98a] bg-[#fbf3e2] text-[#8a5a12]",
};

export function StatusPill({
  status,
  lang = "en",
}: {
  status: EscrowStatus;
  lang?: Lang;
}) {
  const tone = getEscrowStatusTone(status);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
        TONE_CLASSES[tone] ?? TONE_CLASSES.neutral
      }`}
    >
      {getEscrowStatusLabel(status, lang)}
    </span>
  );
}