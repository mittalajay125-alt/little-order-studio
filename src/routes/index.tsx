import { createFileRoute, Link } from "@tanstack/react-router";
import hero from "@/assets/hero.jpg";
import bowl from "@/assets/bowl.jpg";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { ContactCard } from "@/components/ContactCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chocolate-n-More — Brownies, Fruit Cups & Truffles" },
      { name: "description", content: "Order fudgy brownie bowls, fruit punch brownies, fruit cups and truffle balls. Stall pickup or home delivery." },
      { property: "og:title", content: "Chocolate-n-More — Order Brownies Online" },
      { property: "og:description", content: "Fudgy brownie bowls, fruit cups and truffles. Pickup or delivery, pay by cash or UPI." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="relative overflow-hidden bg-cocoa-gradient text-cocoa-foreground">
        <img src={hero} alt="Stacked chocolate brownies with strawberries" width={1600} height={1008}
          className="absolute inset-0 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-r from-cocoa via-cocoa/70 to-transparent" />
        <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-4 py-20">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-caramel">Handmade desserts</p>
          <h1 className="max-w-xl text-5xl font-bold leading-tight md:text-7xl">
            Chocolate<span className="text-caramel">-n-</span>More
          </h1>
          <p className="mt-5 max-w-md text-lg opacity-90">
            Fudgy brownie bowls, fruit punch brownies, fruit cups & truffle balls — made fresh.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/menu" className="rounded-full bg-caramel px-8 py-3.5 text-lg font-semibold text-accent-foreground shadow-warm transition hover:scale-105">
              Order Now
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2">
        <img src={bowl} alt="Brownie bowl with Oreo and KitKat" width={1024} height={1024} loading="lazy"
          className="aspect-square w-full rounded-3xl object-cover shadow-warm" />
        <div>
          <h2 className="text-3xl font-bold md:text-4xl">Signature brownie bowls</h2>
          <p className="mt-4 text-muted-foreground">
            Choose Mini or Full, add Oreo, KitKat, Biscoff crumbs or almonds, and pick up at our stall or get it delivered home.
          </p>
          <ul className="mt-6 grid grid-cols-2 gap-3 text-sm">
            {["Fruit Punch Brownies", "Brownie Bowls", "Truffle Balls", "Fruit Cups"].map((c) => (
              <li key={c} className="rounded-xl bg-secondary px-4 py-3 font-medium">{c}</li>
            ))}
          </ul>
          <Link to="/menu" className="mt-8 inline-block rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground">
            View full menu
          </Link>
          <div className="mt-8"><ContactCard /></div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
