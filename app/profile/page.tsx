import { auth } from "@clerk/nextjs/server";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
  await auth.protect();

  return <ProfileClient />;
}
