import type { Metadata } from "next";
import "./globals.css";
import AppFrame from "@/components/AppFrame";
import { SessionProvider } from "@/components/SessionProvider";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "WakudOS · Plant Command",
  description: "Biofuel facility management for Wakud International LLC",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <html lang="en">
      <body>
        <SessionProvider value={user}>
          <AppFrame>{children}</AppFrame>
        </SessionProvider>
      </body>
    </html>
  );
}
