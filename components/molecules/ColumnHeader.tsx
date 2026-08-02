import Icon from "@/components/atoms/Icon";
import type { Column } from "@/lib/config";

function Regra({ col }: { col: Column }) {
  if (col.type === "autonomous") {
    return (
      <>
        <Icon name="raio" size="sm" />
        autonomous → {col.onComplete || "—"}
        {col.onReject && ` · ↩ ${col.onReject}`}
      </>
    );
  }
  if (col.type === "automated") {
    return (
      <>
        <Icon name="robo" size="sm" />
        automated (fica)
      </>
    );
  }
  return <>manual</>;
}

export default function ColumnHeader({ col }: { col: Column }) {
  return (
    <h2 className="mx-1 mb-3 flex flex-col gap-0.5 text-[13px] font-semibold tracking-[-0.005em]">
      {col.name}
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-normal ${
          col.type === "manual" ? "text-faint" : "text-brand-text"
        }`}
      >
        <Regra col={col} />
      </span>
    </h2>
  );
}
