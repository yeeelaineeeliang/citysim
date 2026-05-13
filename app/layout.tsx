import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CityLiving Sim",
  description: "October 2024 Hyde Park bus ridership simulation",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/sim"
          signUpFallbackRedirectUrl="/sim"
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
