import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image
            src="/wakud-logo.png"
            alt="WAKUD"
            width={240}
            height={45}
            priority
            className="h-11 w-auto"
          />
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h1 className="text-lg font-semibold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">
            Plant Command — Wakud International
          </p>

          <form className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-600">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@wakud.com"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-600">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <button
              type="button"
              className="w-full rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
            >
              Sign in
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] text-slate-400">
            Authentication (Supabase) wiring pending.
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          Wakud International LLC · Barka, Oman
        </p>
      </div>
    </div>
  );
}
