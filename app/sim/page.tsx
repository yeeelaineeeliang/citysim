import { SimClient } from "./SimClient";

export default async function SimPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; autorun?: string }>;
}) {
  const { demo, autorun } = await searchParams;
  return <SimClient demoMode={demo === "1"} autorun={autorun === "1"} />;
}
