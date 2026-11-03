/** Hero — Refined typography with purple "Instantly" and prominent fading underline */
export function Hero() {
  return (
    <section className="pb-2 text-center flex-shrink-0">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
        Convert Images{" "}
        <span className="relative inline-block text-primary">
          Instantly
          <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
        </span>
      </h1>
      <p className="mt-3 max-w-2xl mx-auto text-sm text-muted-foreground sm:text-base leading-relaxed">
        Free, private and simple image conversion. Nothing is uploaded to any server.
      </p>
    </section>
  );
}
