import { prisma } from "../config/db";

// Excludes 0/O and 1/I — codes get read aloud in a classroom, ambiguous
// characters cause real friction there.
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSegment(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return result;
}

export async function generateUniqueJoinCode(): Promise<string> {
  // Collision odds are negligible at this keyspace size, but checking is
  // cheap insurance against a stuck signup rather than trusting probability.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `SYN-${randomSegment(6)}`;
    const existing = await prisma.class.findUnique({
      where: { joinCode: code },
    });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique join code after 5 attempts");
}
