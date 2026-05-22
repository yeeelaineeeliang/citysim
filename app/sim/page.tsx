import { SimClient } from "./SimClient";

export default async function SimPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  return <SimClient demoMode={demo === "1"} />;
}
