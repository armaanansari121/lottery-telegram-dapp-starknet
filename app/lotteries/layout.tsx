"use client";

export default function LotteryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative bg-purple-100 text-purple-900 overflow-hidden">
      {children}
    </div>
  );
}
