import { AuthForm } from "@/components/AuthForm";

export default function Home() {
  return (
    <main className="auth-shell">
      <div className="auth-shell__pattern" aria-hidden />
      <section className="auth-shell__content">
        <AuthForm />
      </section>
      <aside className="auth-shell__aside hidden lg:flex">
        <div className="max-w-sm">
          <h2 className="font-serif text-2xl text-stone-900">
            Work tracker &amp; reading list
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            KaamKaaj helps you log tasks for the day and keep a focused reading
            queue — side by side, without clutter.
          </p>
          <ul className="mt-8 space-y-4 text-sm text-stone-700">
            <li className="flex gap-3">
              <span className="step-badge">1</span>
              <span>Sign in with a verified email and password you create.</span>
            </li>
            <li className="flex gap-3">
              <span className="step-badge">2</span>
              <span>Open the Work Tracker to plan and complete tasks.</span>
            </li>
            <li className="flex gap-3">
              <span className="step-badge">3</span>
              <span>Use the Reading List window for books and articles.</span>
            </li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
