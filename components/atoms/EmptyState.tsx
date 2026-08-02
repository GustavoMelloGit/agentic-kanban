export default function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-faint mx-1 mt-2 mb-1 rounded-md border border-dashed px-3 py-4 text-center text-xs">
      {children}
    </p>
  );
}
