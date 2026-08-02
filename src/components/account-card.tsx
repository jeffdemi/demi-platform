import Link from "next/link";
import { TreePine } from "lucide-react";

type AccountCardProps = {
  children: React.ReactNode;
  description: string;
  title: string;
  backHref?: string;
  backLabel?: string;
};

export function AccountCard({
  children,
  description,
  title,
  backHref,
  backLabel,
}: AccountCardProps) {
  return (
    <main className="grid min-h-screen place-items-center bg-page px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-line bg-surface p-7 shadow-sm sm:p-9">
        <div className="flex items-center gap-3 text-brand">
          <span className="grid size-10 place-items-center rounded-md bg-brand text-on-brand">
            <TreePine aria-hidden="true" size={22} strokeWidth={2.25} />
          </span>
          <div>
            <p className="font-bold">Demi Platform</p>
            <p className="text-sm text-muted">Demi Solutions LLC</p>
          </div>
        </div>
        <h1 className="mt-8 text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 leading-7 text-muted">{description}</p>
        {children}
        {backHref && backLabel && (
          <Link className="mt-7 inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline" href={backHref}>
            {backLabel}
          </Link>
        )}
      </section>
    </main>
  );
}
