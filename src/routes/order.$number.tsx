import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { ContactCard } from "@/components/ContactCard";

export const Route = createFileRoute("/order/$number")({
  head: () => ({
    meta: [
      { title: "Order confirmed — Chocolate-n-More" },
      { name: "description", content: "Your Chocolate-n-More order has been received." },
      { property: "og:title", content: "Order confirmed — Chocolate-n-More" },
      { property: "og:description", content: "Thanks for ordering from Chocolate-n-More." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Confirmed,
});

function Confirmed() {
  const { number } = Route.useParams();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
        <h1 className="mt-4 text-3xl font-bold">Order placed!</h1>
        <p className="mt-2 text-muted-foreground">Your order number is</p>
        <p className="mt-2 font-display text-4xl font-bold text-primary">{number}</p>
        <p className="mt-4 text-sm text-muted-foreground">
          Please keep this number. Pay by cash or UPI at the counter or on delivery.
        </p>
        <div className="mt-8 text-left"><ContactCard /></div>
        <Link to="/menu" className="mt-8 inline-block rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground">Order more</Link>
      </div>
      <SiteFooter />
    </div>
  );
}
