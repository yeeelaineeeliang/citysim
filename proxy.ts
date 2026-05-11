import { clerkMiddleware } from "@clerk/nextjs/server";

// Route-level protection lives in the page or route handler. These URLs keep
// auth.protect() redirects inside the local Next app instead of Clerk's hosted UI.
export default clerkMiddleware({
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
