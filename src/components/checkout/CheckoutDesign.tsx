// The checkout in two halves, like a hosted card checkout, in the home page's language: a dark order
// summary with the home hero's field of marks (white here) and a white payment form.
// Look only, for now: nothing is charged and no field is sent anywhere. The pay button, the express
// buttons and promotion codes say payments open soon. When Paddle is linked, the card fields move
// into Paddle's own frame (Paddle does not take card numbers from our fields).
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronDown, CreditCard, LockKeyhole, X } from "lucide-react";
import { RitaCube } from "@/components/rita-study/RitaCube";
import { useDotField } from "@/components/page-hero/useDotField";
import { useAuth } from "@/hooks/useAuth";
import { listPlans } from "@/lib/plans.functions";
import "./checkout.css";

type Rung = {
  slug: string;
  name: string;
  price_cents: number;
  currency?: string;
  free_talk_seconds: number;
  free_talk_period: "monthly" | "lifetime" | "daily";
  max_groq_requests?: number | null;
};

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JOD: "JD " };
const money = (cents: number, currency = "USD") =>
  `${SYMBOL[currency] ?? `${currency} `}${(cents / 100).toFixed(2)}`;
const shortName = (name: string) => name.replace(/^Uzyra\s+/i, "") || name;

const COUNTRIES = [
  { code: "JO", name: "Jordan", flag: "🇯🇴", phone: "07 9012 3456" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", phone: "05 1234 5678" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", phone: "050 123 4567" },
  { code: "EG", name: "Egypt", flag: "🇪🇬", phone: "010 1234 5678" },
  { code: "IQ", name: "Iraq", flag: "🇮🇶", phone: "0791 234 5678" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼", phone: "500 12345" },
  { code: "PS", name: "Palestine", flag: "🇵🇸", phone: "059 123 4567" },
  { code: "LB", name: "Lebanon", flag: "🇱🇧", phone: "71 123 456" },
  { code: "US", name: "United States", flag: "🇺🇸", phone: "(201) 555-0123" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", phone: "07400 123456" },
];

const BRANDS = [
  { id: "visa", label: "VISA", test: /^4/ },
  { id: "mc", label: "MC", test: /^(5[1-5]|2[2-7])/ },
  { id: "amex", label: "AMEX", test: /^3[47]/ },
];

const SOON = "Payments open very soon. Nothing was charged, and nothing you typed was sent.";

/** Digits only, in groups of four (Amex: 4-6-5). */
function cardNumber(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 19);
  if (/^3[47]/.test(digits))
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)]
      .filter(Boolean)
      .join(" ");
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** MM / YY as it is typed; a lone 2–9 becomes 0X. */
function expiry(raw: string) {
  let digits = raw.replace(/\D/g, "").slice(0, 4);
  if (/^[2-9]$/.test(digits)) digits = `0${digits}`;
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}

