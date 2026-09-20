import Link from "next/link";
import BrandMark from "@/components/BrandMark";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-ink relative overflow-hidden flex flex-col">
      <div className="absolute -top-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-chili/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-32 w-[28rem] h-[28rem] rounded-full bg-turmeric/10 blur-3xl pointer-events-none" />

      <header className="px-6 py-6 relative z-10">
        <div className="max-w-6xl mx-auto flex items-center gap-2.5">
          <BrandMark size={20} />
          <span className="font-display text-xl font-bold tracking-tight text-paper">TableServe</span>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 relative z-10">
        <div className="w-full max-w-md text-center">
          <span className="inline-block text-xs font-semibold tracking-wide uppercase text-turmeric bg-white/5 px-3 py-1 rounded-full mb-6">
            QR ordering platform for restaurants &amp; hotels
          </span>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-paper leading-tight">
            Scan a table.
            <br />
            Serve the menu.
            <br />
            Run the whole thing from here.
          </h1>
          <p className="mt-4 text-paper/55 max-w-sm mx-auto">
            One dashboard for your menu, tables, offers, orders, and billing —
            customers just scan and order, no app required.
          </p>

          <div className="mt-10 bg-paper rounded-2xl p-6 shadow-2xl grid gap-3">
            <Link
              href="/login"
              className="w-full bg-chili hover:bg-chili-dark transition-colors text-white font-semibold py-3.5 rounded-card"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="w-full border border-ink/15 text-ink font-semibold py-3.5 rounded-card hover:bg-ink/5 transition-colors"
            >
              Set up your restaurant
            </Link>
          </div>
        </div>
      </section>

      <footer className="text-center text-xs text-paper/30 pb-6 relative z-10">
        TableServe — QR menus, ordering, and billing for one restaurant or many.
      </footer>
    </main>
  );
}
