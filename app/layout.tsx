import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "mapbox-gl/dist/mapbox-gl.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "LivingThere",
  description: "Live a year in a Chicago neighborhood before you sign the lease.",
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