export function CheckoutDesign({ slug }: { slug: string }) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fetchPlans = useServerFn(listPlans);
  const { data, isLoading } = useQuery({
    queryKey: ["plans"],
    staleTime: 60_000,
    queryFn: async () => (await fetchPlans()) as unknown as Rung[],
  });
  // The paid plans with daily call time, cheapest first: Uzyra, Plus, Pro, Max. Books Reader (no
  // calls) can be bought here too, but is not one of the switcher's steps.
  const paid = useMemo(() => (data ?? []).filter((p) => p.price_cents > 0), [data]);
  const rungs = useMemo(
    () =>
      paid
        .filter((p) => p.free_talk_period === "daily" && p.free_talk_seconds > 0)
        .sort((a, b) => a.price_cents - b.price_cents),
    [paid],
  );
  const plan = paid.find((p) => p.slug === slug) ?? rungs[0];
  const onLadder = Boolean(plan && rungs.some((p) => p.slug === plan.slug));
  const currency = plan?.currency ?? "USD";
  const price = plan ? money(plan.price_cents, currency) : "";

  const summary = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const levels = useRef({ input: 0, output: 0 });
  useDotField(summary, canvas, "#ffffff");

  const [details, setDetails] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promo, setPromo] = useState("");
  const [promoNote, setPromoNote] = useState("");
  const [method, setMethod] = useState<"card" | "apple" | "paypal">("card");
  const [number, setNumber] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [country, setCountry] = useState("JO");
  const [note, setNote] = useState("");
  const place = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0];
  const brand = BRANDS.find((b) => b.test.test(number.replace(/\D/g, "")))?.id;

  const signIn = () =>
    navigate({ to: "/login", search: { next: `/checkout?plan=${plan?.slug ?? slug}` } as never });

  const choose = (next: string) =>
    navigate({
      to: "/checkout",
      search: { plan: next, billing: "three_months" } as never,
      replace: true,
    });

  const pay = (event?: FormEvent) => {
    event?.preventDefault();
    if (!authLoading && !user) return signIn();
    setNote(SOON);
  };

  const minutes = plan ? Math.round(plan.free_talk_seconds / 60) : 0;
  const groq =
    plan?.max_groq_requests === null || plan?.max_groq_requests === undefined
      ? "Unlimited"
      : plan.max_groq_requests.toLocaleString("en-US");

  return (
    <div className="co">
      {/* ------------------------------------------------------------ the order, dark */}
      <section ref={summary} className="co-sum" data-open={details ? "on" : undefined}>
        <canvas ref={canvas} className="co-field" aria-hidden="true" />
        <div className="co-sum-in">
          <div className="co-brand">
            <Link to="/pricing" className="co-back" aria-label="Back to plans">
              <ArrowLeft size={18} />
            </Link>
            <span className="co-cube" aria-hidden="true">
              <RitaCube levelsRef={levels} mode="idle" label="" />
            </span>
            <span className="co-brand-name">Uzyra</span>
          </div>

          {isLoading && !plan ? (
            <div className="co-skeleton" aria-label="Loading your plan" />
          ) : !plan ? (
            <p className="co-empty">
              We could not load the plans. <Link to="/pricing">Choose one here</Link>.
            </p>
          ) : (
            <>
              <h1 className="co-sub">Subscribe to {plan.name}</h1>
              <div className="co-price-row">
                <p className="co-price">
                  <span key={plan.slug} className="co-price-num">
                    {price}
                  </span>
                  <span className="co-per">
                    per
                    <br />
                    month
                  </span>
                </p>
                <button
                  type="button"
                  className="co-details"
                  aria-expanded={details}
                  onClick={() => setDetails((v) => !v)}
                >
                  Details <ChevronDown size={16} />
                </button>
              </div>

              <div className="co-more">
                {onLadder && rungs.length > 1 && (
                  <div className="co-rungs" role="radiogroup" aria-label="Plan">
                    {rungs.map((r) => (
                      <button
                        key={r.slug}
                        type="button"
                        role="radio"
                        aria-checked={r.slug === plan.slug}
                        className="co-rung"
                        onClick={() => choose(r.slug)}
                      >
                        {shortName(r.name)}
                      </button>
                    ))}
                  </div>
                )}

                <div className="co-item">
                  <div className="co-item-top">
                    <div>
                      <p className="co-item-name">{plan.name}</p>
                      <p className="co-muted">{plan.name} monthly subscription</p>
                      <p className="co-muted">Billed monthly</p>
                    </div>
                    <span className="co-item-price">{price}</span>
                  </div>
                  <div className="co-figs">
                    {minutes > 0 ? (
                      <div>
                        <b>{minutes} min</b>
                        <span>of calls every day</span>
                      </div>
                    ) : (
                      <div>
                        <b>Books</b>
                        <span>read with Uzyra beside you</span>
                      </div>
                    )}
                    <div>
                      <b>{groq}</b>
                      <span>Groq AI requests a month</span>
                    </div>
                  </div>
                </div>

                <div className="co-lines">
                  <div className="co-line">
                    <span>Subtotal</span>
                    <span>{price}</span>
                  </div>
                  {promoOpen ? (
                    <div className="co-promo">
                      <input
                        value={promo}
                        onChange={(e) => setPromo(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setPromoNote("Codes work once payments open.");
                        }}
                        placeholder="Promotion code"
                        aria-label="Promotion code"
                        maxLength={32}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="co-promo-apply"
                        disabled={!promo.trim()}
                        onClick={() => setPromoNote("Codes work once payments open.")}
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        className="co-promo-x"
                        aria-label="Close promotion code"
                        onClick={() => {
                          setPromoOpen(false);
                          setPromo("");
                          setPromoNote("");
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="co-promo-open"
                      onClick={() => setPromoOpen(true)}
                    >
                      Add promotion code
                    </button>
                  )}
                  {promoNote && (
                    <p className="co-promo-note" role="status">
                      {promoNote}
                    </p>
                  )}
                  <div className="co-line co-muted">
                    <span>Tax</span>
                    <span>{money(0, currency)}</span>
                  </div>
                  <div className="co-line co-total">
                    <span>Total due today</span>
                    <span>{price}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          <p className="co-powered">
            Powered by <b>Paddle</b>
            <span aria-hidden="true">|</span>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy-policy">Privacy</Link>
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ the form, white */}
      <section className="co-pay">
        <form className="co-pay-in" onSubmit={pay} noValidate autoComplete="off">
          <div className="co-express">
            <button type="button" className="co-apple" onClick={() => pay()}>
              Apple&nbsp;Pay
            </button>
            <button type="button" className="co-paypal" onClick={() => pay()}>
              PayPal
            </button>
          </div>
          <p className="co-or">
            <span>OR</span>
          </p>

          <h2 className="co-h">Contact information</h2>
          <div className="co-email">
            <span>Email</span>
            {user?.email ? (
              <span className="co-email-v">{user.email}</span>
            ) : (
              <button type="button" className="co-signin" onClick={signIn}>
                {authLoading ? "…" : "Sign in to continue"}
              </button>
            )}
          </div>

          <h2 className="co-h">Payment method</h2>
          <div className="co-methods">
            <Method
              id="card"
              current={method}
              onPick={setMethod}
              icon={<CreditCard size={18} />}
              label="Card"
            >
              <label className="co-label" htmlFor="co-number">
                Card information
              </label>
              <div className="co-group">
                <div className="co-cell co-cell-full">
                  <input
                    id="co-number"
                    inputMode="numeric"
                    placeholder="1234 1234 1234 1234"
                    value={number}
                    onChange={(e) => setNumber(cardNumber(e.target.value))}
                  />
                  <span className="co-brands" aria-hidden="true">
                    {BRANDS.map((b) => (
                      <span
                        key={b.id}
                        className={`co-chip co-chip-${b.id}`}
                        data-dim={brand && brand !== b.id ? "on" : undefined}
                      >
                        {b.label}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="co-cell">
                  <input
                    inputMode="numeric"
                    placeholder="MM / YY"
                    aria-label="Expiry date"
                    value={exp}
                    onChange={(e) => setExp(expiry(e.target.value))}
                  />
                </div>
                <div className="co-cell">
                  <input
                    inputMode="numeric"
                    placeholder="CVC"
                    aria-label="Security code"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  />
                  <span className="co-cvc" aria-hidden="true">
                    123
                  </span>
                </div>
              </div>

              <label className="co-label" htmlFor="co-name">
                Cardholder name
              </label>
              <input id="co-name" className="co-input" placeholder="Full name on card" />

              <label className="co-label" htmlFor="co-country">
                Billing address
              </label>
              <div className="co-group">
                <div className="co-cell co-cell-full">
                  <select
                    id="co-country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="co-select-icon" aria-hidden="true" />
                </div>
                <div className="co-cell co-cell-full">
                  <input placeholder="Address line 1" aria-label="Address line 1" />
                </div>
                <div className="co-cell co-cell-full">
                  <input placeholder="Address line 2" aria-label="Address line 2, optional" />
                  <span className="co-optional">Optional</span>
                </div>
                <div className="co-cell">
                  <input placeholder="City" aria-label="City" />
                </div>
                <div className="co-cell">
                  <input placeholder="Postal code" aria-label="Postal code" />
                </div>
              </div>

              <label className="co-check">
                <input type="checkbox" />
                <span>Save my payment information for future purchases</span>
              </label>
            </Method>
            <Method
              id="apple"
              current={method}
              onPick={setMethod}
              icon={<span className="co-mark">Pay</span>}
              label="Apple Pay"
            >
              <p className="co-method-note">
                You confirm with Face ID or Touch ID after you press Pay.
              </p>
            </Method>
            <Method
              id="paypal"
              current={method}
              onPick={setMethod}
              icon={<span className="co-mark co-mark-pp">P</span>}
              label="PayPal"
            >
              <p className="co-method-note">PayPal opens to finish, then you come back here.</p>
            </Method>
          </div>

          <div className="co-phone">
            <label className="co-label" htmlFor="co-phone">
              Phone number
            </label>
            <div className="co-phone-field">
              <span className="co-flag" aria-hidden="true">
                {place.flag}
              </span>
              <input
                id="co-phone"
                type="tel"
                inputMode="tel"
                placeholder={place.phone}
                aria-describedby="co-phone-opt"
              />
              <span id="co-phone-opt" className="co-optional">
                Optional
              </span>
            </div>
          </div>

          <p className="co-legal">
            By subscribing, you authorise Uzyra to charge you according to the terms until you
            cancel.
          </p>

          <button type="submit" className="co-paybtn">
            <LockKeyhole size={17} /> Pay and subscribe
          </button>
          {note && (
            <p className="co-note" role="status">
              {note}
            </p>
          )}

          <p className="co-mor">
            Our order process is conducted by our online reseller Paddle.com, the Merchant of Record
            for all our orders. See our <Link to="/terms">Terms</Link>,{" "}
            <Link to="/privacy-policy">Privacy notice</Link> and{" "}
            <Link to="/refund-policy">Refund policy</Link>.
          </p>
        </form>
      </section>
    </div>
  );
}

function Method<T extends string>({
  id,
  current,
  onPick,
  icon,
  label,
  children,
}: {
  id: T;
  current: T;
  onPick: (id: T) => void;
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  const open = current === id;
  return (
    <div className="co-method" data-open={open ? "on" : undefined}>
      <label className="co-method-head">
        <input
          type="radio"
          name="co-method"
          className="co-radio"
          checked={open}
          onChange={() => onPick(id)}
        />
        <span className="co-method-icon">{icon}</span>
        {label}
      </label>
      {open && <div className="co-method-body">{children}</div>}
    </div>
  );
}
