import { NextResponse } from "next/server";
import { generateNarrative } from "@/lib/generateNarrative";
import { querySimulationData } from "@/lib/querySimulationData";
import { renderAsciiCard } from "@/lib/renderAsciiCard";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const structuredData = await querySimulationData();
    const [narrative, asciiCard] = await Promise.all([
      generateNarrative(structuredData),
      Promise.resolve(renderAsciiCard(structuredData)),
    ]);

    return NextResponse.json({
      structuredData,
      narrative,
      asciiCard,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Simulation failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

